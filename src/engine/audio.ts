import { TRACKS, musicIndex, musicScene } from './music.mjs';
import type { CosmicObject } from '../types';
import { engineSound } from './engine-sound.mjs';
import { LOCAL_MEDIA } from './local-media.mjs';
import { selectEnglishVoice } from './narrator.mjs';
type AudioSettings = {
  muted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  soundVolume: number;
  voiceEnabled: boolean;
  voiceVolume: number;
};
type Cue = 'select' | 'arrive' | 'brake' | 'hover' | 'ui';
/** Original, procedurally composed ambient score and cabin sound design; no remote media. */
class CabinAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  effects: GainNode | null = null;
  music: GainNode | null = null;
  engine: GainNode | null = null;
  oscillator: OscillatorNode | null = null;
  engineProfile = engineSound(0, false);
  private engineFilter: BiquadFilterNode | null = null;
  private turbine: OscillatorNode | null = null;
  private turbineGain: GainNode | null = null;
  private driveNoise: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  musicPlaying = false;
  private settings: AudioSettings = {
    muted: false,
    musicEnabled: true,
    musicVolume: 0.45,
    soundVolume: 0.65,
    voiceEnabled: true,
    voiceVolume: 0.8,
  };
  trackIndex = -1;
  trackStatus: 'idle' | 'loading' | 'playing' | 'error' = 'idle';
  voiceStatus = 'loading';
  private buffers = new Map<number, AudioBuffer>();
  private pending = new Map<number, Promise<AudioBuffer>>();
  private source: AudioBufferSourceNode | null = null;
  private trackGain: GainNode | null = null;
  private revision = 0;
  private region = 'solar';
  private voice: SpeechSynthesisVoice | null = null;
  private speaking = false;
  private voiceAt = 0;
  private voiceRevision = 0;
  private voiceBus: GainNode | null = null;
  private voiceSource: AudioBufferSourceNode | null = null;
  private voiceBuffers = new Map<string, Promise<AudioBuffer>>();
  private previousTrack = 0;
  private transitActive = false;
  private nextTimer: ReturnType<typeof setTimeout> | null = null;
  private warpBus: GainNode | null = null;
  private warpSources: AudioScheduledSourceNode[] = [];
  private hoverAt = 0;
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.ratio.value = 5;
    limiter.connect(this.master);
    this.effects = ctx.createGain();
    this.effects.connect(limiter);
    this.music = ctx.createGain();
    this.music.connect(limiter);
    this.voiceBus = ctx.createGain();
    this.voiceBus.connect(limiter);
    this.engine = ctx.createGain();
    this.engine.gain.value = 0;
    const filter = (this.engineFilter = ctx.createBiquadFilter());
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    this.oscillator = ctx.createOscillator();
    this.oscillator.type = 'triangle';
    this.oscillator.frequency.value = 38;
    this.oscillator.connect(filter).connect(this.engine).connect(this.effects);
    this.oscillator.start();
    this.turbine = ctx.createOscillator();
    this.turbine.type = 'sawtooth';
    this.turbineGain = ctx.createGain();
    this.turbineGain.gain.value = 0;
    this.turbine.connect(this.turbineGain).connect(filter);
    this.turbine.start();
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    let low = 0;
    for (let i = 0; i < samples.length; i++) {
      low = (low + (Math.random() * 2 - 1) * 0.08) / 1.08;
      samples[i] = low * 3;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.Q.value = 0.65;
    this.driveNoise = ctx.createGain();
    this.driveNoise.gain.value = 0;
    noise.connect(this.noiseFilter).connect(this.driveNoise).connect(this.engine);
    noise.start();
    void ctx.resume();
    this.refreshVoice();
    if ('speechSynthesis' in window)
      speechSynthesis.addEventListener('voiceschanged', this.refreshVoice);
    void this.playTrack(0);
    for (const cue of LOCAL_MEDIA.voices) void this.prepareVoice(cue).catch(() => {});
  }
  update(speed: number, settings: AudioSettings, active = true, transit = 0) {
    this.settings = settings;
    const profile = (this.engineProfile = engineSound(speed, active, transit));
    if (
      !this.ctx ||
      !this.master ||
      !this.effects ||
      !this.music ||
      !this.engine ||
      !this.oscillator
    )
      return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : 0.55, t, 0.12);
    this.effects.gain.setTargetAtTime(settings.soundVolume, t, 0.12);
    this.voiceBus?.gain.setTargetAtTime(settings.voiceVolume * 1.5, t, 0.08);
    this.music.gain.setTargetAtTime(
      settings.musicEnabled ? settings.musicVolume * (this.speaking ? 0.35 : 1) : 0,
      t,
      0.5,
    );
    if ((settings.muted || !settings.voiceEnabled) && this.speaking) this.stopVoice();
    this.engine.gain.setTargetAtTime(profile.gain, t, 0.2);
    this.oscillator.frequency.setTargetAtTime(profile.fundamental, t, 0.25);
    this.engineFilter?.frequency.setTargetAtTime(profile.cutoff, t, 0.25);
    this.turbine?.frequency.setTargetAtTime(profile.turbine, t, 0.3);
    this.turbineGain?.gain.setTargetAtTime(profile.harmonic, t, 0.2);
    this.driveNoise?.gain.setTargetAtTime(profile.noise, t, 0.25);
    this.noiseFilter?.frequency.setTargetAtTime(180 + profile.turbine * 1.7, t, 0.3);
    this.musicPlaying =
      !settings.muted &&
      settings.musicEnabled &&
      settings.musicVolume > 0 &&
      this.ctx.state === 'running' &&
      this.trackStatus === 'playing';
  }
  get track() {
    return TRACKS[this.trackIndex];
  }
  private refreshVoice = () => {
    if (!('speechSynthesis' in window)) {
      this.voiceStatus = 'unavailable';
      return;
    }
    this.voice = selectEnglishVoice(speechSynthesis.getVoices());
    if (this.voiceStatus !== 'Samantha · local English')
      this.voiceStatus = this.voice ? this.voice.name : 'unavailable';
  };
  stopVoice() {
    ++this.voiceRevision;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (this.voiceSource) {
      try {
        this.voiceSource.stop();
      } catch {}
      this.voiceSource = null;
    }
    this.speaking = false;
  }
  speak(
    cue: 'target' | 'warp' | 'arrive' | 'black_hole' | 'wormhole' | 'abort' | 'stabilize',
    force = false,
  ) {
    if (!this.settings.voiceEnabled || this.settings.muted) return;
    if (!force && performance.now() - this.voiceAt < 1100) return;
    void this.playVoice(cue);
  }
  private prepareVoice(cue: string) {
    if (!LOCAL_MEDIA.voices.includes(cue))
      return Promise.reject(Error('Use browser English voice'));
    if (this.voiceBuffers.has(cue)) return this.voiceBuffers.get(cue)!;
    const promise = fetch(`/audio/voice/${cue}.wav`, { signal: AbortSignal.timeout(8000) })
      .then(async (r) => {
        if (!r.ok || !this.ctx) throw Error('English voice unavailable');
        const buffer = await this.ctx.decodeAudioData(await r.arrayBuffer());
        this.voiceStatus = 'Samantha · local English';
        return buffer;
      })
      .catch((e) => {
        this.voiceBuffers.delete(cue);
        throw e;
      });
    this.voiceBuffers.set(cue, promise);
    return promise;
  }
  private async playVoice(
    cue: 'target' | 'warp' | 'arrive' | 'black_hole' | 'wormhole' | 'abort' | 'stabilize',
  ) {
    this.stopVoice();
    const revision = this.voiceRevision;
    this.voiceAt = performance.now();
    this.speaking = true;
    try {
      const buffer = await this.prepareVoice(
        cue === 'arrive' ? 'arrival' : cue === 'stabilize' ? 'exit' : cue,
      );
      if (revision !== this.voiceRevision || !this.ctx || !this.voiceBus) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.voiceBus);
      this.voiceSource = source;
      source.onended = () => {
        source.disconnect();
        if (revision === this.voiceRevision) {
          this.speaking = false;
          this.voiceSource = null;
        }
      };
      source.start(this.ctx.currentTime + 0.1);
      return;
    } catch {
      if (revision !== this.voiceRevision) return;
      this.speaking = false;
      this.refreshVoice();
    }
    if (!this.voice || !('speechSynthesis' in window)) return;
    const words = {
      target: 'Destination set.',
      warp: 'Ready for warp. Here we go.',
      arrive: 'Welcome. We have arrived.',
      black_hole: 'Approaching the black hole. Hold steady.',
      wormhole: 'The wormhole is open. Let us go.',
      abort: 'All right. Holding here.',
      stabilize: 'We are through. All clear.',
    };
    const utterance = new SpeechSynthesisUtterance(words[cue]);
    utterance.voice = this.voice;
    utterance.lang = this.voice.lang;
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.volume = this.settings.voiceVolume;
    this.speaking = true;
    this.voiceAt = performance.now();
    utterance.onend = utterance.onerror = () => {
      if (revision === this.voiceRevision) this.speaking = false;
    };
    speechSynthesis.speak(utterance);
  }
  async prepare(index: number): Promise<AudioBuffer> {
    if (this.buffers.has(index)) return this.buffers.get(index)!;
    if (this.pending.has(index)) return this.pending.get(index)!;
    if (!this.ctx) throw Error('Audio not started');
    const promise = fetch(`/audio/${TRACKS[index].file || TRACKS[index].id + '.wav'}`, {
      signal: AbortSignal.timeout(10000),
    })
      .then(async (response) => {
        if (!response.ok) throw Error('Soundtrack unavailable');
        const buffer = await this.ctx!.decodeAudioData(await response.arrayBuffer());
        if (TRACKS[index].seconds > 180) this.buffers.clear();
        this.buffers.set(index, buffer);
        for (const key of this.buffers.keys()) {
          if (this.buffers.size <= 3) break;
          if (key !== index && key !== this.trackIndex) this.buffers.delete(key);
        }
        return buffer;
      })
      .finally(() => this.pending.delete(index));
    this.pending.set(index, promise);
    return promise;
  }
  async playTrack(index: number) {
    if (this.nextTimer) clearTimeout(this.nextTimer);
    const revision = ++this.revision;
    this.trackStatus = 'loading';
    try {
      const buffer = await this.prepare(index);
      if (revision !== this.revision || !this.ctx || !this.music) return;
      const ctx = this.ctx,
        t = ctx.currentTime,
        old = this.source,
        oldGain = this.trackGain;
      const source = ctx.createBufferSource(),
        gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(TRACKS[index].supplied ? 0.55 : 0.75, t + 2.5);
      source.connect(gain).connect(this.music);
      this.source = source;
      this.trackGain = gain;
      this.trackIndex = index;
      this.trackStatus = 'playing';
      if (old && oldGain) {
        old.onended = () => {
          old.disconnect();
          oldGain.disconnect();
        };
        oldGain.gain.cancelScheduledValues(t);
        oldGain.gain.setValueAtTime(oldGain.gain.value, t);
        oldGain.gain.linearRampToValueAtTime(0, t + 2.5);
        old.stop(t + 2.6);
      }
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this.source === source) {
          this.source = null;
          void this.playTrack((index + 1) % TRACKS.length);
        }
      };
      source.start();
      this.nextTimer = setTimeout(
        () => {
          void this.playTrack((index + 1) % TRACKS.length);
        },
        Math.max(0, buffer.duration - 3) * 1000,
      );
      const next = (index + 1) % TRACKS.length;
      if (TRACKS[index].seconds <= 180 && TRACKS[next].seconds <= 180)
        void this.prepare(next).catch(() => {});
    } catch {
      if (revision === this.revision) this.trackStatus = 'error';
    }
  }
  nextTrack(direction = 1) {
    this.start();
    void this.playTrack((this.trackIndex + direction + TRACKS.length) % TRACKS.length);
  }
  enterRegion(object: CosmicObject, force = false) {
    const scene = musicScene(object),
      region = scene === 'galaxy' ? object.id : scene;
    this.enterAmbient(scene, region, force);
  }
  enterAmbient(scene: string, region = scene, force = false) {
    if (!this.ctx || (region === this.region && !force)) return;
    this.region = region;
    void this.playTrack(musicIndex(scene, this.trackIndex, region));
  }
  transitMusic(mode: 'black_hole' | 'wormhole') {
    this.previousTrack = Math.max(0, this.trackIndex);
    this.transitActive = true;
    return this.playTrack(musicIndex(mode, this.trackIndex));
  }
  endTransit(object?: CosmicObject) {
    this.stopWarp();
    if (object) this.enterRegion(object, true);
    else if (this.transitActive) void this.playTrack(this.previousTrack);
    this.transitActive = false;
  }
  dispose() {
    ++this.revision;
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.stopVoice();
    if ('speechSynthesis' in window)
      speechSynthesis.removeEventListener('voiceschanged', this.refreshVoice);
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
    }
    this.stopWarp();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.musicPlaying = false;
  }
  private tone(
    frequency: number,
    t: number,
    duration: number,
    volume: number,
    bus: AudioNode,
    type: OscillatorType = 'sine',
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(),
      gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      t + Math.min(0.08, duration * 0.25),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    return osc;
  }
  ping(cue: Cue = 'ui') {
    if (!this.ctx || !this.effects || this.settings.muted) return;
    const t = this.ctx.currentTime;
    if (cue === 'hover') {
      if (t - this.hoverAt < 0.2) return;
      this.hoverAt = t;
      this.tone(620, t, 0.08, 0.018, this.effects);
      return;
    }
    if (cue === 'brake') {
      this.tone(110, t, 0.24, 0.06, this.effects, 'triangle');
      return;
    }
    if (cue === 'arrive') {
      [261.63, 392, 493.88, 587.33].forEach((f, i) =>
        this.tone(f, t + i * 0.16, 1.5, 0.035, this.effects!),
      );
      // A gentle pressure release accompanies the exit, without masking the voice.
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.75, this.ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / data.length) * 0.05;
      const source = this.ctx.createBufferSource(),
        filter = this.ctx.createBiquadFilter();
      source.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      source.connect(filter).connect(this.effects);
      source.start(t);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
      };
      return;
    }
    this.tone(cue === 'select' ? 392 : 440, t, 0.19, 0.04, this.effects);
    this.tone(cue === 'select' ? 587.33 : 659.25, t + 0.08, 0.28, 0.03, this.effects);
  }
  warp(mode: 'warp' | 'black_hole' | 'wormhole' = 'warp') {
    if (!this.ctx || !this.effects || this.settings.muted) return;
    const ctx = this.ctx,
      t = ctx.currentTime,
      duration = mode === 'warp' ? 3.2 : mode === 'black_hole' ? 10 : 8;
    this.stopWarp();
    const bus = ctx.createGain();
    bus.connect(this.effects);
    this.warpBus = bus;
    const sweep = this.tone(
      mode === 'black_hole' ? 38 : 65,
      t,
      duration - 0.1,
      0.08,
      bus,
      'triangle',
    );
    if (sweep) this.warpSources.push(sweep);
    sweep?.frequency.exponentialRampToValueAtTime(
      mode === 'black_hole' ? 490 : 920,
      t + duration * 0.66,
    );
    sweep?.frequency.exponentialRampToValueAtTime(75, t + duration - 0.15);
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate),
      data = buffer.getChannelData(0);
    let seed = 93;
    for (let i = 0; i < data.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      data[i] = ((seed / 4294967296) * 2 - 1) * 0.3;
    }
    const noise = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      pan = ctx.createStereoPanner();
    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.value = 0.5;
    filter.frequency.setValueAtTime(120, t);
    filter.frequency.exponentialRampToValueAtTime(2800, t + duration * 0.69);
    filter.frequency.exponentialRampToValueAtTime(100, t + duration - 0.1);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.24, t + duration * 0.69);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration - 0.05);
    const panCurve = Float32Array.from({ length: 48 }, (_, i) => Math.sin(i * 0.5) * 0.72);
    pan.pan.setValueCurveAtTime(panCurve, t, duration);
    noise.connect(filter).connect(gain).connect(pan).connect(bus);
    if (mode !== 'warp') {
      // Slow gravitational pulses and wide, rising harmonics distinguish the two passages.
      for (let i = 0; i < 5; i++) {
        const delay = 0.7 + (i * duration) / 6;
        const pulse = this.tone(
          mode === 'black_hole' ? 32 + i * 2 : 52 + i * 4,
          t + delay,
          1.8,
          0.08,
          bus,
          'sine',
        );
        if (pulse) this.warpSources.push(pulse);
        const shimmer = this.tone(
          (mode === 'black_hole' ? 190 : 290) * 2 ** (i / 7),
          t + delay,
          0.9,
          0.025,
          bus,
          'sine',
        );
        if (shimmer) {
          shimmer.frequency.setValueAtTime(
            (mode === 'black_hole' ? 190 : 290) * 2 ** (i / 7),
            t + delay,
          );
          shimmer.frequency.exponentialRampToValueAtTime(900 + i * 80, t + delay + 0.85);
          this.warpSources.push(shimmer);
        }
      }
    }
    this.warpSources.push(noise);
    noise.start();
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan.disconnect();
      bus.disconnect();
      if (this.warpBus === bus) {
        this.warpBus = null;
        this.warpSources = [];
      }
    };
  }
  private stopWarp() {
    const t = this.ctx?.currentTime || 0;
    if (this.warpBus) this.warpBus.gain.setTargetAtTime(0, t, 0.025);
    for (const source of this.warpSources) {
      try {
        source.stop(t + 0.12);
      } catch {}
    }
    this.warpSources = [];
  }
}
export const cabin = new CabinAudio();

if (import.meta.hot) import.meta.hot.dispose(() => cabin.dispose());
