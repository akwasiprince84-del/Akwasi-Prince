import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Power,
  Usb,
  Volume2,
} from 'lucide-react';
import { exportEventsToMidiBlob } from './audio/midiExport';
import {
  buildChordNotes,
  CHORD_PROGRESSIONS,
  formatChordLabel,
  QWERTY_KEY_MAP,
} from './audio/musicTheory';
import { DEMO_PHRASES, INSTRUMENT_PRESETS } from './audio/presets';
import { soundEngine } from './audio/soundEngine';
import { ModuleRack } from './components/ModuleRack';
import { OledDisplay } from './components/OledDisplay';
import { PianoKeyboard } from './components/PianoKeyboard';
import { PitchModWheels } from './components/PitchModWheels';
import { PresetBankBar } from './components/PresetBankBar';
import {
  ArpConfig,
  ChordLibraryQuality,
  ChordMapperMode,
  CustomArpStep,
  InstrumentPresetId,
  KeybedProfile,
  MidiDeviceInfo,
  RecordedMidiEvent,
  StudioTab,
  SynthParams,
  VelocityCurve,
} from './types/synth';

const PROFILES_STORAGE_KEY = 'goldenkeys_keybed_profiles_v1';
const ACTIVE_PROFILE_STORAGE_KEY = 'goldenkeys_active_profile_v1';

const DEFAULT_PROFILES: KeybedProfile[] = [
  {
    id: 'profile-concert',
    name: 'Concert Grand',
    keyColor: 'ivory-ebony',
    keyTexture: 'gloss',
    ledEffect: 'velocity',
    ledColorHex: '#D4AF37',
    ledIntensity: 0.85,
  },
  {
    id: 'profile-rosewood',
    name: 'Rosewood Salon',
    keyColor: 'rosewood-cream',
    keyTexture: 'matte',
    ledEffect: 'pulse',
    ledColorHex: '#F59E0B',
    ledIntensity: 0.78,
  },
  {
    id: 'profile-obsidian',
    name: 'Obsidian Stage',
    keyColor: 'obsidian-gold',
    keyTexture: 'grain',
    ledEffect: 'steady',
    ledColorHex: '#D4AF37',
    ledIntensity: 0.92,
  },
];

const DEFAULT_CUSTOM_STEPS: CustomArpStep[] = [
  { active: true, octaveOffset: 0, accent: true },
  { active: true, octaveOffset: 0, accent: false },
  { active: true, octaveOffset: 1, accent: false },
  { active: false, octaveOffset: 0, accent: false },
  { active: true, octaveOffset: 0, accent: true },
  { active: true, octaveOffset: 1, accent: false },
  { active: true, octaveOffset: 2, accent: true },
  { active: true, octaveOffset: 1, accent: false },
];

const PROGRESSION_WHITE_KEYS = [60, 62, 64, 65, 67, 69, 71, 72]; // C4..C5

function loadInitialProfiles(): KeybedProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as KeybedProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_PROFILES;
}

function loadInitialActiveProfileId(profiles: KeybedProfile[]): string {
  try {
    const savedId = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    if (savedId && profiles.some((p) => p.id === savedId)) {
      return savedId;
    }
  } catch {
    // ignore
  }
  return profiles[0].id;
}

