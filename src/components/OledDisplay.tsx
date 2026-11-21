import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { detectChord, midiToFrequency, midiToNoteName } from '../audio/musicTheory';
import { InstrumentPreset } from '../types/synth';

interface OledDisplayProps {
  preset: InstrumentPreset;
  activeNotes: number[];
  sustain: boolean;
  pitchBend: number;
  modWheel: number;
  octaveOffset: number;
  bpm: number;
  audioReady: boolean;
}

export const OledDisplay: React.FC<OledDisplayProps> = ({
  preset,
  activeNotes,
  sustain,
  pitchBend,
  modWheel,
  octaveOffset,
  bpm,
  audioReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [vizMode, setVizMode] = useState<'waveform' | 'spectrum'>('waveform');
  const [voiceCount, setVoiceCount] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const analyser = soundEngine.getAnalyser();
        setVoiceCount(soundEngine.getActiveVoiceCount());

        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Subtle studio graticule lines
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.moveTo(w / 2, 0);
          ctx.lineTo(w / 2, h);
          ctx.stroke();

          if (analyser) {
            if (vizMode === 'waveform') {
              const bufferLen = analyser.fftSize;
              const data = new Uint8Array(bufferLen);
              analyser.getByteTimeDomainData(data);

              ctx.save();
              ctx.strokeStyle = '#E5C158';
              ctx.lineWidth = 1.8;
              ctx.shadowColor = 'rgba(212, 175, 55, 0.45)';
              ctx.shadowBlur = 8;
              ctx.beginPath();

              const sliceWidth = w / bufferLen;
              let x = 0;
              for (let i = 0; i < bufferLen; i++) {
                const v = data[i] / 128.0;
                const y = (v * h) / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
              }
              ctx.stroke();
              ctx.restore();
            } else {
              const freqCount = analyser.frequencyBinCount;
              const data = new Uint8Array(freqCount);
              analyser.getByteFrequencyData(data);

              const barCount = 48;
              const barWidth = w / barCount;
              for (let i = 0; i < barCount; i++) {
                // Logarithmic bin indexing so musical midrange shines
                const binIndex = Math.min(
                  freqCount - 1,
                  Math.floor(Math.pow(i / barCount, 1.6) * (freqCount * 0.42))
                );
                const val = data[binIndex] / 255;
                const barH = Math.max(2, val * (h - 8));
                const grad = ctx.createLinearGradient(0, h - barH, 0, h);
                grad.addColorStop(0, '#F4DC8B');
                grad.addColorStop(1, 'rgba(212, 175, 55, 0.18)');
                ctx.fillStyle = grad;
                ctx.fillRect(
                  i * barWidth + 1.5,
                  h - barH,
                  Math.max(2, barWidth - 3),
                  barH
                );
              }
            }
          } else {
            // Standby flat hairline before audio context starts
            ctx.strokeStyle = 'rgba(229, 193, 88, 0.35)';
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
            ctx.stroke();
          }
        }
      }
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [vizMode]);

  const sortedNotes = [...activeNotes].sort((a, b) => a - b);
  const chord = detectChord(sortedNotes);
  const primaryNote = sortedNotes.length > 0 ? sortedNotes[0] : null;
  const freq = primaryNote !== null ? midiToFrequency(primaryNote, pitchBend) : null;

  return (
    <div className="oled-glass rounded-xl p-4 md:px-6 md:py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
      {/* Left Zone: Sound Program & Performance Telemetry */}
      <div className="lg:col-span-4 flex flex-col justify-between gap-2 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-[#B9A46A] tracking-wide">
            Bank 0{preset.bankNumber} · {preset.category}
          </span>
          <span className="font-mono text-[11px] text-[#8E897E] tabular-nums">
            {audioReady ? `${voiceCount}/20 Voices` : 'Audio Standby'}
          </span>
        </div>

        <div className="min-w-0">
          <h2 className="font-display text-2xl md:text-[28px] font-semibold tracking-tight text-[#FAF6EC] leading-none truncate">
            {preset.name}
          </h2>
          <p className="text-xs text-[#9C968A] mt-1 truncate">{preset.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 border-t border-white/[0.06] font-mono text-[11px] text-[#A8A295] tabular-nums">
          <span>Oct {octaveOffset >= 0 ? `+${octaveOffset}` : octaveOffset}</span>
          <span>Tempo {bpm}</span>
          <span className={sustain ? 'text-[#E9CC74]' : ''}>
            Damper {sustain ? 'On' : 'Off'}
          </span>
          <span>Mod {Math.round(modWheel * 100)}%</span>
        </div>
      </div>

      {/* Center Zone: Real-Time Audio Oscilloscope / Spectrum */}
      <div className="lg:col-span-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#8E897E]">Master Signal</span>
          <button
            type="button"
            onClick={() =>
              setVizMode((prev) => (prev === 'waveform' ? 'spectrum' : 'waveform'))
            }
            className="text-[#D4AF37] hover:text-[#F0D37A] transition-colors font-medium cursor-pointer whitespace-nowrap"
          >
            {vizMode === 'waveform' ? 'Scope · Switch to Spectrum' : 'Spectrum · Switch to Scope'}
          </button>
        </div>
        <div className="relative h-[78px] w-full rounded-lg bg-[#050507] border border-white/[0.06] overflow-hidden">
          <canvas
            ref={canvasRef}
            width={420}
            height={78}
            onClick={() =>
              setVizMode((prev) => (prev === 'waveform' ? 'spectrum' : 'waveform'))
            }
            className="w-full h-full cursor-pointer block"
          />
        </div>
      </div>

      {/* Right Zone: Harmonic Chord & Frequency Readout */}
      <div className="lg:col-span-4 flex flex-col justify-between gap-2 lg:pl-3 lg:border-l lg:border-white/[0.06]">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#8E897E]">Harmonic Analysis</span>
          <span className="font-mono text-[#A8A295] tabular-nums">
            {freq !== null ? `${freq.toFixed(1)} Hz` : '— Hz'}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3 min-h-[38px]">
          <span className="font-display text-3xl font-semibold text-[#E9CC74] tracking-tight truncate">
            {chord ? chord.symbol : 'Ready'}
          </span>
          <span className="text-xs text-[#9C968A] whitespace-nowrap">
            {chord ? chord.quality : 'Play keys to analyze'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06] font-mono text-[11px] text-[#A8A295] tabular-nums min-h-[22px]">
          <span className="truncate">
            {sortedNotes.length > 0
              ? sortedNotes.slice(0, 6).map(midiToNoteName).join(' · ')
              : 'Notes: —'}
          </span>
          <span className="shrink-0 text-[#8E897E]">
            {primaryNote !== null ? `MIDI ${primaryNote}` : 'MIDI —'}
          </span>
        </div>
      </div>
    </div>
  );
};
