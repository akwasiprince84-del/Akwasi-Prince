export type InstrumentCategory =
  | 'Acoustic'
  | 'Electric'
  | 'Synthesizer'
  | 'Orchestral'
  | 'Bass'
  | 'Mallet';

export type InstrumentPresetId =
  | 'steinway-grand'
  | 'suitcase-rhodes'
  | 'prophet-gold'
  | 'royal-strings'
  | 'subharmonic-bass'
  | 'baroque-celesta'
  | 'drawbar-organ'
  | 'konzert-vibes';

export type VelocityCurve = 'soft' | 'linear' | 'hard';

export type ArpMode = 'off' | 'up' | 'down' | 'updown' | 'random' | 'order' | 'custom';

export type ArpDivision = '1/4' | '1/8' | '1/16' | '1/32' | '1/8T' | '1/16T';

export type ChordVoicingMode = 'off' | 'triad' | 'seventh' | 'ninth';

export type ChordLibraryQuality =
  | 'major'
  | 'minor'
  | 'dom7'
  | 'maj7'
  | 'min7'
  | 'dim'
  | 'dim7'
  | 'm7b5'
  | 'aug'
  | 'sus4'
  | 'sus2'
  | 'maj9';

export type ChordMapperMode = 'off' | 'single-chord' | 'progression';

export type KeyColorTheme =
  | 'ivory-ebony'
  | 'rosewood-cream'
  | 'obsidian-gold'
  | 'pearl-slate'
  | 'walnut-amber';

export type KeyTexture = 'gloss' | 'matte' | 'grain';

export type LedEffect = 'off' | 'steady' | 'pulse' | 'velocity' | 'aurora';

export interface KeybedProfile {
  id: string;
  name: string;
  keyColor: KeyColorTheme;
  keyTexture: KeyTexture;
  ledEffect: LedEffect;
  ledColorHex: string;
  ledIntensity: number; // 0.2 - 1.0
}

export type StudioTab = 'sculpt' | 'effects' | 'arp' | 'chords' | 'keybed' | 'recorder';

export interface SynthParams {
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  reverbMix: number;
  delayMix: number;
  chorusDepth: number;
  warmth: number;
  masterVolume: number;
  filterEnvAmount: number;
}

export interface InstrumentPreset {
  id: InstrumentPresetId;
  bankNumber: number;
  name: string;
  subtitle: string;
  category: InstrumentCategory;
  engineType:
    | 'piano'
    | 'epiano'
    | 'analog'
    | 'strings'
    | 'bass'
    | 'celesta'
    | 'organ'
    | 'vibes';
  defaultParams: SynthParams;
}

export interface CustomArpStep {
  active: boolean;
  octaveOffset: 0 | 1 | 2;
  accent: boolean;
}

export interface ArpConfig {
  mode: ArpMode;
  division: ArpDivision;
  octaves: number; // 1 | 2 | 3 | 4
  gate: number; // 0.15 - 0.98
  latch: boolean;
  clockSync: 'internal' | 'midi';
  customSteps: CustomArpStep[];
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface RecordedMidiEvent {
  id: string;
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
  timeMs: number;
}

export interface ChordProgressionSlot {
  label: string;
  rootOffset: number; // semitones from selected key root
  quality: ChordLibraryQuality;
}

export interface ChordProgressionPreset {
  id: string;
  name: string;
  genre: string;
  slots: ChordProgressionSlot[];
}