export default function App() {
  const [selectedPresetId, setSelectedPresetId] =
    useState<InstrumentPresetId>('steinway-grand');

  const currentPreset = useMemo(
    () =>
      INSTRUMENT_PRESETS.find((p) => p.id === selectedPresetId) ??
      INSTRUMENT_PRESETS[0],
    [selectedPresetId]
  );

  const [params, setParams] = useState<SynthParams>(
    () => ({ ...INSTRUMENT_PRESETS[0].defaultParams })
  );
  const [activeTab, setActiveTab] = useState<StudioTab>('sculpt');
  const [audioReady, setAudioReady] = useState(false);

  // Keybed Profiles State (Persisted in localStorage)
  const [profiles, setProfiles] = useState<KeybedProfile[]>(loadInitialProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    loadInitialActiveProfileId(loadInitialProfiles())
  );

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? profiles[0],
    [profiles, activeProfileId]
  );

  useEffect(() => {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
    } catch {
      // ignore storage quota errors
    }
  }, [profiles, activeProfileId]);

  const handleUpdateActiveProfile = useCallback(
    (patch: Partial<KeybedProfile>) => {
      setProfiles((prev) =>
        prev.map((p) => (p.id === activeProfileId ? { ...p, ...patch } : p))
      );
    },
    [activeProfileId]
  );

  const handleCreateProfile = useCallback(
    (name: string) => {
      const id = `profile-${Date.now()}`;
      const newProfile: KeybedProfile = {
        ...activeProfile,
        id,
        name,
      };
      setProfiles((prev) => [...prev, newProfile]);
      setActiveProfileId(id);
    },
    [activeProfile]
  );

  const handleDeleteProfile = useCallback(
    (id: string) => {
      setProfiles((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((p) => p.id !== id);
        if (activeProfileId === id) {
          setActiveProfileId(filtered[0].id);
        }
        return filtered;
      });
    },
    [activeProfileId]
  );

  // Keyboard & performance state
  const [octaveOffset, setOctaveOffset] = useState(0);
  const [keySpan, setKeySpan] = useState<37 | 49 | 61>(49);
  const [sustain, setSustain] = useState(false);
  const [pitchBend, setPitchBend] = useState(0);
  const [modWheel, setModWheel] = useState(0);
  const [velocityCurve, setVelocityCurve] = useState<VelocityCurve>('linear');
  const [showNoteLabels, setShowNoteLabels] = useState(true);
  const [showQwertyHints, setShowQwertyHints] = useState(true);

  // Active sounding & held keys
  const [activeNotes, setActiveNotes] = useState<Set<number>>(() => new Set());
  const [noteVelocities, setNoteVelocities] = useState<Map<number, number>>(
    () => new Map()
  );
  const [lastVelocity, setLastVelocity] = useState(96);
  const heldInputNotesRef = useRef<Set<number>>(new Set());
  const expandedChordMapRef = useRef<Map<number, number[]>>(new Map());

  // Chord Library & Progression Mapper
  const [chordMapperMode, setChordMapperMode] = useState<ChordMapperMode>('off');
  const [selectedChordRoot, setSelectedChordRoot] = useState(0); // 0 = C
  const [selectedChordQuality, setSelectedChordQuality] =
    useState<ChordLibraryQuality>('maj7');
  const [selectedProgressionId, setSelectedProgressionId] = useState(
    CHORD_PROGRESSIONS[0].id
  );

  // Arpeggiator & DAW MIDI Clock Sync
  const [arpConfig, setArpConfig] = useState<ArpConfig>({
    mode: 'off',
    division: '1/8',
    octaves: 1,
    gate: 0.65,
    latch: false,
    clockSync: 'internal',
    customSteps: DEFAULT_CUSTOM_STEPS,
  });
  const [arpPool, setArpPool] = useState<number[]>([]);
  const arpStepRef = useRef(0);
  const arpDirectionRef = useRef<1 | -1>(1);
  const arpTimeoutRef = useRef<number | null>(null);

  // Tempo, DAW Clock, Metronome & Recorder
  const [bpm, setBpm] = useState(110);
  const [dawClockBpm, setDawClockBpm] = useState<number | null>(null);
  const [dawClockActive, setDawClockActive] = useState(false);
  const midiClockTimestampsRef = useRef<number[]>([]);
  const midiClockWatchdogRef = useRef<number | null>(null);

  const [metronomeOn, setMetronomeOn] = useState(false);
  const metronomeBeatRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [recordedEvents, setRecordedEvents] = useState<RecordedMidiEvent[]>([]);
  const recordStartRef = useRef<number>(0);
  const isRecordingRef = useRef(false);
  const playbackTimersRef = useRef<number[]>([]);

  // Demo Phrase Audition
  const [playingPhraseId, setPlayingPhraseId] = useState<string | null>(null);
  const phraseTimersRef = useRef<number[]>([]);
  const auditionTimersRef = useRef<number[]>([]);

  // Hardware Web MIDI Devices
  const [midiDevices, setMidiDevices] = useState<MidiDeviceInfo[]>([]);
  const [midiSupported, setMidiSupported] = useState(true);

  const effectiveBpm =
    arpConfig.clockSync === 'midi' && dawClockActive && dawClockBpm
      ? dawClockBpm
      : bpm;

  useEffect(() => {
    soundEngine.setPreset(currentPreset, params);
  }, [currentPreset, params]);

  useEffect(() => {
    soundEngine.setBpm(effectiveBpm);
  }, [effectiveBpm]);

  useEffect(() => {
    soundEngine.setVelocityCurve(velocityCurve);
  }, [velocityCurve]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const handleInitAudio = useCallback(() => {
    soundEngine.ensureInitialized();
    soundEngine.setPreset(currentPreset, params);
    soundEngine.setBpm(effectiveBpm);
    setAudioReady(true);
  }, [currentPreset, params, effectiveBpm]);

  const handleSelectPreset = useCallback((id: InstrumentPresetId) => {
    const next = INSTRUMENT_PRESETS.find((p) => p.id === id);
    if (!next) return;
    setSelectedPresetId(id);
    setParams({ ...next.defaultParams });
    soundEngine.setPreset(next, next.defaultParams);
  }, []);

  const handleParamChange = useCallback(
    <K extends keyof SynthParams>(key: K, val: SynthParams[K]) => {
      setParams((prev) => {
        const updated = { ...prev, [key]: val };
        soundEngine.applyParams(updated);
        return updated;
      });
    },
    []
  );

  const handleResetParams = useCallback(() => {
    const fresh = { ...currentPreset.defaultParams };
    setParams(fresh);
    soundEngine.applyParams(fresh);
  }, [currentPreset]);

  const triggerSoundOn = useCallback((midi: number, velocity: number) => {
    soundEngine.ensureInitialized();
    setAudioReady(true);
    soundEngine.noteOn(midi, velocity);
    setLastVelocity(velocity);
    setNoteVelocities((prev) => {
      const next = new Map(prev);
      next.set(midi, velocity);
      return next;
    });
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.add(midi);
      return next;
    });
    if (isRecordingRef.current) {
      const timeMs = Math.max(0, performance.now() - recordStartRef.current);
      setRecordedEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          type: 'noteOn',
          note: midi,
          velocity,
          timeMs,
        },
      ]);
    }
  }, []);

  const triggerSoundOff = useCallback((midi: number) => {
    soundEngine.noteOff(midi);
    setActiveNotes((prev) => {
      if (!prev.has(midi)) return prev;
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
    if (isRecordingRef.current) {
      const timeMs = Math.max(0, performance.now() - recordStartRef.current);
      setRecordedEvents((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          type: 'noteOff',
          note: midi,
          velocity: 0,
          timeMs,
        },
      ]);
    }
  }, []);

  // Build Chord Progression Key Mapping when Progression mode is active
  const progressionSlotMap = useMemo(() => {
    const prog =
      CHORD_PROGRESSIONS.find((p) => p.id === selectedProgressionId) ??
      CHORD_PROGRESSIONS[0];
    const map = new Map<
      number,
      { notes: number[]; label: string }
    >();

    PROGRESSION_WHITE_KEYS.forEach((midiKey, idx) => {
      const slot = prog.slots[idx];
      if (!slot) return;
      const rootPc = (selectedChordRoot + slot.rootOffset) % 12;
      const rootMidi = 60 + rootPc;
      map.set(midiKey, {
        notes: buildChordNotes(rootMidi, slot.quality),
        label: formatChordLabel(rootPc, slot.quality),
      });
    });

    return map;
  }, [selectedProgressionId, selectedChordRoot]);

  const progressionLabels = useMemo(() => {
    if (chordMapperMode !== 'progression') return undefined;
    const labels = new Map<number, string>();
    progressionSlotMap.forEach((val, key) => {
      labels.set(key, val.label);
    });
    return labels;
  }, [chordMapperMode, progressionSlotMap]);

  const handleAuditionChord = useCallback(
    (rootMidi: number, quality: ChordLibraryQuality) => {
      auditionTimersRef.current.forEach((t) => clearTimeout(t));
      auditionTimersRef.current = [];
      const notes = buildChordNotes(rootMidi, quality);
      notes.forEach((n, i) => {
        const tOn = window.setTimeout(() => triggerSoundOn(n, 94), i * 18);
        const tOff = window.setTimeout(() => triggerSoundOff(n), 820 + i * 18);
        auditionTimersRef.current.push(tOn, tOff);
      });
    },
    [triggerSoundOn, triggerSoundOff]
  );

  // User-facing note trigger (handles Chord Library, Progression Mapper & Arpeggiator)
  const handleNoteStart = useCallback(
    (midi: number, velocity = 96) => {
      if (midi < 21 || midi > 108) return;

      let expanded: number[] = [midi];
      if (chordMapperMode === 'single-chord') {
        expanded = buildChordNotes(midi, selectedChordQuality);
      } else if (chordMapperMode === 'progression') {
        const mapped = progressionSlotMap.get(midi);
        if (mapped) {
          expanded = mapped.notes;
        }
      }

      expandedChordMapRef.current.set(midi, expanded);

      if (arpConfig.mode !== 'off') {
        soundEngine.ensureInitialized();
        setAudioReady(true);
        if (arpConfig.latch && heldInputNotesRef.current.size === 0) {
          setArpPool(expanded);
          arpStepRef.current = 0;
        } else {
          setArpPool((prev) => {
            const set = new Set(prev);
            expanded.forEach((n) => set.add(n));
            return [...set];
          });
        }
        heldInputNotesRef.current.add(midi);
        return;
      }

      heldInputNotesRef.current.add(midi);
      expanded.forEach((n) => triggerSoundOn(n, velocity));
    },
    [
      arpConfig.mode,
      arpConfig.latch,
      chordMapperMode,
      selectedChordQuality,
      progressionSlotMap,
      triggerSoundOn,
    ]
  );

  const handleNoteStop = useCallback(
    (midi: number) => {
      const expanded = expandedChordMapRef.current.get(midi) ?? [midi];
      expandedChordMapRef.current.delete(midi);
      heldInputNotesRef.current.delete(midi);

      if (arpConfig.mode !== 'off') {
        if (!arpConfig.latch) {
          setArpPool((prev) => prev.filter((n) => !expanded.includes(n)));
        }
        return;
      }

      expanded.forEach((n) => triggerSoundOff(n));
    },
    [arpConfig.mode, arpConfig.latch, triggerSoundOff]
  );

  const handlePanic = useCallback(() => {
    soundEngine.allNotesOff();
    heldInputNotesRef.current.clear();
    expandedChordMapRef.current.clear();
    setArpPool([]);
    setSustain(false);
    setActiveNotes(new Set());
    phraseTimersRef.current.forEach((t) => clearTimeout(t));
    phraseTimersRef.current = [];
    setPlayingPhraseId(null);
    playbackTimersRef.current.forEach((t) => clearTimeout(t));
    playbackTimersRef.current = [];
    setIsPlayingBack(false);
  }, []);

  const handleSustainToggle = useCallback((next: boolean) => {
    setSustain(next);
    soundEngine.setSustain(next);
  }, []);

  const handlePitchBendChange = useCallback((semitones: number) => {
    setPitchBend(semitones);
    soundEngine.setPitchBend(semitones);
  }, []);

  const handleModWheelChange = useCallback((value: number) => {
    setModWheel(value);
    soundEngine.setModWheel(value);
  }, []);

  // Arpeggiator Scheduler (Internal & DAW MIDI Clock synced)
  useEffect(() => {
    if (arpConfig.mode === 'off' || arpPool.length === 0) {
      if (arpTimeoutRef.current) {
        clearTimeout(arpTimeoutRef.current);
        arpTimeoutRef.current = null;
      }
      return;
    }

    const buildSequence = (): number[] => {
      const base =
        arpConfig.mode === 'order'
          ? [...arpPool]
          : [...arpPool].sort((a, b) => a - b);

      const expanded: number[] = [];
      for (let oct = 0; oct < arpConfig.octaves; oct++) {
        base.forEach((n) => {
          const shifted = n + oct * 12;
          if (shifted <= 108) expanded.push(shifted);
        });
      }
      if (arpConfig.mode === 'down') {
        return [...expanded].reverse();
      }
      return expanded;
    };

    const quarterMs = (60 / effectiveBpm) * 1000;
    const stepMs =
      arpConfig.division === '1/4'
        ? quarterMs
        : arpConfig.division === '1/8'
          ? quarterMs / 2
          : arpConfig.division === '1/16'
            ? quarterMs / 4
            : arpConfig.division === '1/32'
              ? quarterMs / 8
              : arpConfig.division === '1/8T'
                ? quarterMs / 3
                : quarterMs / 6;

    const intervalId = window.setInterval(() => {
      const seq = buildSequence();
      if (seq.length === 0) return;

      if (arpConfig.mode === 'custom') {
        const customIdx = arpStepRef.current % arpConfig.customSteps.length;
        const step = arpConfig.customSteps[customIdx];
        arpStepRef.current = (customIdx + 1) % arpConfig.customSteps.length;
        if (!step.active) return;

        const baseNote = seq[customIdx % seq.length];
        const noteToPlay = Math.min(108, baseNote + step.octaveOffset * 12);
        const vel = step.accent ? 118 : 82;
        triggerSoundOn(noteToPlay, vel);
        const gateMs = Math.max(30, stepMs * arpConfig.gate);
        arpTimeoutRef.current = window.setTimeout(() => {
          triggerSoundOff(noteToPlay);
        }, gateMs);
        return;
      }

      let noteToPlay = seq[0];
      if (arpConfig.mode === 'random') {
        noteToPlay = seq[Math.floor(Math.random() * seq.length)];
      } else if (arpConfig.mode === 'updown' && seq.length > 1) {
        if (arpStepRef.current >= seq.length) arpStepRef.current = seq.length - 1;
        if (arpStepRef.current < 0) arpStepRef.current = 0;
        noteToPlay = seq[arpStepRef.current];
        arpStepRef.current += arpDirectionRef.current;
        if (arpStepRef.current >= seq.length - 1) {
          arpDirectionRef.current = -1;
        } else if (arpStepRef.current <= 0) {
          arpDirectionRef.current = 1;
        }
      } else {
        const idx = arpStepRef.current % seq.length;
        noteToPlay = seq[idx];
        arpStepRef.current = (idx + 1) % seq.length;
      }

      triggerSoundOn(noteToPlay, 92);
      const gateMs = Math.max(30, stepMs * arpConfig.gate);
      arpTimeoutRef.current = window.setTimeout(() => {
        triggerSoundOff(noteToPlay);
      }, gateMs);
    }, stepMs);

    return () => {
      clearInterval(intervalId);
      if (arpTimeoutRef.current) {
        clearTimeout(arpTimeoutRef.current);
      }
    };
  }, [arpConfig, arpPool, effectiveBpm, triggerSoundOn, triggerSoundOff]);

  // Metronome Loop
  useEffect(() => {
    if (!metronomeOn) {
      metronomeBeatRef.current = 0;
      return;
    }
    const quarterMs = (60 / effectiveBpm) * 1000;
    soundEngine.playMetronomeClick(true);
    metronomeBeatRef.current = 1;

    const id = window.setInterval(() => {
      const isAccent = metronomeBeatRef.current % 4 === 0;
      soundEngine.playMetronomeClick(isAccent);
      metronomeBeatRef.current = (metronomeBeatRef.current + 1) % 4;
    }, quarterMs);

    return () => clearInterval(id);
  }, [metronomeOn, effectiveBpm]);

  // QWERTY Keyboard Listeners
  const qwertyBaseMidi = useMemo(() => 48 + octaveOffset * 12, [octaveOffset]);

  useEffect(() => {
    const activeCodes = new Map<string, number>();

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleSustainToggle(true);
        return;
      }

      if (e.code === 'BracketLeft' || e.code === 'Minus') {
        e.preventDefault();
        setOctaveOffset((o) => Math.max(-2, o - 1));
        return;
      }
      if (e.code === 'BracketRight' || e.code === 'Equal') {
        e.preventDefault();
        setOctaveOffset((o) => Math.min(2, o + 1));
        return;
      }

      const mapping = QWERTY_KEY_MAP[e.code];
      if (!mapping) return;
      e.preventDefault();
      const midi = qwertyBaseMidi + mapping.offset;
      activeCodes.set(e.code, midi);
      handleNoteStart(midi, 96);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        handleSustainToggle(false);
        return;
      }
      const midi = activeCodes.get(e.code);
      if (midi !== undefined) {
        activeCodes.delete(e.code);
        handleNoteStop(midi);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [qwertyBaseMidi, handleNoteStart, handleNoteStop, handleSustainToggle]);

  // Web MIDI Hardware + DAW MIDI Clock Integration
  const connectMidiHardware = useCallback(async () => {
    if (!('requestMIDIAccess' in navigator)) {
      setMidiSupported(false);
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      const refreshDevices = () => {
        const list: MidiDeviceInfo[] = [];
        access.inputs.forEach((input) => {
          list.push({
            id: input.id,
            name: input.name || 'USB MIDI Controller',
            manufacturer: input.manufacturer || 'Generic',
            state: input.state,
          });
          input.onmidimessage = (msg) => {
            const data = msg.data;
            if (!data || data.length === 0) return;

            // Real-Time MIDI Clock (24 PPQN) & Transport Sync from DAW
            if (data[0] === 0xf8) {
              const now = performance.now();
              const stamps = midiClockTimestampsRef.current;
              stamps.push(now);
              if (stamps.length > 25) stamps.shift();

              if (stamps.length >= 12) {
                const elapsed = stamps[stamps.length - 1] - stamps[0];
                const avgPulseMs = elapsed / (stamps.length - 1);
                if (avgPulseMs > 0) {
                  const computedBpm = Math.round(60_000 / (avgPulseMs * 24));
                  if (computedBpm >= 40 && computedBpm <= 240) {
                    setDawClockBpm(computedBpm);
                    setDawClockActive(true);
                  }
                }
              }
              if (midiClockWatchdogRef.current) {
                clearTimeout(midiClockWatchdogRef.current);
              }
              midiClockWatchdogRef.current = window.setTimeout(() => {
                setDawClockActive(false);
              }, 1500);
              return;
            }
            if (data[0] === 0xfa || data[0] === 0xfb) {
              arpStepRef.current = 0;
              midiClockTimestampsRef.current = [];
              setDawClockActive(true);
              return;
            }
            if (data[0] === 0xfc) {
              setDawClockActive(false);
              return;
            }

            if (data.length < 2) return;
            const status = data[0] & 0xf0;
            const d1 = data[1];
            const d2 = data[2] ?? 0;

            if (status === 0x90 && d2 > 0) {
              handleNoteStart(d1, d2);
            } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
              handleNoteStop(d1);
            } else if (status === 0xb0) {
              if (d1 === 64) {
                handleSustainToggle(d2 >= 64);
              } else if (d1 === 1) {
                handleModWheelChange(d2 / 127);
              }
            } else if (status === 0xe0 && data.length >= 3) {
              const bend14 = (d2 << 7) | d1;
              const normalized = (bend14 - 8192) / 8192;
              handlePitchBendChange(normalized * 2);
            }
          };
        });
        setMidiDevices(list);
      };

      refreshDevices();
      access.onstatechange = refreshDevices;
    } catch {
      setMidiSupported(false);
    }
  }, [
    handleNoteStart,
    handleNoteStop,
    handleSustainToggle,
    handleModWheelChange,
    handlePitchBendChange,
  ]);

  useEffect(() => {
    void connectMidiHardware();
  }, [connectMidiHardware]);

  // Session Recorder Handlers
  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    soundEngine.ensureInitialized();
    setAudioReady(true);
    setRecordedEvents([]);
    recordStartRef.current = performance.now();
    setIsRecording(true);
  }, [isRecording]);

  const stopPlayback = useCallback(() => {
    playbackTimersRef.current.forEach((id) => clearTimeout(id));
    playbackTimersRef.current = [];
    setIsPlayingBack(false);
    soundEngine.allNotesOff();
    setActiveNotes(new Set());
  }, []);

  const handleTogglePlayback = useCallback(() => {
    if (isPlayingBack) {
      stopPlayback();
      return;
    }
    if (recordedEvents.length === 0) return;

    soundEngine.ensureInitialized();
    setAudioReady(true);
    setIsPlayingBack(true);

    const maxTime = Math.max(...recordedEvents.map((e) => e.timeMs)) + 320;
    const schedulePass = () => {
      playbackTimersRef.current = [];
      for (const ev of recordedEvents) {
        const t = window.setTimeout(() => {
          if (ev.type === 'noteOn') {
            soundEngine.noteOn(ev.note, ev.velocity);
            setActiveNotes((prev) => new Set(prev).add(ev.note));
          } else {
            soundEngine.noteOff(ev.note);
            setActiveNotes((prev) => {
              const next = new Set(prev);
              next.delete(ev.note);
              return next;
            });
          }
        }, ev.timeMs);
        playbackTimersRef.current.push(t);
      }

      const loopTimer = window.setTimeout(() => {
        schedulePass();
      }, maxTime);
      playbackTimersRef.current.push(loopTimer);
    };

    schedulePass();
  }, [isPlayingBack, recordedEvents, stopPlayback]);

  const handleExportMidi = useCallback(() => {
    if (recordedEvents.length === 0) return;
    const blob = exportEventsToMidiBlob(recordedEvents, effectiveBpm);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goldenkeys-session-${Date.now()}.mid`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recordedEvents, effectiveBpm]);

  // Audition Phrase Player
  const stopAuditionPhrase = useCallback(() => {
    phraseTimersRef.current.forEach((t) => clearTimeout(t));
    phraseTimersRef.current = [];
    setPlayingPhraseId(null);
    soundEngine.allNotesOff();
    setActiveNotes(new Set());
  }, []);

  const handleTogglePhrase = useCallback(
    (phraseId: string) => {
      if (playingPhraseId === phraseId) {
        stopAuditionPhrase();
        return;
      }
      stopAuditionPhrase();
      const phrase = DEMO_PHRASES.find((p) => p.id === phraseId);
      if (!phrase) return;

      handleSelectPreset(phrase.presetId);
      setBpm(phrase.bpm);
      soundEngine.ensureInitialized();
      setAudioReady(true);
      setPlayingPhraseId(phrase.id);

      const msPerBeat = (60 / phrase.bpm) * 1000;
      let latestMs = 0;

      for (const n of phrase.notes) {
        const onMs = n.startBeat * msPerBeat;
        const offMs = (n.startBeat + n.durationBeats) * msPerBeat;
        if (offMs > latestMs) latestMs = offMs;

        const tOn = window.setTimeout(() => {
          soundEngine.noteOn(n.note, n.velocity);
          setActiveNotes((prev) => new Set(prev).add(n.note));
        }, onMs);
        const tOff = window.setTimeout(() => {
          soundEngine.noteOff(n.note);
          setActiveNotes((prev) => {
            const next = new Set(prev);
            next.delete(n.note);
            return next;
          });
        }, offMs);

        phraseTimersRef.current.push(tOn, tOff);
      }

      const tDone = window.setTimeout(() => {
        setPlayingPhraseId(null);
      }, latestMs + 350);
      phraseTimersRef.current.push(tDone);
    },
    [playingPhraseId, stopAuditionPhrase, handleSelectPreset]
  );

  const startMidi = useMemo(() => {
    if (keySpan === 61) return 36 + octaveOffset * 12;
    return 48 + octaveOffset * 12;
  }, [keySpan, octaveOffset]);

  return (
    <div className="min-h-screen flex flex-col bg-[#08080A] text-[#F4F1EA]">
      {/* Strict 3-Zone Top Bar */}
      <header className="w-full border-b border-white/[0.06] bg-[#0B0B0E]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-3 whitespace-nowrap shrink-0 group"
          >
            <span className="relative w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-[#F3D77E] via-[#D4AF37] to-[#7D5E18] shadow-[0_0_14px_rgba(212,175,55,0.3)] shrink-0">
              <span className="block w-full h-full rounded-full overflow-hidden bg-[#121216] relative">
                <img
                  src="/assets/aistudio/IMG_20260930_181834_524_9b5608f0.jpg"
                  alt="GOLDENKEYS studio logo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-[50%_62%] scale-[1.55]"
                />
                <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-[#FAF6EC]/20 pointer-events-none" />
              </span>
            </span>
            <span className="font-display text-2xl md:text-[26px] font-semibold tracking-[0.14em] text-[#E9CC74] group-hover:text-[#F4DC8B] transition-colors">
              GOLDENKEYS
            </span>
          </a>

          <nav
            aria-label="Studio modules"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#A19B8E]"
          >
            {(
              [
                { id: 'sculpt', label: 'Sound Sculpt' },
                { id: 'effects', label: 'Effects' },
                { id: 'arp', label: 'Arpeggiator' },
                { id: 'chords', label: 'Chord Library' },
                { id: 'keybed', label: 'Keybed' },
              ] as { id: StudioTab; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? 'text-[#FAF6EC] border-[#D4AF37]'
                    : 'border-transparent hover:text-[#FAF6EC]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center shrink-0">
            {!audioReady ? (
              <button
                type="button"
                onClick={handleInitAudio}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#D4AF37] text-[#0A0A0D] hover:bg-[#E7C65E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Power Audio Engine</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePanic}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#18181D] text-[#E9CC74] border border-[#D4AF37]/40 hover:bg-[#231E12] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>All Notes Off</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Luxury Studio Console */}
      <main
        id="top"
        className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-5 md:py-6 flex flex-col gap-5"
      >
        <section
          aria-label="GOLDENKEYS Studio MIDI Workstation"
          className="chassis-surface rounded-2xl border border-[#D4AF37]/20 shadow-[0_28px_70px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col"
        >
          <div className="p-4 md:p-6 flex flex-col gap-5">
            <PresetBankBar
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
              playingPhraseId={playingPhraseId}
              onTogglePhrase={handleTogglePhrase}
            />

            <OledDisplay
              preset={currentPreset}
              activeNotes={[...activeNotes]}
              sustain={sustain}
              pitchBend={pitchBend}
              modWheel={modWheel}
              octaveOffset={octaveOffset}
              bpm={effectiveBpm}
              audioReady={audioReady}
            />

            <ModuleRack
              activeTab={activeTab}
              onTabChange={setActiveTab}
              preset={currentPreset}
              params={params}
              onParamChange={handleParamChange}
              onResetParams={handleResetParams}
              velocityCurve={velocityCurve}
              onVelocityCurveChange={setVelocityCurve}
              arpConfig={arpConfig}
              onArpChange={(k, v) =>
                setArpConfig((prev) => ({ ...prev, [k]: v }))
              }
              dawClockBpm={dawClockBpm}
              dawClockActive={dawClockActive}
              chordMapperMode={chordMapperMode}
              onChordMapperModeChange={setChordMapperMode}
              selectedChordRoot={selectedChordRoot}
              onSelectChordRoot={setSelectedChordRoot}
              selectedChordQuality={selectedChordQuality}
              onSelectChordQuality={setSelectedChordQuality}
              selectedProgressionId={selectedProgressionId}
              onSelectProgressionId={setSelectedProgressionId}
              onAuditionChord={handleAuditionChord}
              profiles={profiles}
              activeProfileId={activeProfileId}
              onSelectProfile={setActiveProfileId}
              onUpdateActiveProfile={handleUpdateActiveProfile}
              onCreateProfile={handleCreateProfile}
              onDeleteProfile={handleDeleteProfile}
              bpm={bpm}
              onBpmChange={setBpm}
              metronomeOn={metronomeOn}
              onToggleMetronome={() => setMetronomeOn((m) => !m)}
              isRecording={isRecording}
              isPlayingBack={isPlayingBack}
              recordedEvents={recordedEvents}
              onToggleRecord={handleToggleRecord}
              onTogglePlayback={handleTogglePlayback}
              onClearRecording={() => {
                stopPlayback();
                setRecordedEvents([]);
              }}
              onExportMidi={handleExportMidi}
            />
          </div>

          {/* Lower Keybed Control Strip */}
          <div className="px-4 md:px-6 py-2.5 bg-[#0C0C0F] border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#8E897E]">Octave</span>
                <div className="flex items-center bg-[#141419] border border-white/[0.07] rounded-md">
                  <button
                    type="button"
                    aria-label="Octave Down"
                    onClick={() => setOctaveOffset((o) => Math.max(-2, o - 1))}
                    disabled={octaveOffset <= -2}
                    className="p-1.5 text-[#C8C2B6] hover:text-[#F2D479] disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-xs text-[#E9CC74] tabular-nums">
                    {octaveOffset >= 0 ? `+${octaveOffset}` : octaveOffset}
                  </span>
                  <button
                    type="button"
                    aria-label="Octave Up"
                    onClick={() => setOctaveOffset((o) => Math.min(2, o + 1))}
                    disabled={octaveOffset >= 2}
                    className="p-1.5 text-[#C8C2B6] hover:text-[#F2D479] disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSustainToggle(!sustain)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  sustain
                    ? 'bg-[#251F11] border-[#D4AF37]/70 text-[#F4DC8B]'
                    : 'bg-[#141419] border-white/[0.07] text-[#A19B8E] hover:text-[#FAF6EC]'
                }`}
              >
                Damper Pedal {sustain ? 'Held' : 'Off'} (Space)
              </button>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#8E897E]">Keys</span>
                <div className="flex items-center bg-[#141419] rounded-md p-0.5 border border-white/[0.07]">
                  {([37, 49, 61] as const).map((span) => (
                    <button
                      key={span}
                      type="button"
                      onClick={() => setKeySpan(span)}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                        keySpan === span
                          ? 'bg-[#262115] text-[#E9CC74]'
                          : 'text-[#8E897E] hover:text-[#FAF6EC]'
                      }`}
                    >
                      {span}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowNoteLabels((s) => !s)}
                className={`px-2.5 py-1 rounded text-xs border transition-colors cursor-pointer whitespace-nowrap ${
                  showNoteLabels
                    ? 'border-[#D4AF37]/40 text-[#E9CC74] bg-[#1D1910]'
                    : 'border-white/[0.07] text-[#8E897E] hover:text-[#FAF6EC]'
                }`}
              >
                Note Names
              </button>

              <button
                type="button"
                onClick={() => setShowQwertyHints((s) => !s)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors cursor-pointer whitespace-nowrap ${
                  showQwertyHints
                    ? 'border-[#D4AF37]/40 text-[#E9CC74] bg-[#1D1910]'
                    : 'border-white/[0.07] text-[#8E897E] hover:text-[#FAF6EC]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Keycaps</span>
              </button>

              <button
                type="button"
                onClick={() => void connectMidiHardware()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-white/[0.07] bg-[#121216] text-[#B8B2A6] hover:border-[#D4AF37]/40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Usb className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {midiDevices.length > 0
                    ? midiDevices[0].name
                    : midiSupported
                      ? 'Scan USB MIDI'
                      : 'Web MIDI Unavailable'}
                </span>
              </button>
            </div>
          </div>

          {/* Walnut Side Cheeks + Pitch/Mod Wheels + Customizable Piano Keybed */}
          <div className="flex items-stretch bg-[#08080A]">
            <div className="hidden sm:block w-5 md:w-7 wood-cheek-left shrink-0" />

            <div className="hidden md:flex items-center px-3 py-3 bg-[#0C0C0F] border-r border-white/[0.06]">
              <PitchModWheels
                pitchBend={pitchBend}
                modWheel={modWheel}
                onPitchBendChange={handlePitchBendChange}
                onModWheelChange={handleModWheelChange}
              />
            </div>

            <div className="flex-1 min-w-0">
              <PianoKeyboard
                startMidi={startMidi}
                keyCount={keySpan}
                activeNotes={activeNotes}
                noteVelocities={noteVelocities}
                lastVelocity={lastVelocity}
                qwertyBaseMidi={qwertyBaseMidi}
                showNoteLabels={showNoteLabels}
                showQwertyHints={showQwertyHints}
                keybedProfile={activeProfile}
                progressionLabels={progressionLabels}
                onNoteStart={handleNoteStart}
                onNoteStop={handleNoteStop}
              />
            </div>

            <div className="hidden sm:block w-5 md:w-7 wood-cheek-right shrink-0" />
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 px-2 pb-2 text-xs text-[#736E64]">
          <div className="flex flex-wrap items-center gap-2">
            <span>GOLDENKEYS Studio Workstation</span>
            <span aria-hidden="true">·</span>
            <span>Profile: {activeProfile.name}</span>
            <span aria-hidden="true">·</span>
            <span>QWERTY: Z–M & Q–P</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Octave: [ / ]</span>
            <span aria-hidden="true">·</span>
            <span>Damper: Space</span>
            <span aria-hidden="true">·</span>
            <span>DAW Clock: {dawClockActive && dawClockBpm ? `${dawClockBpm} BPM` : 'Standby'}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
