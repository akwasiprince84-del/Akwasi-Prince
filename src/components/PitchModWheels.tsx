import React, { useRef, useState } from 'react';

interface PitchModWheelsProps {
  pitchBend: number; // -2 to +2 semitones
  modWheel: number; // 0 to 1
  onPitchBendChange: (semitones: number) => void;
  onModWheelChange: (value: number) => void;
}

export const PitchModWheels: React.FC<PitchModWheelsProps> = ({
  pitchBend,
  modWheel,
  onPitchBendChange,
  onModWheelChange,
}) => {
  const [draggingPitch, setDraggingPitch] = useState(false);
  const [draggingMod, setDraggingMod] = useState(false);
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const modRef = useRef<HTMLDivElement | null>(null);

  const updatePitchFromPointer = (clientY: number) => {
    const el = pitchRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const norm = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const semitones = (norm - 0.5) * 4; // -2 to +2
    onPitchBendChange(Math.abs(semitones) < 0.08 ? 0 : semitones);
  };

  const updateModFromPointer = (clientY: number) => {
    const el = modRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const norm = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onModWheelChange(norm);
  };

  const pitchNorm = (pitchBend + 2) / 4; // 0..1, center 0.5

  return (
    <div className="flex items-stretch gap-3 px-2.5 py-3 bg-[#0C0C0F] border border-white/[0.06] rounded-lg select-none">
      {/* Pitch Bend Wheel */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          ref={pitchRef}
          role="slider"
          aria-label="Pitch Bend"
          aria-valuemin={-2}
          aria-valuemax={2}
          aria-valuenow={Number(pitchBend.toFixed(2))}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDraggingPitch(true);
            updatePitchFromPointer(e.clientY);
          }}
          onPointerMove={(e) => {
            if (draggingPitch) updatePitchFromPointer(e.clientY);
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            setDraggingPitch(false);
            onPitchBendChange(0); // Spring return
          }}
          onPointerCancel={() => {
            setDraggingPitch(false);
            onPitchBendChange(0);
          }}
          className="relative w-8 h-32 rounded-md bg-gradient-to-b from-[#070709] via-[#1B1B21] to-[#070709] border border-white/[0.08] shadow-inner cursor-ns-resize overflow-hidden"
        >
          {/* Center detent line */}
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/15 pointer-events-none" />
          {/* Machined wheel grip grooves */}
          <div
            className="absolute inset-x-1 h-6 -translate-y-1/2 rounded-sm bg-gradient-to-b from-[#34343E] via-[#222229] to-[#121216] border border-[#D4AF37]/40 shadow-md flex items-center justify-center transition-[top] duration-75"
            style={{ top: `${(1 - pitchNorm) * 80 + 10}%` }}
          >
            <div className="w-4 h-[2px] rounded-full bg-[#E9CC74]" />
          </div>
        </div>
        <span className="text-[10px] font-medium text-[#8E897E]">Pitch</span>
      </div>

      {/* Modulation Wheel */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          ref={modRef}
          role="slider"
          aria-label="Modulation"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(modWheel * 100)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDraggingMod(true);
            updateModFromPointer(e.clientY);
          }}
          onPointerMove={(e) => {
            if (draggingMod) updateModFromPointer(e.clientY);
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            setDraggingMod(false);
          }}
          onPointerCancel={() => setDraggingMod(false)}
          onDoubleClick={() => onModWheelChange(0)}
          className="relative w-8 h-32 rounded-md bg-gradient-to-b from-[#070709] via-[#1B1B21] to-[#070709] border border-white/[0.08] shadow-inner cursor-ns-resize overflow-hidden"
        >
          {/* Gold fill glow below thumb */}
          <div
            className="absolute inset-x-0 bottom-0 bg-[#D4AF37]/15 pointer-events-none"
            style={{ height: `${modWheel * 100}%` }}
          />
          <div
            className="absolute inset-x-1 h-6 -translate-y-1/2 rounded-sm bg-gradient-to-b from-[#34343E] via-[#222229] to-[#121216] border border-[#D4AF37]/40 shadow-md flex items-center justify-center"
            style={{ top: `${(1 - modWheel) * 80 + 10}%` }}
          >
            <div className="w-4 h-[2px] rounded-full bg-[#E9CC74]" />
          </div>
        </div>
        <span className="text-[10px] font-medium text-[#8E897E]">Mod</span>
      </div>
    </div>
  );
};
