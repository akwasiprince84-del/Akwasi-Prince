import React from 'react';
import { Play, Square } from 'lucide-react';
import { DEMO_PHRASES, INSTRUMENT_PRESETS } from '../audio/presets';
import { InstrumentPresetId } from '../types/synth';

interface PresetBankBarProps {
  selectedPresetId: InstrumentPresetId;
  onSelectPreset: (id: InstrumentPresetId) => void;
  playingPhraseId: string | null;
  onTogglePhrase: (phraseId: string) => void;
}

export const PresetBankBar: React.FC<PresetBankBarProps> = ({
  selectedPresetId,
  onSelectPreset,
  playingPhraseId,
  onTogglePhrase,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[#B8B2A6]">
            Sound Sample Banks
          </span>
          <span className="text-xs text-[#6E695F]" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-[#7E786E]">
            Multi-layered acoustic & analog engines
          </span>
        </div>

        {/* Live Audition Phrases */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[#7E786E] mr-1">Audition:</span>
          {DEMO_PHRASES.map((phrase) => {
            const isPlaying = playingPhraseId === phrase.id;
            return (
              <button
                key={phrase.id}
                type="button"
                onClick={() => onTogglePhrase(phrase.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                  isPlaying
                    ? 'bg-[#D4AF37]/15 border-[#D4AF37]/60 text-[#F3D77E]'
                    : 'bg-[#121216] border-white/[0.07] text-[#B8B2A6] hover:text-[#FAF6EC] hover:border-white/[0.16]'
                }`}
              >
                {isPlaying ? (
                  <Square className="w-3 h-3 fill-current" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>{phrase.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 8 Illuminated Hardware Bank Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {INSTRUMENT_PRESETS.map((preset) => {
          const active = preset.id === selectedPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.id)}
              className={`group relative flex flex-col items-start justify-between px-3 py-2.5 rounded-lg border text-left transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                active
                  ? 'bg-gradient-to-b from-[#231E12] to-[#16130C] border-[#D4AF37]/70 shadow-[0_0_18px_rgba(212,175,55,0.12)]'
                  : 'bg-[#121216] border-white/[0.06] hover:border-[#D4AF37]/30 hover:bg-[#17171C]'
              }`}
            >
              <div className="w-full flex items-center justify-between gap-2 mb-1">
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active ? 'text-[#E9CC74]' : 'text-[#6E695F]'
                  }`}
                >
                  0{preset.bankNumber}
                </span>
                {/* Brushed hardware LED bar */}
                <span
                  className={`h-[3px] w-4 rounded-full transition-colors ${
                    active
                      ? 'bg-[#F0D37A] shadow-[0_0_8px_rgba(240,211,122,0.75)]'
                      : 'bg-white/[0.08] group-hover:bg-white/[0.18]'
                  }`}
                />
              </div>
              <span
                className={`text-xs font-semibold truncate w-full ${
                  active ? 'text-[#FAF6EC]' : 'text-[#CFC9BD]'
                }`}
              >
                {preset.name}
              </span>
              <span className="text-[10px] text-[#7E786E] truncate w-full">
                {preset.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
