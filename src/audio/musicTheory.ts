import {
  ChordLibraryQuality,
  ChordProgressionPreset,
  ChordVoicingMode,
} from '../types/synth';

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${note}${octave}`;
}

export function midiToPitchClass(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

export function midiToFrequency(midi: number, pitchBendSemitones = 0): number {
  return 440 * Math.pow(2, (midi + pitchBendSemitones - 69) / 12);
}

export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export interface ChordDefinition {
  id: ChordLibraryQuality;
  name: string;
  shortLabel: string;
  intervals: number[];
}

export const CHORD_LIBRARY: ChordDefinition[] = [
  { id: 'major', name: 'Major', shortLabel: 'Maj', intervals: [0, 4, 7] },
  { id: 'minor', name: 'Minor', shortLabel: 'm', intervals: [0, 3, 7] },
  { id: 'dom7', name: 'Dominant 7th', shortLabel: '7', intervals: [0, 4, 7, 10] },
  { id: 'maj7', name: 'Major 7th', shortLabel: 'maj7', intervals: [0, 4, 7, 11] },
  { id: 'min7', name: 'Minor 7th', shortLabel: 'm7', intervals: [0, 3, 7, 10] },
  { id: 'dim', name: 'Diminished', shortLabel: 'dim', intervals: [0, 3, 6] },
  { id: 'dim7', name: 'Diminished 7th', shortLabel: 'dim7', intervals: [0, 3, 6, 9] },
  { id: 'm7b5', name: 'Half-Diminished', shortLabel: 'm7b5', intervals: [0, 3, 6, 10] },
  { id: 'aug', name: 'Augmented', shortLabel: 'aug', intervals: [0, 4, 8] },
  { id: 'sus4', name: 'Suspended 4th', shortLabel: 'sus4', intervals: [0, 5, 7] },
  { id: 'sus2', name: 'Suspended 2nd', shortLabel: 'sus2', intervals: [0, 2, 7] },
  { id: 'maj9', name: 'Major 9th', shortLabel: 'maj9', intervals: [0, 4, 7, 11, 14] },
];

export function buildChordNotes(
  rootMidi: number,
  quality: ChordLibraryQuality
): number[] {
  const def = CHORD_LIBRARY.find((c) => c.id === quality) ?? CHORD_LIBRARY[0];
  return def.intervals
    .map((offset) => rootMidi + offset)
    .filter((n) => n >= 21 && n <= 108);
}

export function formatChordLabel(
  rootPitchClass: number,
  quality: ChordLibraryQuality
): string {
  const rootName = NOTE_NAMES[((rootPitchClass % 12) + 12) % 12];
  const def = CHORD_LIBRARY.find((c) => c.id === quality) ?? CHORD_LIBRARY[0];
  if (def.id === 'major') return rootName;
  return `${rootName}${def.shortLabel}`;
}

export const CHORD_PROGRESSIONS: ChordProgressionPreset[] = [
  {
    id: 'jazz-251',
    name: 'Jazz II – V – I – VI',
    genre: 'Jazz Standard',
    slots: [
      { label: 'ii7', rootOffset: 2, quality: 'min7' },
      { label: 'V7', rootOffset: 7, quality: 'dom7' },
      { label: 'Imaj7', rootOffset: 0, quality: 'maj7' },
      { label: 'VI7', rootOffset: 9, quality: 'dom7' },
      { label: 'iii7', rootOffset: 4, quality: 'min7' },
      { label: 'bII7', rootOffset: 1, quality: 'dom7' },
      { label: 'Imaj9', rootOffset: 0, quality: 'maj9' },
      { label: 'iv7', rootOffset: 5, quality: 'min7' },
    ],
  },
  {
    id: 'pop-1564',
    name: 'Studio I – V – vi – IV',
    genre: 'Modern Ballad',
    slots: [
      { label: 'I', rootOffset: 0, quality: 'major' },
      { label: 'V', rootOffset: 7, quality: 'major' },
      { label: 'vi', rootOffset: 9, quality: 'minor' },
      { label: 'IV', rootOffset: 5, quality: 'major' },
      { label: 'ii', rootOffset: 2, quality: 'minor' },
      { label: 'IVmaj7', rootOffset: 5, quality: 'maj7' },
      { label: 'Vsus4', rootOffset: 7, quality: 'sus4' },
      { label: 'Iadd9', rootOffset: 0, quality: 'maj9' },
    ],
  },
  {
    id: 'neosoul-4536',
    name: 'Neo-Soul IV – V – iii – vi',
    genre: 'R&B / Neo-Soul',
    slots: [
      { label: 'IVmaj7', rootOffset: 5, quality: 'maj7' },
      { label: 'V7', rootOffset: 7, quality: 'dom7' },
      { label: 'iii7', rootOffset: 4, quality: 'min7' },
      { label: 'vi7', rootOffset: 9, quality: 'min7' },
      { label: 'ii7', rootOffset: 2, quality: 'min7' },
      { label: 'vii°7', rootOffset: 11, quality: 'm7b5' },
      { label: 'Imaj9', rootOffset: 0, quality: 'maj9' },
      { label: 'bVII7', rootOffset: 10, quality: 'dom7' },
    ],
  },
  {
    id: 'cinematic-minor',
    name: 'Cinematic i – VI – III – VII',
    genre: 'Film Score',
    slots: [
      { label: 'i', rootOffset: 0, quality: 'minor' },
      { label: 'bVI', rootOffset: 8, quality: 'major' },
      { label: 'bIII', rootOffset: 3, quality: 'major' },
      { label: 'bVII', rootOffset: 10, quality: 'major' },
      { label: 'iv', rootOffset: 5, quality: 'minor' },
      { label: 'ii°', rootOffset: 2, quality: 'dim' },
      { label: 'V7', rootOffset: 7, quality: 'dom7' },
      { label: 'i7', rootOffset: 0, quality: 'min7' },
    ],
  },
];

interface ChordPattern {
  intervals: number[];
  suffix: string;
  label: string;
}

const CHORD_PATTERNS: ChordPattern[] = [
  { intervals: [0, 4, 7, 11, 14], suffix: 'maj9', label: 'Major 9th' },
  { intervals: [0, 3, 7, 10, 14], suffix: 'm9', label: 'Minor 9th' },
  { intervals: [0, 4, 7, 10, 14], suffix: '9', label: 'Dominant 9th' },
  { intervals: [0, 4, 7, 11], suffix: 'maj7', label: 'Major 7th' },
  { intervals: [0, 3, 7, 10], suffix: 'm7', label: 'Minor 7th' },
  { intervals: [0, 4, 7, 10], suffix: '7', label: 'Dominant 7th' },
  { intervals: [0, 3, 6, 10], suffix: 'm7b5', label: 'Half-Diminished 7th' },
  { intervals: [0, 3, 6, 9], suffix: 'dim7', label: 'Diminished 7th' },
  { intervals: [0, 4, 7, 14], suffix: 'add9', label: 'Added 9th' },
  { intervals: [0, 4, 7, 9], suffix: '6', label: 'Major 6th' },
  { intervals: [0, 3, 7, 9], suffix: 'm6', label: 'Minor 6th' },
  { intervals: [0, 5, 7, 10], suffix: '7sus4', label: '7th Suspended 4th' },
  { intervals: [0, 4, 7], suffix: '', label: 'Major Triad' },
  { intervals: [0, 3, 7], suffix: 'm', label: 'Minor Triad' },
  { intervals: [0, 3, 6], suffix: 'dim', label: 'Diminished Triad' },
  { intervals: [0, 4, 8], suffix: 'aug', label: 'Augmented Triad' },
  { intervals: [0, 5, 7], suffix: 'sus4', label: 'Suspended 4th' },
  { intervals: [0, 2, 7], suffix: 'sus2', label: 'Suspended 2nd' },
  { intervals: [0, 7], suffix: '5', label: 'Power Interval' },
];

export interface DetectedChord {
  symbol: string;
  quality: string;
}

export function detectChord(activeNotes: number[]): DetectedChord | null {
  if (activeNotes.length === 0) return null;
  const sorted = [...new Set(activeNotes)].sort((a, b) => a - b);

  if (sorted.length === 1) {
    return {
      symbol: midiToNoteName(sorted[0]),
      quality: 'Single Voice',
    };
  }

  const pitchClasses = [...new Set(sorted.map((n) => ((n % 12) + 12) % 12))];
  if (pitchClasses.length === 1) {
    return {
      symbol: `${NOTE_NAMES[pitchClasses[0]]} Oct`,
      quality: 'Octave Unison',
    };
  }

  const bassPc = ((sorted[0] % 12) + 12) % 12;
  const candidateRoots = [
    bassPc,
    ...pitchClasses.filter((pc) => pc !== bassPc),
  ];

  for (const root of candidateRoots) {
    const normalizedIntervals = pitchClasses
      .map((pc) => (pc - root + 12) % 12)
      .sort((a, b) => a - b);

    const hasSecond = normalizedIntervals.includes(2);
    const extendedSet = new Set(normalizedIntervals);
    if (hasSecond && (extendedSet.has(3) || extendedSet.has(4))) {
      extendedSet.add(14);
    }

    for (const pattern of CHORD_PATTERNS) {
      const patternMod = pattern.intervals.map((i) => i % 12);
      const matchesAllPattern = pattern.intervals.every(
        (i) => extendedSet.has(i) || normalizedIntervals.includes(i % 12)
      );
      const sameCardinality =
        normalizedIntervals.length === new Set(patternMod).size;

      if (matchesAllPattern && sameCardinality) {
        const slash = root !== bassPc ? `/${NOTE_NAMES[bassPc]}` : '';
        return {
          symbol: `${NOTE_NAMES[root]}${pattern.suffix}${slash}`,
          quality: pattern.label,
        };
      }
    }
  }

  return {
    symbol: sorted.slice(0, 4).map(midiToPitchClass).join(' · '),
    quality: `${sorted.length}-Voice Cluster`,
  };
}

export function expandChordVoicing(
  rootNote: number,
  mode: ChordVoicingMode
): number[] {
  if (mode === 'off') return [rootNote];
  if (mode === 'triad') return [rootNote, rootNote + 4, rootNote + 7];
  if (mode === 'seventh') {
    return [rootNote, rootNote + 4, rootNote + 7, rootNote + 11];
  }
  return [rootNote, rootNote + 4, rootNote + 7, rootNote + 11, rootNote + 14];
}

export const QWERTY_KEY_MAP: Record<string, { offset: number; label: string }> = {
  KeyZ: { offset: 0, label: 'Z' },
  KeyS: { offset: 1, label: 'S' },
  KeyX: { offset: 2, label: 'X' },
  KeyD: { offset: 3, label: 'D' },
  KeyC: { offset: 4, label: 'C' },
  KeyV: { offset: 5, label: 'V' },
  KeyG: { offset: 6, label: 'G' },
  KeyB: { offset: 7, label: 'B' },
  KeyH: { offset: 8, label: 'H' },
  KeyN: { offset: 9, label: 'N' },
  KeyJ: { offset: 10, label: 'J' },
  KeyM: { offset: 11, label: 'M' },
  Comma: { offset: 12, label: ',' },

  KeyQ: { offset: 12, label: 'Q' },
  Digit2: { offset: 13, label: '2' },
  KeyW: { offset: 14, label: 'W' },
  Digit3: { offset: 15, label: '3' },
  KeyE: { offset: 16, label: 'E' },
  KeyR: { offset: 17, label: 'R' },
  Digit5: { offset: 18, label: '5' },
  KeyT: { offset: 19, label: 'T' },
  Digit6: { offset: 20, label: '6' },
  KeyY: { offset: 21, label: 'Y' },
  Digit7: { offset: 22, label: '7' },
  KeyU: { offset: 23, label: 'U' },
  KeyI: { offset: 24, label: 'I' },
  Digit9: { offset: 25, label: '9' },
  KeyO: { offset: 26, label: 'O' },
  Digit0: { offset: 27, label: '0' },
  KeyP: { offset: 28, label: 'P' },
};
