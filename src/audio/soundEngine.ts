import { InstrumentPreset, SynthParams, VelocityCurve } from '../types/synth';
import { midiToFrequency } from './musicTheory';

interface ActiveVoice {
  note: number;
  velocity: number;
  startTime: number;
  oscillators: OscillatorNode[];
  bufferSources: AudioBufferSourceNode[];
  lfoNodes: OscillatorNode[];
  gains: GainNode[];
  voiceGain: GainNode;
  filter1: BiquadFilterNode;
  filter2: BiquadFilterNode;
  panner: StereoPannerNode;
  baseFreq: number;
  released: boolean;
  sustained: boolean;
  releaseTimeout?: number;
}

interface CustomWaves {
  piano: PeriodicWave;
  epiano: PeriodicWave;
  brass: PeriodicWave;
  strings: PeriodicWave;
  harpsichord: PeriodicWave;
  organ: PeriodicWave;
}

function makeTubeWarmthCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 2048;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const drive = 1 + amount * 8;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    if (amount <= 0.02) {
      curve[i] = x;
    } else {
      // Gentle asymmetric triode saturation for rich even + odd harmonics
      const shifted = x + 0.04 * amount;
      curve[i] =
        (Math.tanh(shifted * drive) - Math.tanh(0.04 * amount * drive)) /
        Math.tanh(drive);
    }
  }
  return curve;
}

function buildScoringStageImpulse(
  ctx: AudioContext,
  durationSec = 3.4,
  decay = 2.6
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const preDelaySamples = Math.floor(sampleRate * 0.02);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp1 = 0;
    let lp2 = 0;
    for (let i = 0; i < length; i++) {
      if (i < preDelaySamples) {
        data[i] = 0;
        continue;
      }
      const t = (i - preDelaySamples) / sampleRate;
      const norm = (i - preDelaySamples) / (length - preDelaySamples);
      const env = Math.pow(1 - norm, decay);
      // Diffuse early studio reflections (20ms - 85ms)
      const earlyCluster =
        t < 0.085 && (i % (ch === 0 ? 313 : 359) < 3) ? 1.45 : 1.0;
      const white = Math.random() * 2 - 1;
      // Progressive two-stage air absorption darkening tail over time
      const damp = Math.max(0.12, 0.55 - norm * 0.4);
      lp1 = lp1 * (1 - damp) + white * damp;
      lp2 = lp2 * 0.55 + lp1 * 0.45;
      data[i] = lp2 * env * earlyCluster * 0.58;
    }
  }
  return impulse;
}

function createStudioNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Slight pink tilt for natural wooden/rosin warmth
    last = last * 0.45 + white * 0.55;
    data[i] = last;
  }
  return buffer;
}

