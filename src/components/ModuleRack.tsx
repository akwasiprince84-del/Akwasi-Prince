import React, { useMemo, useState } from 'react';
import {
  Circle,
  Download,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';
import {
  CHORD_LIBRARY,
  CHORD_PROGRESSIONS,
  formatChordLabel,
  NOTE_NAMES,
} from '../audio/musicTheory';
import {
  ArpConfig,
  ArpDivision,
  ArpMode,
  ChordLibraryQuality,
  ChordMapperMode,
  CustomArpStep,
  InstrumentPreset,
  KeybedProfile,
  KeyColorTheme,
  KeyTexture,
  LedEffect,
  RecordedMidiEvent,
  StudioTab,
  SynthParams,
  VelocityCurve,
} from '../types/synth';
import { RotaryKnob } from './RotaryKnob';

interface ModuleRackProps {
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  preset: InstrumentPreset;
  params: SynthParams;
  onParamChange: <K extends keyof SynthParams>(key: K, val: SynthParams[K]) => void;
  onResetParams: () => void;
  velocityCurve: VelocityCurve;
  onVelocityCurveChange: (curve: VelocityCurve) => void;
  arpConfig: ArpConfig;
  onArpChange: <K extends keyof ArpConfig>(key: K, val: ArpConfig[K]) => void;
  dawClockBpm: number | null;
  dawClockActive: boolean;
  chordMapperMode: ChordMapperMode;
  onChordMapperModeChange: (mode: ChordMapperMode) => void;
  selectedChordRoot: number;
  onSelectChordRoot: (pc: number) => void;
  selectedChordQuality: ChordLibraryQuality;
  onSelectChordQuality: (q: ChordLibraryQuality) => void;
  selectedProgressionId: string;
  onSelectProgressionId: (id: string) => void;
  onAuditionChord: (rootMidi: number, quality: ChordLibraryQuality) => void;
  profiles: KeybedProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onUpdateActiveProfile: (patch: Partial<KeybedProfile>) => void;
  onCreateProfile: (name: string) => void;
  onDeleteProfile: (id: string) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  metronomeOn: boolean;
  onToggleMetronome: () => void;
  isRecording: boolean;
  isPlayingBack: boolean;
  recordedEvents: RecordedMidiEvent[];
  onToggleRecord: () => void;
  onTogglePlayback: () => void;
  onClearRecording: () => void;
  onExportMidi: () => void;
}

const ARP_MODES: { id: ArpMode; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'updown', label: 'Up / Down' },
  { id: 'order', label: 'As Played' },
  { id: 'random', label: 'Random' },
  { id: 'custom', label: 'Custom Seq' },
];

const ARP_DIVISIONS: ArpDivision[] = ['1/4', '1/8', '1/16', '1/32', '1/8T', '1/16T'];

const KEY_COLOR_THEMES: { id: KeyColorTheme; label: string; whiteSwatch: string; blackSwatch: string }[] = [
  { id: 'ivory-ebony', label: 'Ivory & Ebony', whiteSwatch: '#FAF7F0', blackSwatch: '#18181D' },
  { id: 'rosewood-cream', label: 'Rosewood & Cream', whiteSwatch: '#F4E8D1', blackSwatch: '#4C1D16' },
  { id: 'obsidian-gold', label: 'Obsidian & Gold', whiteSwatch: '#1C1C22', blackSwatch: '#C9A236' },
  { id: 'pearl-slate', label: 'Pearl & Slate', whiteSwatch: '#F1F5F9', blackSwatch: '#1E293B' },
  { id: 'walnut-amber', label: 'Walnut & Amber', whiteSwatch: '#3B261A', blackSwatch: '#DFBE89' },
];

const KEY_TEXTURES: { id: KeyTexture; label: string }[] = [
  { id: 'gloss', label: 'Smooth Gloss' },
  { id: 'matte', label: 'Matte Satin' },
  { id: 'grain', label: 'Brushed Grain' },
];

