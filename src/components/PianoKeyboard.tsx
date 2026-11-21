import React, { useMemo, useRef } from 'react';
import { isBlackKey, midiToNoteName, QWERTY_KEY_MAP } from '../audio/musicTheory';
import { KeybedProfile } from '../types/synth';

interface PianoKeyboardProps {
  startMidi: number;
  keyCount: number;
  activeNotes: Set<number>;
  noteVelocities: Map<number, number>;
  lastVelocity: number;
  qwertyBaseMidi: number;
  showNoteLabels: boolean;
  showQwertyHints: boolean;
  keybedProfile: KeybedProfile;
  progressionLabels?: Map<number, string>;
  onNoteStart: (midi: number, velocity: number) => void;
  onNoteStop: (midi: number) => void;
}

const BLACK_KEY_OFFSETS: Record<number, number> = {
  1: 0.62,
  3: 0.72,
  6: 0.6,
  8: 0.67,
  10: 0.74,
};

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  startMidi,
  keyCount,
  activeNotes,
  noteVelocities,
  lastVelocity,
  qwertyBaseMidi,
  showNoteLabels,
  showQwertyHints,
  keybedProfile,
  progressionLabels,
  onNoteStart,
  onNoteStop,
}) => {
  const activePointersRef = useRef<Map<number, number>>(new Map());

  const qwertyByMidi = useMemo(() => {
    const map = new Map<number, string>();
    for (const entry of Object.values(QWERTY_KEY_MAP)) {
      map.set(qwertyBaseMidi + entry.offset, entry.label);
    }
    return map;
  }, [qwertyBaseMidi]);

  const keys = useMemo(() => {
    const whiteKeys: number[] = [];
    const blackKeys: { midi: number; leftWhiteIndex: number; offsetRatio: number }[] = [];

    for (let i = 0; i < keyCount; i++) {
      const midi = startMidi + i;
      if (isBlackKey(midi)) {
        const pc = ((midi % 12) + 12) % 12;
        blackKeys.push({
          midi,
          leftWhiteIndex: whiteKeys.length - 1,
          offsetRatio: BLACK_KEY_OFFSETS[pc] ?? 0.66,
        });
      } else {
        whiteKeys.push(midi);
      }
    }
    return { whiteKeys, blackKeys };
  }, [startMidi, keyCount]);

  const computeVelocity = (el: HTMLElement, clientY: number): number => {
    const rect = el.getBoundingClientRect();
    const relY = Math.max(0.15, Math.min(1, (clientY - rect.top) / rect.height));
    return Math.round(52 + relY * 75);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, midi: number) => {
    e.preventDefault();
    e.stopPropagation();
    const velocity = computeVelocity(e.currentTarget, e.clientY);
    activePointersRef.current.set(e.pointerId, midi);
    onNoteStart(midi, velocity);
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prevMidi = activePointersRef.current.get(e.pointerId);
    if (prevMidi === undefined) return;

    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const keyEl = target?.closest('[data-midi]') as HTMLElement | null;
    if (!keyEl) return;

    const nextMidi = Number(keyEl.dataset.midi);
    if (!Number.isNaN(nextMidi) && nextMidi !== prevMidi) {
      onNoteStop(prevMidi);
      activePointersRef.current.set(e.pointerId, nextMidi);
      const velocity = computeVelocity(keyEl, e.clientY);
      onNoteStart(nextMidi, velocity);
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const midi = activePointersRef.current.get(e.pointerId);
    if (midi !== undefined) {
      onNoteStop(midi);
      activePointersRef.current.delete(e.pointerId);
    }
  };

  const totalWhites = keys.whiteKeys.length;
  const whiteWidthPct = 100 / totalWhites;
  const blackWidthPct = whiteWidthPct * 0.6;

  const { keyColor, keyTexture, ledEffect, ledColorHex, ledIntensity } = keybedProfile;
  const whiteThemeClass = `key-theme-${keyColor}-white`;
  const blackThemeClass = `key-theme-${keyColor}-black`;
  const textureClass = `key-texture-${keyTexture}`;

  // Fallboard LED rail styling
  const velocityRatio = activeNotes.size > 0 ? Math.max(0.25, lastVelocity / 127) : 0.12;
  const fallboardLedOpacity =
    ledEffect === 'off'
      ? 0
      : ledEffect === 'velocity'
        ? velocityRatio * ledIntensity
        : ledIntensity;

  const getKeyLedStyle = (midi: number, isActive: boolean): React.CSSProperties => {
    if (ledEffect === 'off') return {};
    if (!isActive) {
      if (ledEffect === 'steady' || ledEffect === 'pulse') {
        return {
          boxShadow: `inset 0 2px 6px -2px ${ledColorHex}33`,
        };
      }
      return {};
    }

    const vel = (noteVelocities.get(midi) ?? 96) / 127;
    const strength =
      ledEffect === 'velocity'
        ? Math.max(0.35, vel) * ledIntensity
        : ledIntensity;
    const glowColor = ledEffect === 'aurora' ? '#38BDF8' : ledColorHex;
    const alphaHex = Math.round(Math.min(1, strength) * 210)
      .toString(16)
      .padStart(2, '0');

    return {
      boxShadow: `inset 0 0 14px ${glowColor}${alphaHex}, 0 0 18px ${glowColor}${alphaHex}`,
    };
  };

  return (
    <div className="relative flex flex-col select-none touch-none">
      {/* Fallboard Crimson Felt & Programmable LED Lightbar */}
      <div className="h-4 w-full bg-gradient-to-b from-[#08080A] via-[#3A0E14] to-[#56141C] border-t border-white/[0.06] flex items-center justify-center relative overflow-hidden">
        {ledEffect !== 'off' && (
          <div
            className={`absolute inset-x-0 bottom-0 h-[3px] transition-opacity duration-150 ${
              ledEffect === 'pulse'
                ? 'led-pulse-anim'
                : ledEffect === 'aurora'
                  ? 'led-aurora-strip'
                  : ''
            }`}
            style={{
              opacity: fallboardLedOpacity,
              backgroundColor: ledEffect === 'aurora' ? undefined : ledColorHex,
              boxShadow:
                ledEffect === 'aurora'
                  ? '0 0 12px rgba(56, 189, 248, 0.55)'
                  : `0 0 14px ${ledColorHex}`,
            }}
          />
        )}
      </div>

      {/* Keybed */}
      <div
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerUp}
        onPointerLeave={handleContainerPointerUp}
        className="relative w-full h-[196px] md:h-[224px] bg-[#060608] px-[2px] pb-1.5 overflow-x-auto"
      >
        <div
          className="relative h-full w-full"
          style={{ minWidth: keyCount > 49 ? '940px' : keyCount > 37 ? '760px' : '580px' }}
        >
          {/* White Keys */}
          <div className="relative flex h-full w-full gap-[2px]">
            {keys.whiteKeys.map((midi) => {
              const isActive = activeNotes.has(midi);
              const noteLabel = midiToNoteName(midi);
              const isC = midi % 12 === 0;
              const qwerty = qwertyByMidi.get(midi);
              const progSlot = progressionLabels?.get(midi);
              const ledStyle = getKeyLedStyle(midi, isActive);

              return (
                <button
                  key={midi}
                  type="button"
                  data-midi={midi}
                  aria-label={`Piano key ${noteLabel}`}
                  onPointerDown={(e) => handlePointerDown(e, midi)}
                  style={ledStyle}
                  className={`relative flex-1 h-full rounded-b-[5px] flex flex-col items-center justify-end pb-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] cursor-pointer key-base ${whiteThemeClass} ${textureClass} ${
                    isActive ? 'white-key-pressed' : ''
                  }`}
                >
                  {isActive && ledEffect !== 'off' && (
                    <span
                      className="absolute inset-x-1 top-1 h-1 rounded-full pointer-events-none"
                      style={{
                        backgroundColor:
                          ledEffect === 'aurora' ? '#38BDF8' : ledColorHex,
                        opacity: 0.85,
                      }}
                    />
                  )}

                  {progSlot && (
                    <span className="mb-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#D4AF37] text-[#09090B] leading-none pointer-events-none shadow-sm">
                      {progSlot}
                    </span>
                  )}

                  {showQwertyHints && qwerty && (
                    <span
                      className={`mb-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium leading-none pointer-events-none ${
                        isActive
                          ? 'bg-[#D4AF37] text-[#0B0B0D]'
                          : 'bg-black/15 text-current opacity-75'
                      }`}
                    >
                      {qwerty}
                    </span>
                  )}

                  {(showNoteLabels || isC) && (
                    <span
                      className={`text-[10px] font-mono leading-none pointer-events-none ${
                        isC ? 'font-semibold opacity-90' : 'opacity-65'
                      }`}
                    >
                      {noteLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Black Keys */}
          {keys.blackKeys.map(({ midi, leftWhiteIndex, offsetRatio }) => {
            if (leftWhiteIndex < 0) return null;
            const isActive = activeNotes.has(midi);
            const noteLabel = midiToNoteName(midi);
            const qwerty = qwertyByMidi.get(midi);
            const progSlot = progressionLabels?.get(midi);
            const leftPct = (leftWhiteIndex + offsetRatio) * whiteWidthPct;
            const ledStyle = getKeyLedStyle(midi, isActive);

            return (
              <button
                key={midi}
                type="button"
                data-midi={midi}
                aria-label={`Piano key ${noteLabel}`}
                onPointerDown={(e) => handlePointerDown(e, midi)}
                style={{
                  left: `${leftPct}%`,
                  width: `${blackWidthPct}%`,
                  ...ledStyle,
                }}
                className={`absolute top-0 h-[62%] z-20 rounded-b-[4px] flex flex-col items-center justify-end pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] cursor-pointer key-base ${blackThemeClass} ${textureClass} ${
                  isActive ? 'black-key-pressed' : ''
                }`}
              >
                {progSlot && (
                  <span className="mb-1 px-1 py-0.5 rounded text-[8px] font-mono font-semibold bg-[#D4AF37] text-[#09090B] leading-none pointer-events-none">
                    {progSlot}
                  </span>
                )}
                {showQwertyHints && qwerty && (
                  <span
                    className={`px-1 py-0.5 rounded text-[9px] font-mono leading-none pointer-events-none ${
                      isActive
                        ? 'text-[#0B0B0D] bg-[#E9CC74]'
                        : 'text-[#EAE5DB] bg-black/35'
                    }`}
                  >
                    {qwerty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