function createPeriodicWaves(ctx: AudioContext): CustomWaves {
  // 1. Concert Grand Piano String Spectrum (warm fundamental + rich 2nd-8th partials)
  const pianoReal = new Float32Array(24);
  const pianoImag = new Float32Array(24);
  const pianoHarmonics = [
    0, 1.0, 0.58, 0.36, 0.24, 0.16, 0.11, 0.075, 0.05, 0.032, 0.022, 0.015,
    0.01, 0.007, 0.004,
  ];
  for (let i = 1; i < pianoHarmonics.length; i++) {
    pianoImag[i] = pianoHarmonics[i];
  }

  // 2. Vintage Electric Piano Body (warm fundamental + gentle 2nd/3rd purr)
  const epReal = new Float32Array(12);
  const epImag = new Float32Array(12);
  const epHarmonics = [0, 1.0, 0.26, 0.12, 0.04, 0.02];
  for (let i = 1; i < epHarmonics.length; i++) {
    epImag[i] = epHarmonics[i];
  }

  // 3. Analog Brass / Prophet Saw (smooth anti-aliased harmonic roll-off)
  const brassReal = new Float32Array(32);
  const brassImag = new Float32Array(32);
  for (let i = 1; i < 32; i++) {
    brassImag[i] = (1 / Math.pow(i, 0.92)) * (i % 2 === 0 ? 0.9 : 1.0);
  }

  // 4. Bowed Orchestral String (warm odd+even balance, silky upper partials)
  const strReal = new Float32Array(28);
  const strImag = new Float32Array(28);
  for (let i = 1; i < 28; i++) {
    strImag[i] = (1 / Math.pow(i, 1.05)) * (i === 2 ? 0.85 : 1.0);
  }

  // 5. Harpsichord / Plucked Celesta (bright upper harmonic shimmer)
  const harpReal = new Float32Array(28);
  const harpImag = new Float32Array(28);
  for (let i = 1; i < 28; i++) {
    harpImag[i] = 1 / Math.pow(i, 0.72);
  }

  // 6. Hammond B3 Tonewheel Drawbar Registration (16', 5-1/3', 8', 4', 2-2/3', 2', 1-3/5', 1')
  // Wait: harmonics relative to 16' sub-fundamental (index 1 = 0.5x, index 2 = 1x, etc.)
  const orgReal = new Float32Array(18);
  const orgImag = new Float32Array(18);
  orgImag[1] = 0.72; // 16'
  orgImag[2] = 0.95; // 8'
  orgImag[3] = 0.62; // 5-1/3'
  orgImag[4] = 0.78; // 4'
  orgImag[6] = 0.44; // 2-2/3'
  orgImag[8] = 0.42; // 2'
  orgImag[10] = 0.24; // 1-3/5'
  orgImag[12] = 0.22; // 1-1/3'
  orgImag[16] = 0.26; // 1'

  return {
    piano: ctx.createPeriodicWave(pianoReal, pianoImag, { disableNormalization: false }),
    epiano: ctx.createPeriodicWave(epReal, epImag, { disableNormalization: false }),
    brass: ctx.createPeriodicWave(brassReal, brassImag, { disableNormalization: false }),
    strings: ctx.createPeriodicWave(strReal, strImag, { disableNormalization: false }),
    harpsichord: ctx.createPeriodicWave(harpReal, harpImag, { disableNormalization: false }),
    organ: ctx.createPeriodicWave(orgReal, orgImag, { disableNormalization: false }),
  };
}

class GoldenKeysSoundEngine {
  private ctx: AudioContext | null = null;
  private waves: CustomWaves | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private voiceBus: GainNode | null = null;
  private warmthNode: WaveShaperNode | null = null;
  private bodyLowShelf: BiquadFilterNode | null = null;
  private harshnessDip: BiquadFilterNode | null = null;
  private airHighShelf: BiquadFilterNode | null = null;
  private dryGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayLeft: DelayNode | null = null;
  private delayRight: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayGain: GainNode | null = null;
  private chorusDelayL: DelayNode | null = null;
  private chorusDelayR: DelayNode | null = null;
  private chorusLfo1: OscillatorNode | null = null;
  private chorusLfo2: OscillatorNode | null = null;
  private chorusDepthL: GainNode | null = null;
  private chorusDepthR: GainNode | null = null;
  private chorusMix: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  private voices: Map<number, ActiveVoice> = new Map();
  private preset: InstrumentPreset | null = null;
  private params: SynthParams | null = null;
  private sustainPedal = false;
  private pitchBendSemitones = 0;
  private modWheel = 0;
  private velocityCurve: VelocityCurve = 'linear';
  private maxPolyphony = 22;

