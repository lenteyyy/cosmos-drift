import * as T from 'three';
const sphere = new T.SphereGeometry(1, 48, 32),
  lowSphere = new T.SphereGeometry(1, 16, 10);
const vertex = `varying vec3 n;varying vec3 v;varying vec2 uv0;varying vec3 p;void main(){uv0=uv;p=position;n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`;
const noise = `float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}float fbm(vec3 p){return noise(p)*.55+noise(p*2.1)*.27+noise(p*4.2)*.13+noise(p*8.3)*.05;}`;
const earthTexture = new T.TextureLoader().load('/textures/earth.jpg', () => {
  window.dispatchEvent(new Event('cosmos-assets-change'));
});
earthTexture.colorSpace = T.SRGBColorSpace;
earthTexture.anisotropy = 4;
const earthMat = new T.ShaderMaterial({
  uniforms: { map: { value: earthTexture }, time: { value: 0 } },
  vertexShader: vertex,
  fragmentShader: `uniform sampler2D map;uniform float time;${noise}varying vec3 n;varying vec3 v;varying vec2 uv0;varying vec3 p;void main(){vec3 color=texture2D(map,uv0+vec2(.05,0)).rgb;float clouds=smoothstep(.59,.73,fbm(p*9.+vec3(time*.003,0,0)));color=mix(color,vec3(.85,.9,.94),clouds*.83);float light=dot(n,normalize(vec3(-.7,.5,1.)));float day=smoothstep(-.15,.3,light);color*=.055+day*.95;float ocean=step(color.b*1.06,color.r);float spec=pow(max(dot(reflect(-normalize(vec3(-.7,.5,1.)),n),v),0.),38.)*(1.-ocean);color+=vec3(.4,.65,.72)*spec*.35;float rim=pow(1.-max(dot(n,v),0.),3.5)*day;color+=vec3(.08,.35,.6)*rim*.4;gl_FragColor=vec4(color,1.);}`,
});
const atmosphereMat = new T.ShaderMaterial({
  vertexShader: vertex,
  fragmentShader:
    'varying vec3 n;varying vec3 v;void main(){float f=pow(1.-max(dot(n,v),0.),3.8);float light=.25+.75*max(dot(n,normalize(vec3(-.7,.5,1.))),0.);gl_FragColor=vec4(.15,.5,.95,f*.65*light);}',
  transparent: true,
  blending: T.AdditiveBlending,
  depthWrite: false,
});
const planetMaterials = new Map<string, T.ShaderMaterial>();
export function planetMaterial(color: string, banded = false) {
  const key = color + banded;
  if (planetMaterials.has(key)) return planetMaterials.get(key)!;
  const m = new T.ShaderMaterial({
    uniforms: { base: { value: new T.Color(color) }, banded: { value: banded ? 1 : 0 } },
    vertexShader: vertex,
    fragmentShader: `uniform vec3 base;uniform float banded;${noise}varying vec3 n;varying vec3 p;void main(){float detail=fbm(p*7.);float bands=sin(p.y*47.+noise(p*8.)*5.)*.13;vec3 col=base*(.6+detail*.55+bands*banded);float l=max(dot(n,normalize(vec3(-.7,.5,1.))),0.);col*=.09+l*.95;gl_FragColor=vec4(col,1.);}`,
  });
  planetMaterials.set(key, m);
  return m;
}
function glowTexture(galaxy = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 125);
  gradient.addColorStop(0, galaxy ? 'rgba(255,237,208,1)' : 'rgba(255,255,255,1)');
  gradient.addColorStop(0.05, 'rgba(237,242,255,.9)');
  gradient.addColorStop(0.22, galaxy ? 'rgba(184,185,230,.4)' : 'rgba(180,210,255,.25)');
  gradient.addColorStop(1, 'rgba(80,100,140,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  if (galaxy) {
    ctx.translate(128, 128);
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let i = 0; i < 180; i++) {
        const t = i / 35,
          r = i * 0.64,
          a = t + (arm * Math.PI * 2) / 3;
        const x = Math.cos(a) * r,
          y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(169,194,225,.24)';
      ctx.lineWidth = 12;
      ctx.filter = 'blur(5px)';
      ctx.stroke();
    }
  }
  const tex = new T.CanvasTexture(canvas);
  return tex;
}
const glow = glowTexture(),
  galaxyTexture = glowTexture(true);