const LED_EFFECTS: { id: LedEffect; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'steady', label: 'Steady Glow' },
  { id: 'pulse', label: 'Pulsing Aura' },
  { id: 'velocity', label: 'Velocity Reactive' },
  { id: 'aurora', label: 'Aurora Sweep' },
];

const LED_COLORS: { name: string; hex: string }[] = [
  { name: 'Champagne Gold', hex: '#D4AF37' },
  { name: 'Warm Amber', hex: '#F59E0B' },
  { name: 'Studio Ruby', hex: '#E11D48' },
  { name: 'Royal Sapphire', hex: '#38BDF8' },
  { name: 'Emerald Mint', hex: '#10B981' },
];

export const ModuleRack: React.FC<ModuleRackProps> = ({
  activeTab,
  onTabChange,
  preset,
  params,
  onParamChange,
  onResetParams,
  velocityCurve,
  onVelocityCurveChange,
  arpConfig,
  onArpChange,
  dawClockBpm,
  dawClockActive,
  chordMapperMode,
  onChordMapperModeChange,
  selectedChordRoot,
  onSelectChordRoot,
  selectedChordQuality,
  onSelectChordQuality,
  selectedProgressionId,
  onSelectProgressionId,
  onAuditionChord,
  profiles,
  activeProfileId,
  onSelectProfile,
  onUpdateActiveProfile,
  onCreateProfile,
  onDeleteProfile,
  bpm,
  onBpmChange,
  metronomeOn,
  onToggleMetronome,
  isRecording,
  isPlayingBack,
  recordedEvents,
  onToggleRecord,
  onTogglePlayback,
  onClearRecording,
  onExportMidi,
}) => {
  const [newProfileName, setNewProfileName] = useState('');
  const [showNewProfileInput, setShowNewProfileInput] = useState(false);

  const defaults = preset.defaultParams;
  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  const activeProgression =
    CHORD_PROGRESSIONS.find((p) => p.id === selectedProgressionId) ??
    CHORD_PROGRESSIONS[0];

  const pianoRollBlocks = useMemo(() => {
    if (recordedEvents.length === 0) return { blocks: [], maxMs: 1000 };
    const openNotes = new Map<number, RecordedMidiEvent>();
    const blocks: { note: number; startMs: number; endMs: number }[] = [];
    let maxMs = 0;

    for (const ev of recordedEvents) {
      if (ev.timeMs > maxMs) maxMs = ev.timeMs;
      if (ev.type === 'noteOn') {
        openNotes.set(ev.note, ev);
      } else {
        const start = openNotes.get(ev.note);
        if (start) {
          blocks.push({
            note: ev.note,
            startMs: start.timeMs,
            endMs: Math.max(start.timeMs + 60, ev.timeMs),
          });
          openNotes.delete(ev.note);
        }
      }
    }
    for (const start of openNotes.values()) {
      blocks.push({
        note: start.note,
        startMs: start.timeMs,
        endMs: Math.max(start.timeMs + 220, maxMs),
      });
    }
    return { blocks, maxMs: Math.max(1000, maxMs + 150) };
  }, [recordedEvents]);

  const formatSec = (s: number) =>
    s < 1 ? `${Math.round(s * 1000)}ms` : `${s.toFixed(2)}s`;
  const formatPct = (v: number) => `${Math.round(v * 100)}%`;
  const formatHz = (hz: number) =>
    hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${Math.round(hz)}Hz`;

  const updateCustomStep = (idx: number, patch: Partial<CustomArpStep>) => {
    const next = arpConfig.customSteps.map((s, i) =>
      i === idx ? { ...s, ...patch } : s
    );
    onArpChange('customSteps', next);
  };

  const handleSaveNewProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    onCreateProfile(trimmed);
    setNewProfileName('');
    setShowNewProfileInput(false);
  };

  return (
    <div className="bg-[#101014] border border-white/[0.07] rounded-xl overflow-hidden">
      {/* Rack Module Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0D0D10] border-b border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-1 p-0.5 bg-[#08080A] rounded-lg border border-white/[0.06]">
          {(
            [
              { id: 'sculpt', label: 'Filter & Envelope' },
              { id: 'effects', label: 'Master Effects' },
              { id: 'arp', label: 'Arpeggiator' },
              { id: 'chords', label: 'Chord Library' },
              { id: 'keybed', label: 'Keybed & Profiles' },
              { id: 'recorder', label: 'Phrase Recorder' },
            ] as { id: StudioTab; label: string }[]
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#221D12] text-[#F2D479] border border-[#D4AF37]/40'
                    : 'text-[#8E897E] hover:text-[#EAE5DB] border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-[#8E897E]">
            <span>Velocity Curve</span>
            <div className="flex items-center bg-[#08080A] rounded-md p-0.5 border border-white/[0.06]">
              {(['soft', 'linear', 'hard'] as VelocityCurve[]).map((curve) => (
                <button
                  key={curve}
                  type="button"
                  onClick={() => onVelocityCurveChange(curve)}
                  className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                    velocityCurve === curve
                      ? 'bg-[#262115] text-[#E9CC74]'
                      : 'text-[#7E786E] hover:text-[#D5CFC2]'
                  }`}
                >
                  {curve}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onResetParams}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#A8A295] hover:text-[#FAF6EC] hover:bg-white/[0.05] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Patch</span>
          </button>
        </div>
      </div>

      {/* Rack Body */}
      <div className="p-4 md:px-6 md:py-5">
        {activeTab === 'sculpt' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="text-xs font-medium text-[#C8C2B6]">
                  24dB Ladder Filter
                </span>
                <span className="text-[11px] font-mono text-[#7E786E]">
                  Low-Pass Dual Stage
                </span>
              </div>
              <div className="flex items-center justify-around gap-3 pt-1">
                <RotaryKnob
                  label="Cutoff"
                  value={params.cutoff}
                  min={160}
                  max={16000}
                  defaultValue={defaults.cutoff}
                  logarithmic
                  formatValue={formatHz}
                  onChange={(v) => onParamChange('cutoff', v)}
                  size="lg"
                />
                <RotaryKnob
                  label="Resonance"
                  value={params.resonance}
                  min={0.5}
                  max={12}
                  defaultValue={defaults.resonance}
                  formatValue={(v) => v.toFixed(1)}
                  onChange={(v) => onParamChange('resonance', v)}
                  size="md"
                />
                <RotaryKnob
                  label="Filter Env"
                  value={params.filterEnvAmount}
                  min={0}
                  max={1}
                  defaultValue={defaults.filterEnvAmount}
                  formatValue={formatPct}
                  onChange={(v) => onParamChange('filterEnvAmount', v)}
                  size="md"
                />
              </div>
            </div>

            <div className="hidden lg:block lg:col-span-1 h-24 w-px bg-white/[0.07] mx-auto" />

            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="text-xs font-medium text-[#C8C2B6]">
                  Amplitude Envelope
                </span>
                <span className="text-[11px] font-mono text-[#7E786E]">
                  Attack · Decay · Sustain · Release
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 pt-1">
                <RotaryKnob
                  label="Attack"
                  value={params.attack}
                  min={0.002}
                  max={2.0}
                  defaultValue={defaults.attack}
                  logarithmic
                  formatValue={formatSec}
                  onChange={(v) => onParamChange('attack', v)}
                />
                <RotaryKnob
                  label="Decay"
                  value={params.decay}
                  min={0.05}
                  max={3.5}
                  defaultValue={defaults.decay}
                  logarithmic
                  formatValue={formatSec}
                  onChange={(v) => onParamChange('decay', v)}
                />
                <RotaryKnob
                  label="Sustain"
                  value={params.sustain}
                  min={0.01}
                  max={1.0}
                  defaultValue={defaults.sustain}
                  formatValue={formatPct}
                  onChange={(v) => onParamChange('sustain', v)}
                />
                <RotaryKnob
                  label="Release"
                  value={params.release}
                  min={0.04}
                  max={4.0}
                  defaultValue={defaults.release}
                  logarithmic
                  formatValue={formatSec}
                  onChange={(v) => onParamChange('release', v)}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'effects' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="text-xs font-medium text-[#C8C2B6]">
                  Studio Spatial & Modulation Bus
                </span>
                <span className="text-[11px] font-mono text-[#7E786E]">
                  Hall Convolution · Tape Echo · Analog Chorus
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <RotaryKnob
                  label="Hall Reverb"
                  value={params.reverbMix}
                  min={0}
                  max={1}
                  defaultValue={defaults.reverbMix}
                  formatValue={formatPct}
                  onChange={(v) => onParamChange('reverbMix', v)}
                  size="lg"
                />
                <RotaryKnob
                  label="Tape Delay"
                  value={params.delayMix}
                  min={0}
                  max={1}
                  defaultValue={defaults.delayMix}
                  formatValue={formatPct}
                  onChange={(v) => onParamChange('delayMix', v)}
                />
                <RotaryKnob
                  label="Stereo Chorus"
                  value={params.chorusDepth}
                  min={0}
                  max={1}
                  defaultValue={defaults.chorusDepth}
                  formatValue={formatPct}
                  onChange={(v) => onParamChange('chorusDepth', v)}
                />
                <RotaryKnob
                  label="Tube Warmth"
                  value={params.warmth}
                  min={0}
                  max={1}
                  defaultValue={defaults.warmth}
                  formatValue={formatPct}
                  onChange={(v) => onParamChange('warmth', v)}
                />
              </div>
            </div>

            <div className="hidden lg:block lg:col-span-1 h-24 w-px bg-white/[0.07] mx-auto" />

            <div className="lg:col-span-3 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="text-xs font-medium text-[#C8C2B6]">
                  Master Output
                </span>
                <span className="text-[11px] font-mono text-[#7E786E]">
                  Bus Limiter Active
                </span>
              </div>
              <div className="flex items-center justify-center pt-1">
                <RotaryKnob
                  label="Master Gain"
                  value={params.masterVolume}
                  min={0}
                  max={1}
                  defaultValue={defaults.masterVolume}
                  formatValue={formatPct}
                  onChange={(v) => onParamChange('masterVolume', v)}
                  size="lg"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'arp' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-2.5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[#C8C2B6]">
                  Arpeggiator & Tempo Sync
                </span>
                <div className="flex items-center bg-[#08080A] rounded-md p-0.5 border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => onArpChange('clockSync', 'internal')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      arpConfig.clockSync === 'internal'
                        ? 'bg-[#231E12] text-[#F2D479]'
                        : 'text-[#8E897E] hover:text-[#EAE5DB]'
                    }`}
                  >
                    Internal ({bpm} BPM)
                  </button>
                  <button
                    type="button"
                    onClick={() => onArpChange('clockSync', 'midi')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      arpConfig.clockSync === 'midi'
                        ? 'bg-[#231E12] text-[#F2D479]'
                        : 'text-[#8E897E] hover:text-[#EAE5DB]'
                    }`}
                  >
                    DAW / MIDI Clock{' '}
                    {dawClockActive && dawClockBpm ? `(${dawClockBpm} BPM)` : '(Waiting)'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onArpChange('latch', !arpConfig.latch)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                  arpConfig.latch
                    ? 'bg-[#D4AF37]/20 border-[#D4AF37]/60 text-[#F2D479]'
                    : 'bg-[#08080A] border-white/[0.08] text-[#8E897E] hover:text-[#EAE5DB]'
                }`}
              >
                Latch Hold: {arpConfig.latch ? 'On' : 'Off'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-8 flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-[#8E897E]">Pattern Mode</span>
                  <div className="flex flex-wrap gap-1">
                    {ARP_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onArpChange('mode', m.id)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                          arpConfig.mode === m.id
                            ? 'bg-[#231E12] border-[#D4AF37]/60 text-[#F2D479]'
                            : 'bg-[#0B0B0E] border-white/[0.06] text-[#9C968A] hover:text-[#FAF6EC]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-[#8E897E]">Rate</span>
                  <div className="flex flex-wrap gap-1">
                    {ARP_DIVISIONS.map((div) => (
                      <button
                        key={div}
                        type="button"
                        onClick={() => onArpChange('division', div)}
                        className={`px-2.5 py-1.5 rounded-md font-mono text-xs border transition-colors cursor-pointer ${
                          arpConfig.division === div
                            ? 'bg-[#231E12] border-[#D4AF37]/60 text-[#F2D479]'
                            : 'bg-[#0B0B0E] border-white/[0.06] text-[#9C968A] hover:text-[#FAF6EC]'
                        }`}
                      >
                        {div}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-[#8E897E]">Octaves</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((oct) => (
                      <button
                        key={oct}
                        type="button"
                        onClick={() => onArpChange('octaves', oct)}
                        className={`w-8 py-1.5 rounded-md font-mono text-xs border transition-colors cursor-pointer ${
                          arpConfig.octaves === oct
                            ? 'bg-[#231E12] border-[#D4AF37]/60 text-[#F2D479]'
                            : 'bg-[#0B0B0E] border-white/[0.06] text-[#9C968A] hover:text-[#FAF6EC]'
                        }`}
                      >
                        {oct}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ml-auto">
                  <RotaryKnob
                    label="Gate"
                    value={arpConfig.gate}
                    min={0.15}
                    max={0.98}
                    defaultValue={0.65}
                    formatValue={formatPct}
                    onChange={(v) => onArpChange('gate', v)}
                    size="sm"
                  />
                </div>
              </div>

              {/* 8-Step Custom Sequence Matrix */}
              <div className="lg:col-span-4 flex flex-col gap-1.5 lg:pl-4 lg:border-l lg:border-white/[0.06]">
                <div className="flex items-center justify-between text-[11px] text-[#8E897E]">
                  <span>Custom 8-Step Sequence</span>
                  <span className="font-mono text-[#736E64]">Step · Oct · Accent</span>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {arpConfig.customSteps.map((step, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1 p-1 rounded bg-[#0A0A0D] border border-white/[0.06]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          updateCustomStep(i, { active: !step.active })
                        }
                        className={`w-full h-5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                          step.active
                            ? 'bg-[#D4AF37] text-[#09090B] font-semibold'
                            : 'bg-[#18181D] text-[#6E695F]'
                        }`}
                      >
                        {i + 1}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateCustomStep(i, {
                            octaveOffset: ((step.octaveOffset + 1) % 3) as 0 | 1 | 2,
                          })
                        }
                        className="w-full py-0.5 rounded text-[9px] font-mono bg-[#141418] text-[#B8B2A6] hover:text-[#F2D479] cursor-pointer"
                        title="Cycle octave shift"
                      >
                        +{step.octaveOffset}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateCustomStep(i, { accent: !step.accent })
                        }
                        className={`w-full py-0.5 rounded text-[9px] font-mono cursor-pointer ${
                          step.accent
                            ? 'bg-[#2C2412] text-[#F4DC8B]'
                            : 'bg-[#141418] text-[#6E695F]'
                        }`}
                        title="Toggle accent velocity"
                      >
                        {step.accent ? 'Acc' : '—'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chords' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Chord Library Picker & Single-Key Mode */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5">
                <span className="text-xs font-medium text-[#C8C2B6]">
                  MIDI Chord Library
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onChordMapperModeChange(
                        chordMapperMode === 'single-chord' ? 'off' : 'single-chord'
                      )
                    }
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      chordMapperMode === 'single-chord'
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37]/70 text-[#F4DC8B]'
                        : 'bg-[#0B0B0E] border-white/[0.07] text-[#9C968A] hover:text-[#FAF6EC]'
                    }`}
                  >
                    Single-Key Chord Trigger:{' '}
                    {chordMapperMode === 'single-chord' ? 'Active' : 'Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAuditionChord(60 + selectedChordRoot, selectedChordQuality)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#D4AF37] text-[#09090B] hover:bg-[#E7C65E] cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>
                      Play {formatChordLabel(selectedChordRoot, selectedChordQuality)}
                    </span>
                  </button>
                </div>
              </div>

              {/* Root Note Selector */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[#8E897E]">Root Note</span>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                  {NOTE_NAMES.map((name, pc) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => onSelectChordRoot(pc)}
                      className={`py-1.5 rounded font-mono text-xs border transition-colors cursor-pointer ${
                        selectedChordRoot === pc
                          ? 'bg-[#231E12] border-[#D4AF37]/60 text-[#F2D479] font-semibold'
                          : 'bg-[#0B0B0E] border-white/[0.06] text-[#9C968A] hover:text-[#FAF6EC]'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chord Quality Grid */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[#8E897E]">Chord Type</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {CHORD_LIBRARY.map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      onClick={() => onSelectChordQuality(def.id)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium border text-left transition-colors cursor-pointer truncate ${
                        selectedChordQuality === def.id
                          ? 'bg-[#231E12] border-[#D4AF37]/60 text-[#F2D479]'
                          : 'bg-[#0B0B0E] border-white/[0.06] text-[#9C968A] hover:text-[#FAF6EC]'
                      }`}
                    >
                      {def.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Chord Progression Key Mapper */}
            <div className="lg:col-span-6 flex flex-col gap-3 lg:pl-4 lg:border-l lg:border-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5">
                <span className="text-xs font-medium text-[#C8C2B6]">
                  Progression Key Mapper
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChordMapperModeChange(
                      chordMapperMode === 'progression' ? 'off' : 'progression'
                    )
                  }
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    chordMapperMode === 'progression'
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37]/70 text-[#F4DC8B]'
                      : 'bg-[#0B0B0E] border-white/[0.07] text-[#9C968A] hover:text-[#FAF6EC]'
                  }`}
                >
                  Map Progression to White Keys (C4–C5):{' '}
                  {chordMapperMode === 'progression' ? 'Active' : 'Off'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {CHORD_PROGRESSIONS.map((prog) => (
                  <button
                    key={prog.id}
                    type="button"
                    onClick={() => onSelectProgressionId(prog.id)}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      selectedProgressionId === prog.id
                        ? 'bg-[#231E12] border-[#D4AF37]/60'
                        : 'bg-[#0B0B0E] border-white/[0.06] hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#FAF6EC] truncate">
                      {prog.name}
                    </div>
                    <div className="text-[10px] text-[#8E897E]">{prog.genre}</div>
                  </button>
                ))}
              </div>

              {/* Mapped Progression Trigger Pads */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[#8E897E]">
                  Mapped Keys (Click pad or press C4–C5 white keys in {NOTE_NAMES[selectedChordRoot]})
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {activeProgression.slots.map((slot, idx) => {
                    const slotRootPc = (selectedChordRoot + slot.rootOffset) % 12;
                    const chordName = formatChordLabel(slotRootPc, slot.quality);
                    const whiteKeys = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
                    return (
                      <button
                        key={`${slot.label}-${idx}`}
                        type="button"
                        onClick={() =>
                          onAuditionChord(60 + slotRootPc, slot.quality)
                        }
                        className="flex flex-col items-center justify-center py-2 px-1 rounded-md bg-[#131318] border border-white/[0.07] hover:border-[#D4AF37]/60 transition-colors cursor-pointer"
                      >
                        <span className="text-[9px] font-mono text-[#7E786E]">
                          {whiteKeys[idx]}
                        </span>
                        <span className="text-xs font-semibold text-[#E9CC74] truncate max-w-full">
                          {chordName}
                        </span>
                        <span className="text-[9px] text-[#9C968A]">
                          {slot.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'keybed' && (
          <div className="flex flex-col gap-4">
            {/* Saved User Profiles Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#C8C2B6] mr-1">
                  User Profiles
                </span>
                {profiles.map((prof) => {
                  const active = prof.id === activeProfile.id;
                  return (
                    <div key={prof.id} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => onSelectProfile(prof.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#231E12] border-[#D4AF37]/65 text-[#F2D479]'
                            : 'bg-[#0B0B0E] border-white/[0.07] text-[#9C968A] hover:text-[#FAF6EC]'
                        }`}
                      >
                        {prof.name}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                {showNewProfileInput ? (
                  <form onSubmit={handleSaveNewProfile} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="Profile name..."
                      maxLength={24}
                      autoFocus
                      className="px-2.5 py-1 rounded bg-[#08080A] border border-[#D4AF37]/50 text-xs text-[#FAF6EC] focus:outline-none w-36"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-[#D4AF37] text-[#09090B] cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewProfileInput(false)}
                      className="px-2 py-1 rounded text-xs text-[#8E897E] hover:text-[#FAF6EC] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowNewProfileInput(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#141419] border border-white/[0.08] text-[#E9CC74] hover:border-[#D4AF37]/50 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Profile</span>
                    </button>
                    {profiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteProfile(activeProfile.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#8E897E] hover:text-[#FF7B85] hover:bg-white/[0.04] cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Keybed Customization Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Key Colors */}
              <div className="lg:col-span-5 flex flex-col gap-2">
                <span className="text-[11px] text-[#8E897E]">Key Material & Color</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {KEY_COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => onUpdateActiveProfile({ keyColor: theme.id })}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        activeProfile.keyColor === theme.id
                          ? 'bg-[#231E12] border-[#D4AF37]/65 text-[#F2D479]'
                          : 'bg-[#0B0B0E] border-white/[0.06] text-[#A8A295] hover:text-[#FAF6EC]'
                      }`}
                    >
                      <span className="flex items-center shrink-0 rounded overflow-hidden border border-white/15">
                        <span
                          className="w-2.5 h-4"
                          style={{ backgroundColor: theme.whiteSwatch }}
                        />
                        <span
                          className="w-2 h-4"
                          style={{ backgroundColor: theme.blackSwatch }}
                        />
                      </span>
                      <span className="text-xs font-medium truncate">
                        {theme.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Key Surface Texture */}
              <div className="lg:col-span-2 flex flex-col gap-2">
                <span className="text-[11px] text-[#8E897E]">Key Surface Texture</span>
                <div className="flex flex-col gap-1.5">
                  {KEY_TEXTURES.map((tex) => (
                    <button
                      key={tex.id}
                      type="button"
                      onClick={() => onUpdateActiveProfile({ keyTexture: tex.id })}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border text-left transition-colors cursor-pointer ${
                        activeProfile.keyTexture === tex.id
                          ? 'bg-[#231E12] border-[#D4AF37]/65 text-[#F2D479]'
                          : 'bg-[#0B0B0E] border-white/[0.06] text-[#9C968A] hover:text-[#FAF6EC]'
                      }`}
                    >
                      {tex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* LED Lighting Effects & Color */}
              <div className="lg:col-span-5 flex flex-col gap-2 lg:pl-4 lg:border-l lg:border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8E897E]">
                    Keybed LED Lighting Effect
                  </span>
                  <div className="flex items-center gap-1.5">
                    {LED_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.name}
                        aria-label={`LED Color ${c.name}`}
                        onClick={() => onUpdateActiveProfile({ ledColorHex: c.hex })}
                        className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                          activeProfile.ledColorHex === c.hex
                            ? 'border-white scale-115'
                            : 'border-white/20 opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {LED_EFFECTS.map((fx) => (
                      <button
                        key={fx.id}
                        type="button"
                        onClick={() => onUpdateActiveProfile({ ledEffect: fx.id })}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium border text-left transition-colors cursor-pointer truncate ${
                          activeProfile.ledEffect === fx.id
                            ? 'bg-[#231E12] border-[#D4AF37]/65 text-[#F2D479]'
                            : 'bg-[#0B0B0E] border-white/[0.06] text-[#9C968A] hover:text-[#FAF6EC]'
                        }`}
                      >
                        {fx.label}
                      </button>
                    ))}
                  </div>

                  <RotaryKnob
                    label="LED Glow"
                    value={activeProfile.ledIntensity}
                    min={0.2}
                    max={1}
                    defaultValue={0.85}
                    formatValue={formatPct}
                    onChange={(v) => onUpdateActiveProfile({ ledIntensity: v })}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recorder' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="text-xs font-medium text-[#C8C2B6]">
                  Studio MIDI Capture
                </span>
                <span className="font-mono text-[11px] text-[#8E897E] tabular-nums">
                  {Math.floor(recordedEvents.length / 2)} Notes Recorded
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleRecord}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    isRecording
                      ? 'bg-[#451418] border-[#DC4A54] text-[#FFD5D8]'
                      : 'bg-[#171212] border-white/[0.08] text-[#E5C158] hover:border-[#D4AF37]/45'
                  }`}
                >
                  <Circle
                    className={`w-3 h-3 ${
                      isRecording ? 'fill-[#FF5C67] text-[#FF5C67]' : 'fill-current'
                    }`}
                  />
                  <span>{isRecording ? 'Stop Rec' : 'Record'}</span>
                </button>

                <button
                  type="button"
                  disabled={recordedEvents.length === 0 || isRecording}
                  onClick={onTogglePlayback}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                    isPlayingBack
                      ? 'bg-[#262011] border-[#D4AF37] text-[#F5DC8B]'
                      : 'bg-[#141419] border-white/[0.08] text-[#EAE5DB] hover:border-white/[0.2]'
                  }`}
                >
                  {isPlayingBack ? (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{isPlayingBack ? 'Stop Loop' : 'Play Phrase'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleMetronome}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    metronomeOn
                      ? 'bg-[#231E12] border-[#D4AF37]/60 text-[#F2D479]'
                      : 'bg-[#0D0D10] border-white/[0.07] text-[#9C968A] hover:text-[#FAF6EC]'
                  }`}
                >
                  Click: {metronomeOn ? 'On' : 'Off'}
                </button>

                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#09090C] border border-white/[0.06]">
                  <span className="text-[11px] text-[#7E786E]">BPM</span>
                  <input
                    type="number"
                    min={40}
                    max={240}
                    value={bpm}
                    onChange={(e) =>
                      onBpmChange(
                        Math.max(40, Math.min(240, Number(e.target.value) || 110))
                      )
                    }
                    className="w-12 bg-transparent font-mono text-xs text-[#E9CC74] text-right focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={recordedEvents.length === 0}
                  onClick={onExportMidi}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#D4AF37] text-[#0B0B0D] hover:bg-[#E5C158] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Standard MIDI (.mid)</span>
                </button>

                <button
                  type="button"
                  disabled={recordedEvents.length === 0}
                  onClick={onClearRecording}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#9C968A] hover:text-[#FAF6EC] hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#7E786E]">
                <span>Phrase Piano Roll</span>
                <span className="font-mono tabular-nums">
                  {recordedEvents.length > 0
                    ? `${(pianoRollBlocks.maxMs / 1000).toFixed(1)}s Phrase`
                    : 'Press Record and play keys to capture MIDI'}
                </span>
              </div>
              <div className="h-[92px] w-full rounded-lg bg-[#060608] border border-white/[0.06] relative overflow-hidden">
                {pianoRollBlocks.blocks.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#615C54]">
                    Recorded MIDI notes appear here in real time
                  </div>
                ) : (
                  <svg
                    className="w-full h-full"
                    viewBox="0 0 600 92"
                    preserveAspectRatio="none"
                  >
                    {[23, 46, 69].map((y) => (
                      <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2="600"
                        y2={y}
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth="1"
                      />
                    ))}
                    {pianoRollBlocks.blocks.map((b, idx) => {
                      const x = (b.startMs / pianoRollBlocks.maxMs) * 588 + 6;
                      const w = Math.max(
                        4,
                        ((b.endMs - b.startMs) / pianoRollBlocks.maxMs) * 588
                      );
                      const clampedMidi = Math.max(36, Math.min(96, b.note));
                      const y = 82 - ((clampedMidi - 36) / 60) * 74;
                      return (
                        <rect
                          key={`${idx}-${b.note}-${b.startMs}`}
                          x={x}
                          y={y}
                          width={w}
                          height={4.5}
                          rx={1.5}
                          fill="#E5C158"
                          opacity={0.9}
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