  public ensureInitialized(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.waves = createPeriodicWaves(ctx);
    this.noiseBuffer = createStudioNoiseBuffer(ctx);

    // Voice Sum Bus
    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 0.78;

    // Asymmetric Triode Warmth
    this.warmthNode = ctx.createWaveShaper();
    this.warmthNode.oversample = '4x';
    this.warmthNode.curve = makeTubeWarmthCurve(0.32);

    // Master Acoustic Body & Air EQ
    this.bodyLowShelf = ctx.createBiquadFilter();
    this.bodyLowShelf.type = 'lowshelf';
    this.bodyLowShelf.frequency.value = 115;
    this.bodyLowShelf.gain.value = 2.6;

    this.harshnessDip = ctx.createBiquadFilter();
    this.harshnessDip.type = 'peaking';
    this.harshnessDip.frequency.value = 2500;
    this.harshnessDip.Q.value = 1.1;
    this.harshnessDip.gain.value = -1.8;

    this.airHighShelf = ctx.createBiquadFilter();
    this.airHighShelf.type = 'highshelf';
    this.airHighShelf.frequency.value = 9200;
    this.airHighShelf.gain.value = 1.8;

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 1.0;

    // Scoring Stage True-Stereo Convolution Reverb
    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = buildScoringStageImpulse(ctx, 3.4, 2.55);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.36;

    // Warm Stereo Tape Delay
    this.delayLeft = ctx.createDelay(2.0);
    this.delayRight = ctx.createDelay(2.0);
    this.delayLeft.delayTime.value = 0.32;
    this.delayRight.delayTime.value = 0.48;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.38;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2800;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.14;

    const delayMerger = ctx.createChannelMerger(2);
    this.delayLeft.connect(delayMerger, 0, 0);
    this.delayRight.connect(delayMerger, 0, 1);
    delayMerger.connect(delayFilter);
    delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayLeft);
    this.delayLeft.connect(this.delayRight);
    delayFilter.connect(this.delayGain);

    // Dual-LFO Dimension Stereo Analog Chorus
    this.chorusDelayL = ctx.createDelay(0.1);
    this.chorusDelayR = ctx.createDelay(0.1);
    this.chorusDelayL.delayTime.value = 0.015;
    this.chorusDelayR.delayTime.value = 0.021;

    this.chorusLfo1 = ctx.createOscillator();
    this.chorusLfo1.type = 'sine';
    this.chorusLfo1.frequency.value = 0.48;

    this.chorusLfo2 = ctx.createOscillator();
    this.chorusLfo2.type = 'sine';
    this.chorusLfo2.frequency.value = 0.67;

    this.chorusDepthL = ctx.createGain();
    this.chorusDepthR = ctx.createGain();
    this.chorusDepthL.gain.value = 0.0028;
    this.chorusDepthR.gain.value = 0.0028;

    this.chorusMix = ctx.createGain();
    this.chorusMix.gain.value = 0.25;

    const chorusMerger = ctx.createChannelMerger(2);
    this.chorusLfo1.connect(this.chorusDepthL);
    this.chorusLfo2.connect(this.chorusDepthR);
    this.chorusDepthL.connect(this.chorusDelayL.delayTime);
    this.chorusDepthR.connect(this.chorusDelayR.delayTime);
    this.chorusDelayL.connect(chorusMerger, 0, 0);
    this.chorusDelayR.connect(chorusMerger, 0, 1);
    chorusMerger.connect(this.chorusMix);
    this.chorusLfo1.start();
    this.chorusLfo2.start();

    // Master Output + Bus Limiter + Analyser
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.85;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2.5;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.18;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    // Master Routing
    this.voiceBus.connect(this.warmthNode);
    this.warmthNode.connect(this.bodyLowShelf);
    this.bodyLowShelf.connect(this.harshnessDip);
    this.harshnessDip.connect(this.airHighShelf);

    this.airHighShelf.connect(this.dryGain);
    this.dryGain.connect(this.masterGain);

    this.airHighShelf.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    this.airHighShelf.connect(this.delayLeft);
    this.delayGain.connect(this.masterGain);

    this.airHighShelf.connect(this.chorusDelayL);
    this.airHighShelf.connect(this.chorusDelayR);
    this.chorusMix.connect(this.masterGain);

    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    if (this.params) {
      this.applyParams(this.params);
    }

    return ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public setPreset(preset: InstrumentPreset, params: SynthParams): void {
    this.preset = preset;
    this.applyParams(params);
  }