export const pointTexture = glow;
const starMaterials = new Map<string, T.ShaderMaterial>();
export function starColor(s: string) {
  return s.startsWith('M')
    ? '#ff9c71'
    : s.startsWith('K')
      ? '#ffc187'
      : s.startsWith('G')
        ? '#fff2c6'
        : s.startsWith('F')
          ? '#fff9e7'
          : s.startsWith('O') || s.startsWith('B')
            ? '#9ebeff'
            : '#deebff';
}
function starMat(color: string) {
  if (!starMaterials.has(color))
    starMaterials.set(
      color,
      new T.ShaderMaterial({
        uniforms: { base: { value: new T.Color(color) }, time: { value: 0 } },
        vertexShader: vertex,
        fragmentShader: `uniform vec3 base;uniform float time;${noise}varying vec3 n;varying vec3 v;varying vec3 p;
    void main(){float granules=fbm(p*42.+vec3(time*.018));float limb=.55+.45*pow(max(dot(n,v),0.),.25);
    vec3 radiance=mix(base,vec3(1.),.46)*(2.6+granules*.9)*limb;
    gl_FragColor=vec4(radiance,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
      }),
    );
  return starMaterials.get(color)!;
}
const ringGeo = new T.RingGeometry(1.35, 2.25, 72),
  ringMat = new T.MeshBasicMaterial({
    color: '#a79373',
    side: T.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
const diskGeo = new T.RingGeometry(1.5, 5, 80),
  diskMat = new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: vertex,
    fragmentShader: `varying vec2 uv0;varying vec3 p;uniform float time;void main(){float r=length(p.xy);float a=atan(p.y,p.x);float f=pow(max(0.,1.-abs(r-2.5)/2.5),2.);float rip=.7+.3*sin(r*38.+a*4.-time*2.);vec3 c=mix(vec3(1.,.25,.03),vec3(1.,.88,.57),f);gl_FragColor=vec4(c,f*rip*.85);}`,
    transparent: true,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
const holeMat = new T.MeshBasicMaterial({ color: '#000005' }),
  photonGeo = new T.TorusGeometry(1.15, 0.035, 8, 96),
  photonMat = new T.MeshBasicMaterial({ color: '#ffce89' });
const cloudGeometry = (() => {
  const a = new Float32Array(180 * 3),
    rng = random(813);
  for (let i = 0; i < 180; i++) {
    const r = Math.pow(rng(), 0.7),
      theta = rng() * Math.PI * 2,
      z = rng() * 2 - 1;
    a.set(
      [
        Math.cos(theta) * Math.sqrt(1 - z * z) * r,
        z * r * 0.7,
        Math.sin(theta) * Math.sqrt(1 - z * z) * r,
      ],
      i * 3,
    );
  }
  return new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(a, 3));
})();
const cloudMaterial = new T.PointsMaterial({
  size: 2.2,
  color: '#b9c4d7',
  map: glow,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
  sizeAttenuation: false,
  blending: T.AdditiveBlending,
});
const structureGeometry = new T.IcosahedronGeometry(1, 1);
const sheetGeometry = new T.BoxGeometry(2, 2, 0.025, 5, 5, 1);
export function createSlot() {
  const group = new T.Group();
  const mesh = new T.Mesh<T.SphereGeometry, T.Material>(sphere, earthMat);
  const atmo = new T.Mesh(sphere, atmosphereMat);
  atmo.scale.setScalar(1.025);
  const halo = new T.Sprite(
    new T.SpriteMaterial({
      map: glow,
      color: '#ffffdd',
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6,
    }),
  );
  halo.scale.setScalar(6);
  const galaxy = new T.Sprite(
    new T.SpriteMaterial({
      map: galaxyTexture,
      color: '#c2d2e0',
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6,
    }),
  );
  galaxy.scale.set(4, 1.7, 1);
  const ring = new T.Mesh(ringGeo, ringMat);
  ring.rotation.x = -1.1;
  const black = new T.Group();
  black.add(new T.Mesh(lowSphere, holeMat));
  const disk = new T.Mesh(diskGeo, diskMat);
  disk.rotation.x = -1.14;
  black.add(disk, new T.Mesh(photonGeo, photonMat));
  const volume = new T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>(
    structureGeometry,
    new T.MeshBasicMaterial({
      wireframe: true,
      color: '#72a69c',
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    }),
  );
  const cloud = new T.Points(cloudGeometry, cloudMaterial);
  cloud.userData.isProcedural = true;
  group.add(mesh, atmo, halo, galaxy, ring, black, volume, cloud);
  return { group, mesh, atmo, halo, galaxy, ring, black, volume, cloud, id: '' };
}
export function setSlot(
  slot: ReturnType<typeof createSlot>,
  o: { id: string; category: string; physical: Record<string, unknown> },
) {
  slot.id = o.id;
  const planet = ['planet', 'moon', 'dwarf_planet', 'exoplanet'].includes(o.category),
    star = o.category === 'star',
    gal = o.category === 'galaxy',
    bh = o.category === 'black_hole';
  slot.mesh.visible = planet || star;
  slot.atmo.visible = o.id === 'earth';
  slot.halo.visible = star;
  slot.galaxy.visible = gal;
  slot.black.visible = bh;
  slot.ring.visible = o.id === 'saturn';
  slot.volume.visible = !planet && !star && !gal && !bh;
  slot.cloud.visible = ['galaxy_cluster', 'supercluster', 'galaxy_group'].includes(o.category);
  slot.volume.material.opacity =
    o.category === 'void' ? 0.035 : o.category === 'supercluster' ? 0.025 : 0.055;
  slot.volume.geometry = o.category === 'wall' ? sheetGeometry : structureGeometry;
  slot.mesh.material =
    o.id === 'earth'
      ? earthMat
      : star
        ? starMat(starColor(String(o.physical.spectralType || 'G')))
        : planetMaterial(
            String(o.physical.color || '#a9a091'),
            ['jupiter', 'saturn', 'uranus', 'neptune'].includes(o.id),
          );
  if (star) slot.halo.material.color.set(starColor(String(o.physical.spectralType || 'G')));
  if (o.category === 'wall') slot.volume.scale.set(2, 0.15, 1);
  else if (o.category === 'filament') slot.volume.scale.set(0.18, 0.18, 3);
  else slot.volume.scale.set(1, 0.7, 1);
  slot.volume.material.color.set(o.category === 'void' ? '#b9a3cf' : '#86cbb8');
}
export function animateMaterials(t: number) {
  earthMat.uniforms.time.value = t;
  diskMat.uniforms.time.value = t;
  starMaterials.forEach((material) => (material.uniforms.time.value = t));
}
export function random(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function makeMilkyWay(_low = false) {
  const rng = random(821),
    dummy = new T.Object3D();
  // Shared instanced faint dust patches mark the approximate galactic disk.
  const dust = new T.InstancedMesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({
      map: glow,
      color: '#342e46',
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    48,
  );
  for (let i = 0; i < 48; i++) {
    dummy.position.set((rng() - 0.5) * 80000, (rng() - 0.5) * 600, (rng() - 0.5) * 80000);
    dummy.rotation.x = -Math.PI / 2;
    dummy.scale.set(9000 + rng() * 8000, 3000 + rng() * 3000, 1);
    dummy.updateMatrix();
    dust.setMatrixAt(i, dummy.matrix);
  }
  const g = new T.Group();
  g.add(dust);
  g.userData.isProcedural = true;
  return g;
}
export function makeShip() {
  const g = new T.Group(),
    hullMat = new T.MeshStandardMaterial({ color: '#81929c', metalness: 0.8, roughness: 0.35 }),
    dark = new T.MeshStandardMaterial({ color: '#17222e', metalness: 0.6, roughness: 0.3 });
  const body = new T.Mesh(new T.ConeGeometry(0.28, 1.45, 4), hullMat);
  body.rotation.x = -Math.PI / 2;
  body.rotation.z = Math.PI / 4;
  g.add(body);
  for (const side of [-1, 1]) {
    const wing = new T.Mesh(new T.BoxGeometry(0.92, 0.07, 0.55), hullMat);
    wing.position.set(side * 0.5, -0.06, 0.35);
    wing.rotation.y = side * -0.4;
    wing.rotation.z = side * -0.12;
    g.add(wing);
    const engine = new T.Mesh(new T.CylinderGeometry(0.12, 0.15, 0.5, 10), dark);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 0.52, -0.01, 0.6);
    g.add(engine);
    const light = new T.Mesh(
      new T.CircleGeometry(0.105, 16),
      new T.MeshBasicMaterial({ color: '#b1fff6' }),
    );
    light.position.set(side * 0.52, -0.01, 0.86);
    g.add(light);
    const plume = new T.Mesh(
      new T.ConeGeometry(0.11, 0.7, 12),
      new T.MeshBasicMaterial({ color: '#8edfff', transparent: true, opacity: 0.55 }),
    );
    plume.rotation.x = Math.PI / 2;
    plume.position.set(side * 0.52, -0.01, 1.1);
    plume.name = 'plume';
    g.add(plume);
  }
  const glass = new T.Mesh(
    new T.SphereGeometry(0.2, 10, 6),
    new T.MeshStandardMaterial({
      color: '#80c9d8',
      emissive: '#17485c',
      metalness: 0.9,
      roughness: 0.1,
    }),
  );
  glass.scale.set(0.7, 0.35, 2);
  glass.position.set(0, 0.13, -0.15);
  g.add(glass);
  return g;
}

/** Decorative, unnamed filaments. Normalized Gly coordinates keep GPU floats small. */
export function makeCosmicWeb() {
  const rng = random(271),
    nodes = Array.from(
      { length: 140 },
      () => new T.Vector3((rng() - 0.5) * 75, (rng() - 0.5) * 75, (rng() - 0.5) * 75),
    ),
    lines: number[] = [],
    particles: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const nearest = nodes
      .map((v, j) => ({ j, d: v.distanceTo(nodes[i]) }))
      .filter((n) => n.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const n of nearest) {
      if (n.j < i) continue;
      const a = nodes[i],
        b = nodes[n.j];
      lines.push(...a.toArray(), ...b.toArray());
      for (let k = 0; k < 32; k++) {
        const t = k / 32;
        particles.push(
          a.x + (b.x - a.x) * t + (rng() - 0.5) * 0.4,
          a.y + (b.y - a.y) * t + (rng() - 0.5) * 0.4,
          a.z + (b.z - a.z) * t + (rng() - 0.5) * 0.4,
        );
      }
    }
  }
  const group = new T.Group();
  group.add(
    new T.LineSegments(
      new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(lines, 3)),
      new T.LineBasicMaterial({
        color: '#7facc6',
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
      }),
    ),
  );
  group.userData.isProcedural = true;
  return group;
}
