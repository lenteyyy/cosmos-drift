import * as T from 'three';
import { perlinNoiseFragmentShader, warpFragmentShader } from '@paper-design/shaders';
import { renderBudget, shaderSize } from './render-policy.mjs';
const vertex = `precision mediump float;in vec3 position;out vec2 v_patternUV;uniform float aspect;uniform vec2 viewOffset;
void main(){v_patternUV=position.xy*vec2(aspect,1.)*1.7+viewOffset;gl_Position=vec4(position.xy,0.,1.);}`;
// Compute nonlinear polar coordinates per fragment, rather than interpolating four corners.
const transitShader = warpFragmentShader
  .replace(/^#version 300 es\s*/, '')
  .replace('in vec2 v_patternUV;', 'in vec2 v_patternUV; uniform vec2 viewOffset;')
  .replace(
    'vec2 uv = v_patternUV;',
    `vec2 p=(v_patternUV-viewOffset)/1.7;
  float radius=max(length(p),.04);
  vec2 uv=vec2(p.x/radius*2.,-log(radius)*3.+p.y/radius*.5);`,
  );
/** Paper's GLSL3 programs run through the existing Three renderer: no second canvas/context/RAF. */
export function createPaperBackground() {
  const geometry = new T.PlaneGeometry(2, 2),
    noiseData = new Uint8Array(64 * 64 * 4);
  let seed = 761;
  for (let i = 0; i < noiseData.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    noiseData[i] = seed >>> 24;
  }
  const noise = new T.DataTexture(noiseData, 64, 64, T.RGBAFormat);
  noise.wrapS = noise.wrapT = T.RepeatWrapping;
  noise.minFilter = noise.magFilter = T.LinearFilter;
  noise.needsUpdate = true;
  const shared = {
    aspect: { value: 1 },
    viewOffset: { value: new T.Vector2() },
    u_time: { value: 18 },
  };
  const perlin = new T.RawShaderMaterial({
    glslVersion: T.GLSL3,
    vertexShader: vertex,
    fragmentShader: perlinNoiseFragmentShader
      .replace(/^#version 300 es\s*/, '')
      .replace('vec2 uv = v_patternUV;', 'vec2 uv = v_patternUV * .2;'),
    uniforms: {
      ...shared,
      u_colorFront: { value: new T.Vector4(0.12, 0.17, 0.29, 1) },
      u_colorBack: { value: new T.Vector4(0.006, 0.012, 0.025, 1) },
      u_proportion: { value: 0.44 },
      u_softness: { value: 0.48 },
      u_octaveCount: { value: 4 },
      u_persistence: { value: 0.52 },
      u_lacunarity: { value: 2.1 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const colors = ['#020815', '#163e67', '#50428b', '#63a7c3', '#0b1830'].map((color) => {
    const c = new T.Color(color);
    return new T.Vector4(c.r, c.g, c.b, 1);
  });
  while (colors.length < 10) colors.push(colors.at(-1)!.clone());
  const warp = new T.RawShaderMaterial({
    glslVersion: T.GLSL3,
    vertexShader: vertex,
    fragmentShader: transitShader,
    uniforms: {
      ...shared,
      u_noiseTexture: { value: noise },
      u_colors: { value: colors },
      u_colorsCount: { value: 5 },
      u_proportion: { value: 0.5 },
      u_softness: { value: 0.85 },
      u_shape: { value: 1 },
      u_shapeScale: { value: 0.24 },
      u_distortion: { value: 0.36 },
      u_swirl: { value: 0.65 },
      u_swirlIterations: { value: 6 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const target = new T.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
    type: T.UnsignedByteType,
  });
  const passScene = new T.Scene(),
    camera = new T.Camera(),
    quad = new T.Mesh(geometry, perlin);
  quad.frustumCulled = false;
  passScene.add(quad);
  const displayMaterial = new T.RawShaderMaterial({
    glslVersion: T.GLSL3,
    vertexShader: `precision highp float;in vec3 position;out vec2 texcoord;void main(){texcoord=position.xy*.5+.5;gl_Position=vec4(position.xy,.999999,1.);}`,
    fragmentShader: `precision highp float;uniform sampler2D nebula;uniform float transit;in vec2 texcoord;out vec4 fragColor;
    void main(){vec3 color=texture(nebula,texcoord).rgb;float mist=.4+.6*(1.-smoothstep(.1,.8,abs(texcoord.y-.48)));fragColor=vec4(color*mix(mist,.85,transit),1.);}`,
    uniforms: { nebula: { value: target.texture }, transit: { value: 0 } },
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const mesh = new T.Mesh(geometry, displayMaterial);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  let last = -Infinity,
    lastTransit = false,
    lastWidth = 0,
    lastHeight = 0,
    lastQuality = '',
    frames = 0;
  return {
    mesh,
    get frames() {
      return frames;
    },
    get pixels() {
      return target.width * target.height;
    },
    update(
      renderer: T.WebGLRenderer,
      width: number,
      height: number,
      quality: 'high' | 'low',
      time: number,
      transit: boolean,
      heading: number[],
    ) {
      const changed =
        width !== lastWidth ||
        height !== lastHeight ||
        quality !== lastQuality ||
        transit !== lastTransit;
      if (!changed && Math.abs(time - last) < 1 / renderBudget(quality).shaderFps) return;
      if (changed) {
        const [w, h] = shaderSize(width, height, quality);
        target.setSize(w, h);
        lastWidth = width;
        lastHeight = height;
        lastQuality = quality;
      }
      last = time;
      lastTransit = transit;
      shared.aspect.value = width / Math.max(1, height);
      shared.viewOffset.value.set(Math.atan2(heading[0], -heading[2]) * 0.35, heading[1] * 0.35);
      shared.u_time.value = 18 + time * (transit ? 3 : 0.18);
      perlin.uniforms.u_octaveCount.value = renderBudget(quality).octaves;
      warp.uniforms.u_swirlIterations.value = renderBudget(quality).swirls;
      quad.material = transit ? warp : perlin;
      displayMaterial.uniforms.transit.value = transit ? 1 : 0;
      const previous = renderer.getRenderTarget(),
        autoClear = renderer.autoClear;
      try {
        renderer.setRenderTarget(target);
        renderer.autoClear = true;
        renderer.render(passScene, camera);
        frames++;
      } finally {
        renderer.setRenderTarget(previous);
        renderer.autoClear = autoClear;
      }
    },
    dispose() {
      geometry.dispose();
      perlin.dispose();
      warp.dispose();
      displayMaterial.dispose();
      target.dispose();
      noise.dispose();
    },
  };
}