  public applyParams(params: SynthParams): void {
    this.params = params;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.reverbGain) {
      this.reverbGain.gain.setTargetAtTime(params.reverbMix * 0.95, now, 0.02);
    }
    if (this.delayGain) {
      this.delayGain.gain.setTargetAtTime(params.delayMix * 0.65, now, 0.02);
    }
    if (this.chorusMix) {
      this.chorusMix.gain.setTargetAtTime(params.chorusDepth * 0.72, now, 0.02);
    }
    if (this.warmthNode) {
      this.warmthNode.curve = makeTubeWarmthCurve(params.warmth);
    }
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(params.masterVolume, now, 0.02);
    }

    for (const voice of this.voices.values()) {
      const modCutoffBoost = this.modWheel * 2600;
      const targetCutoff = Math.min(18000, params.cutoff + modCutoffBoost);
      voice.filter1.frequency.setTargetAtTime(targetCutoff, now, 0.03);
      voice.filter2.frequency.setTargetAtTime(targetCutoff * 1.15, now, 0.03);
      voice.filter1.Q.setTargetAtTime(params.resonance, now, 0.03);
    }
  }

  public setBpm(bpm: number): void {
    if (!this.ctx || !this.delayLeft || !this.delayRight) return;
    const quarter = 60 / Math.max(40, Math.min(240, bpm));
    const dottedEighth = quarter * 0.75;
    const now = this.ctx.currentTime;
    this.delayLeft.delayTime.setTargetAtTime(dottedEighth, now, 0.05);
    this.delayRight.delayTime.setTargetAtTime(quarter, now, 0.05);
  }

  public setVelocityCurve(curve: VelocityCurve): void {
    this.velocityCurve = curve;
  }

  public setSustain(active: boolean): void {
    this.sustainPedal = active;
    if (!active) {
      for (const [note, voice] of this.voices.entries()) {
        if (voice.sustained && !voice.released) {
          this.triggerRelease(note, voice);
        }
      }
    }
  }

  public setPitchBend(semitones: number): void {
    this.pitchBendSemitones = semitones;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const voice of this.voices.values()) {
      const ratio = Math.pow(2, semitones / 12);
      voice.oscillators.forEach((osc) => {
        const base =
          (osc as OscillatorNode & { _baseRatio?: number })._baseRatio ?? 1;
        osc.frequency.setTargetAtTime(voice.baseFreq * base * ratio, now, 0.012);
      });
    }
  }

  public setModWheel(value: number): void {
    this.modWheel = Math.max(0, Math.min(1, value));
    if (!this.ctx || !this.params) return;
    const now = this.ctx.currentTime;
    for (const voice of this.voices.values()) {
      voice.gains.forEach((g) => {
        const isLfoGain = (g as GainNode & { _isModLfoGain?: boolean })
          ._isModLfoGain;
        if (isLfoGain) {
          g.gain.setTargetAtTime(this.modWheel * 28, now, 0.02);
        }
      });
      const targetCutoff = Math.min(
        18000,
        this.params.cutoff + this.modWheel * 2600
      );
      voice.filter1.frequency.setTargetAtTime(targetCutoff, now, 0.02);
    }
  }

  private shapeVelocity(rawVel: number): number {
    const norm = Math.max(0.05, Math.min(1, rawVel / 127));
    if (this.velocityCurve === 'soft') return Math.pow(norm, 0.65);
    if (this.velocityCurve === 'hard') return Math.pow(norm, 1.55);
    return norm;
  }

  public noteOn(note: number, rawVelocity = 96): void {
    const ctx = this.ensureInitialized();
    if (!this.preset || !this.params || !this.voiceBus || !this.waves) return;

    if (this.voices.has(note)) {
      this.forceStopVoice(note);
    }

    if (this.voices.size >= this.maxPolyphony) {
      const oldestKey = this.voices.keys().next().value;
      if (oldestKey !== undefined) {
        this.forceStopVoice(oldestKey);
      }
    }

    const now = ctx.currentTime;
    const vel = this.shapeVelocity(rawVelocity);
    const freq = midiToFrequency(note, 0);
    const bentFreq = midiToFrequency(note, this.pitchBendSemitones);
    const params = this.params;
    const engineType = this.preset.engineType;
    const waves = this.waves;

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);

    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.Q.value = params.resonance;

    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.Q.value = Math.max(0.5, params.resonance * 0.55);

    // Subtle acoustic stereo image across keyboard
    const panner = ctx.createStereoPanner();
    const panValue = Math.max(-0.42, Math.min(0.42, ((note - 60) / 36) * 0.36));
    panner.pan.setValueAtTime(panValue, now);

    const oscillators: OscillatorNode[] = [];
    const bufferSources: AudioBufferSourceNode[] = [];
    const lfoNodes: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    // Shared vibrato LFO controlled by Mod Wheel
    const modLfo = ctx.createOscillator();
    modLfo.type = 'sine';
    modLfo.frequency.value = 5.3;
    const modLfoGain = ctx.createGain();
    (modLfoGain as GainNode & { _isModLfoGain?: boolean })._isModLfoGain = true;
    modLfoGain.gain.setValueAtTime(this.modWheel * 28, now);
    modLfo.connect(modLfoGain);
    modLfo.start(now);
    lfoNodes.push(modLfo);
    gains.push(modLfoGain);

    const addWaveOsc = (
      waveOrType: PeriodicWave | OscillatorType,
      ratio: number,
      detuneCents: number,
      level: number,
      decaySec?: number,
      targetNode: AudioNode = filter1
    ) => {
      const osc = ctx.createOscillator() as OscillatorNode & {
        _baseRatio?: number;
      };
      osc._baseRatio = ratio;
      if (typeof waveOrType === 'string') {
        osc.type = waveOrType as OscillatorType;
      } else {
        osc.setPeriodicWave(waveOrType);
      }
      osc.frequency.setValueAtTime(bentFreq * ratio, now);
      osc.detune.setValueAtTime(detuneCents, now);
      modLfoGain.connect(osc.detune);

      const g = ctx.createGain();
      g.gain.setValueAtTime(level, now);
      if (decaySec) {
        g.gain.exponentialRampToValueAtTime(0.0008, now + decaySec);
      }
      osc.connect(g);
      g.connect(targetNode);
      osc.start(now);
      oscillators.push(osc);
      gains.push(g);
      return { osc, gain: g };
    };

    const addNoiseTransient = (
      centerHz: number,
      q: number,
      level: number,
      durationSec: number,
      filterType: BiquadFilterType = 'bandpass'
    ) => {
      if (!this.noiseBuffer) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const nf = ctx.createBiquadFilter();
      nf.type = filterType;
      nf.frequency.setValueAtTime(centerHz, now);
      nf.Q.setValueAtTime(q, now);

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(level, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      src.connect(nf);
      nf.connect(ng);
      ng.connect(voiceGain);
      src.start(now);
      src.stop(now + durationSec + 0.02);
      bufferSources.push(src);
      gains.push(ng);
    };

    // High-note natural acoustic decay scaling (bass sustains longer than treble)
    const registerDecayScale = Math.max(0.45, Math.min(1.5, 1.35 - (note - 36) / 72));

    if (engineType === 'piano') {
      // Steinway Sovereign: 3-string unison chorus + stretch harmonic + felt hammer thump
      addWaveOsc(waves.piano, 1, -1.7, 0.34);
      addWaveOsc(waves.piano, 1, 0, 0.38);
      addWaveOsc(waves.piano, 1, 1.7, 0.34);

      // Natural piano string stretch-tuned upper shimmer (decays faster than fundamental)
      addWaveOsc(
        'sine',
        2.0014,
        0.8,
        0.16 * (0.45 + vel * 0.65),
        1.7 * registerDecayScale
      );
      addWaveOsc(
        'sine',
        3.003,
        -1.0,
        0.07 * vel,
        0.95 * registerDecayScale
      );

      // Soundboard low-mid warmth & felt hammer strike transient
      addNoiseTransient(Math.min(3400, bentFreq * 2.2), 1.4, 0.16 * vel, 0.032, 'bandpass');
      addNoiseTransient(190, 0.9, 0.14 * vel, 0.045, 'lowpass');
    } else if (engineType === 'epiano') {
      // Suitcase 73 MKII: Warm tine body + dual FM bell tine + stereo Suitcase pan
      addWaveOsc(waves.epiano, 1, -1.2, 0.42);
      addWaveOsc(waves.epiano, 1, 1.2, 0.42);
      addWaveOsc('sine', 2, 0, 0.12 * vel, 0.85);

      // Authentic FM bell tine transient (7:1 tine harmonic)
      const carrier = ctx.createOscillator() as OscillatorNode & { _baseRatio?: number };
      carrier._baseRatio = 1;
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(bentFreq, now);

      const modulator = ctx.createOscillator() as OscillatorNode & { _baseRatio?: number };
      modulator._baseRatio = 7;
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(bentFreq * 7.005, now);

      const modIndex = ctx.createGain();
      modIndex.gain.setValueAtTime(bentFreq * (1.2 + vel * 2.2), now);
      modIndex.gain.exponentialRampToValueAtTime(2, now + 0.18);

      const tineGain = ctx.createGain();
      tineGain.gain.setValueAtTime(0.24 * vel, now);
      tineGain.gain.exponentialRampToValueAtTime(0.002, now + 0.65);

      modulator.connect(modIndex);
      modIndex.connect(carrier.frequency);
      carrier.connect(tineGain);
      tineGain.connect(filter1);
      carrier.start(now);
      modulator.start(now);
      oscillators.push(carrier, modulator);
      gains.push(modIndex, tineGain);

      // Subtle bark/mallet thump on hard velocity
      if (vel > 0.55) {
        addNoiseTransient(480, 1.2, 0.09 * vel, 0.028);
      }

      // Suitcase stereo auto-panning vibrato
      const panLfo = ctx.createOscillator();
      panLfo.type = 'sine';
      panLfo.frequency.value = 3.9;
      const panDepth = ctx.createGain();
      panDepth.gain.value = 0.28;
      panLfo.connect(panDepth);
      panDepth.connect(panner.pan);
      panLfo.start(now);
      lfoNodes.push(panLfo);
      gains.push(panDepth);
    } else if (engineType === 'analog') {
      // Prophet Gold Poly: 3-voice stereo unison analog brass + sub + voice drift
      const drift = (Math.random() - 0.5) * 3.5;
      addWaveOsc(waves.brass, 1, -9.5 + drift, 0.34);
      addWaveOsc(waves.brass, 1, 0 + drift, 0.36);
      addWaveOsc(waves.brass, 1, 9.5 + drift, 0.34);
      addWaveOsc('triangle', 0.5, 0, 0.28);

      // Gentle pitch drift envelope on attack (classic analog brass bloom)
      oscillators.forEach((o) => {
        o.detune.setValueAtTime(o.detune.value - 8, now);
        o.detune.exponentialRampToValueAtTime(o.detune.value + 0.01, now + 0.09);
      });
    } else if (engineType === 'strings') {
      // Royal Philharmonic: 5-voice ensemble spread + wooden body formant + bow rosin
      const detunes = [-14, -6.5, 0, 6.5, 14];
      detunes.forEach((d) => {
        addWaveOsc(waves.strings, 1, d, 0.21);
      });
      addWaveOsc(waves.strings, 2, 3, 0.09);
      addWaveOsc('sine', 0.5, 0, 0.16);

      // Independent slow string ensemble vibrato
      const strVib = ctx.createOscillator();
      strVib.type = 'sine';
      strVib.frequency.value = 4.7;
      const strVibDepth = ctx.createGain();
      strVibDepth.gain.setValueAtTime(0, now);
      strVibDepth.gain.linearRampToValueAtTime(8.5, now + Math.max(0.25, params.attack));
      strVib.connect(strVibDepth);
      oscillators.forEach((o) => strVibDepth.connect(o.detune));
      strVib.start(now);
      lfoNodes.push(strVib);
      gains.push(strVibDepth);

      // Bow rosin friction texture during bow attack
      addNoiseTransient(1950, 2.2, 0.045 * vel, 0.18, 'bandpass');
    } else if (engineType === 'bass') {
      // Subharmonic Studio: Deep sub sine + warm triangle + fat detuned saws + pluck
      addWaveOsc('sine', 0.5, 0, 0.58);
      addWaveOsc('triangle', 1, 0, 0.36);
      addWaveOsc(waves.brass, 1, -4.5, 0.28);
      addWaveOsc(waves.brass, 1, 4.5, 0.28);
      addNoiseTransient(320, 1.5, 0.12 * vel, 0.025, 'bandpass');
    } else if (engineType === 'celesta') {
      // Gilded Celesta & Harpsichord: Crystal harmonics + plectrum/felt strike
      addWaveOsc(waves.harpsichord, 1, -1.5, 0.34);
      addWaveOsc(waves.harpsichord, 1, 1.5, 0.34);
      addWaveOsc('sine', 2.0, 0, 0.22, 1.2);
      addWaveOsc('sine', 2.756, 0, 0.08 * vel, 0.55);
      addWaveOsc('sine', 4.0, 0, 0.1 * vel, 0.65);
      addNoiseTransient(4200, 1.8, 0.08 * vel, 0.022, 'bandpass');
    } else if (engineType === 'organ') {
      // B3 Tonewheel: Full drawbar organ wave + 3rd harmonic percussion + key click + Leslie
      addWaveOsc(waves.organ, 1, -1.0, 0.44);
      addWaveOsc(waves.organ, 1, 1.0, 0.44);
      // 3rd harmonic Hammond percussion ping
      addWaveOsc('sine', 3, 0, 0.22 * vel, 0.18);
      // Key-click broadband transient
      addNoiseTransient(2600, 1.2, 0.14 * vel, 0.015, 'bandpass');

      // Leslie Rotary Speaker Simulation (6.1 Hz stereo swirl + subtle Doppler)
      const leslieLfo = ctx.createOscillator();
      leslieLfo.type = 'sine';
      leslieLfo.frequency.value = 6.1;
      const lesliePanDepth = ctx.createGain();
      lesliePanDepth.gain.value = 0.35;
      const lesliePitchDepth = ctx.createGain();
      lesliePitchDepth.gain.value = 7.5;
      leslieLfo.connect(lesliePanDepth);
      leslieLfo.connect(lesliePitchDepth);
      lesliePanDepth.connect(panner.pan);
      oscillators.forEach((o) => lesliePitchDepth.connect(o.detune));
      leslieLfo.start(now);
      lfoNodes.push(leslieLfo);
      gains.push(lesliePanDepth, lesliePitchDepth);
    } else if (engineType === 'vibes') {
      // Konzert Vibraphone: Tuned aluminum bar + inharmonic overtone + motor tremolo
      const { gain: mainG } = addWaveOsc('sine', 1, 0, 0.58);
      addWaveOsc('sine', 1, 1.2, 0.2);
      addWaveOsc('sine', 3.99, 0, 0.14 * vel, 0.85);
      addWaveOsc('sine', 9.1, 0, 0.04 * vel, 0.22);
      addNoiseTransient(680, 1.6, 0.11 * vel, 0.026, 'bandpass');

      const motorLfo = ctx.createOscillator();
      motorLfo.type = 'sine';
      motorLfo.frequency.value = 4.9;
      const motorDepth = ctx.createGain();
      motorDepth.gain.value = 0.18;
      motorLfo.connect(motorDepth);
      motorDepth.connect(mainG.gain);
      motorLfo.start(now);
      lfoNodes.push(motorLfo);
      gains.push(motorDepth);
    }

    // Dynamic Filter Envelope (Velocity + filterEnvAmount)
    const baseCutoff = Math.min(18000, params.cutoff + this.modWheel * 2600);
    const peakCutoff = Math.min(
      19000,
      baseCutoff + params.filterEnvAmount * vel * 7600
    );
    filter1.frequency.setValueAtTime(Math.max(120, baseCutoff * 0.6), now);
    filter1.frequency.exponentialRampToValueAtTime(
      Math.max(180, peakCutoff),
      now + Math.max(0.008, params.attack)
    );
    filter1.frequency.exponentialRampToValueAtTime(
      Math.max(120, baseCutoff),
      now + Math.max(0.02, params.attack) + params.decay * registerDecayScale
    );

    filter2.frequency.setValueAtTime(Math.max(180, peakCutoff * 1.12), now);
    filter2.frequency.exponentialRampToValueAtTime(
      Math.max(150, baseCutoff * 1.12),
      now + Math.max(0.02, params.attack) + params.decay * registerDecayScale
    );

    // Amplitude ADSR Envelope
    const peakLevel = 0.54 * vel;
    const sustainLevel = Math.max(0.0005, peakLevel * params.sustain);
    const attackEnd = now + Math.max(0.002, params.attack);
    const decayEnd = attackEnd + Math.max(0.04, params.decay * registerDecayScale);

    voiceGain.gain.linearRampToValueAtTime(peakLevel, attackEnd);
    voiceGain.gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);

    // Connect voice chain
    filter1.connect(filter2);
    filter2.connect(voiceGain);
    voiceGain.connect(panner);
    panner.connect(this.voiceBus);

    this.voices.set(note, {
      note,
      velocity: rawVelocity,
      startTime: now,
      oscillators,
      bufferSources,
      lfoNodes,
      gains,
      voiceGain,
      filter1,
      filter2,
      panner,
      baseFreq: freq,
      released: false,
      sustained: false,
    });
  }

  public noteOff(note: number): void {
    const voice = this.voices.get(note);
    if (!voice || voice.released) return;

    if (this.sustainPedal) {
      voice.sustained = true;
      return;
    }

    this.triggerRelease(note, voice);
  }

  private triggerRelease(note: number, voice: ActiveVoice): void {
    if (!this.ctx || !this.params) return;
    voice.released = true;
    const now = this.ctx.currentTime;
    const rel = Math.max(0.03, this.params.release);

    voice.voiceGain.gain.cancelScheduledValues(now);
    const currentGain = Math.max(0.0001, voice.voiceGain.gain.value);
    voice.voiceGain.gain.setValueAtTime(currentGain, now);
    voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + rel);

    const stopAt = now + rel + 0.04;
    voice.oscillators.forEach((osc) => {
      try {
        osc.stop(stopAt);
      } catch {
        // already stopped
      }
    });
    voice.lfoNodes.forEach((lfo) => {
      try {
        lfo.stop(stopAt);
      } catch {
        // already stopped
      }
    });

    voice.releaseTimeout = window.setTimeout(() => {
      const current = this.voices.get(note);
      if (current === voice) {
        this.cleanupVoiceNodes(voice);
        this.voices.delete(note);
      }
    }, (rel + 0.08) * 1000);
  }

  private forceStopVoice(note: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    if (voice.releaseTimeout) {
      clearTimeout(voice.releaseTimeout);
    }
    if (this.ctx) {
      const now = this.ctx.currentTime;
      voice.voiceGain.gain.cancelScheduledValues(now);
      voice.voiceGain.gain.setValueAtTime(
        Math.max(0.0001, voice.voiceGain.gain.value),
        now
      );
      voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      const stopAt = now + 0.03;
      voice.oscillators.forEach((o) => {
        try {
          o.stop(stopAt);
        } catch {
          // ignore
        }
      });
      voice.lfoNodes.forEach((l) => {
        try {
          l.stop(stopAt);
        } catch {
          // ignore
        }
      });
    }
    this.cleanupVoiceNodes(voice);
    this.voices.delete(note);
  }

  private cleanupVoiceNodes(voice: ActiveVoice): void {
    try {
      voice.voiceGain.disconnect();
      voice.panner.disconnect();
      voice.filter1.disconnect();
      voice.filter2.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }

  public allNotesOff(): void {
    this.sustainPedal = false;
    for (const note of [...this.voices.keys()]) {
      this.forceStopVoice(note);
    }
  }

  public getActiveVoiceCount(): number {
    return this.voices.size;
  }

  public playMetronomeClick(accent: boolean): void {
    const ctx = this.ensureInitialized();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1320 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(accent ? 660 : 440, now + 0.022);
    gain.gain.setValueAtTime(accent ? 0.16 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.masterGain ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const soundEngine = new GoldenKeysSoundEngine();
