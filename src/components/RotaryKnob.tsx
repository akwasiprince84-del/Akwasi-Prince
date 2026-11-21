import React, { useCallback, useRef, useState } from 'react';

interface RotaryKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
  logarithmic?: boolean;
  unit?: string;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min,
  max,
  defaultValue,
  logarithmic = false,
  unit = '',
  formatValue,
  onChange,
  size = 'md',
}) => {
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startNormRef = useRef<number>(0);

  const toNormalized = useCallback(
    (v: number): number => {
      const clamped = Math.max(min, Math.min(max, v));
      if (logarithmic && min > 0) {
        return Math.log(clamped / min) / Math.log(max / min);
      }
      return (clamped - min) / (max - min);
    },
    [min, max, logarithmic]
  );

  const fromNormalized = useCallback(
    (norm: number): number => {
      const n = Math.max(0, Math.min(1, norm));
      if (logarithmic && min > 0) {
        return min * Math.pow(max / min, n);
      }
      return min + n * (max - min);
    },
    [min, max, logarithmic]
  );

  const norm = toNormalized(value);
  // Sweep from -135 deg to +135 deg
  const angle = -135 + norm * 270;

  const dimensions = size === 'lg' ? 62 : size === 'sm' ? 46 : 54;
  const cx = dimensions / 2;
  const cy = dimensions / 2;
  const arcRadius = dimensions / 2 - 4;

  const polarToCartesian = (r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const describeArc = (r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(r, endAngle);
    const end = polarToCartesian(r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startYRef.current = e.clientY;
    startNormRef.current = norm;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const deltaY = startYRef.current - e.clientY;
    const sensitivity = e.shiftKey ? 360 : 140;
    const nextNorm = Math.max(0, Math.min(1, startNormRef.current + deltaY / sensitivity));
    onChange(fromNormalized(nextNorm));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * (e.shiftKey ? 0.01 : 0.035);
    onChange(fromNormalized(norm + delta));
  };

  const handleDoubleClick = () => {
    onChange(defaultValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(fromNormalized(norm + 0.04));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(fromNormalized(norm - 0.04));
    }
  };

  const formatted = formatValue
    ? formatValue(value)
    : `${Math.round(value)}${unit}`;

  const capRadius = dimensions * 0.34;
  const indicatorOuter = polarToCartesian(capRadius - 2, angle);
  const indicatorInner = polarToCartesian(capRadius * 0.36, angle);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        title="Drag vertically to adjust · Scroll for fine control · Double-click to reset"
        className={`relative cursor-ns-resize rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
          dragging ? 'scale-[1.03]' : ''
        } transition-transform duration-100`}
        style={{ width: dimensions, height: dimensions }}
      >
        <svg
          width={dimensions}
          height={dimensions}
          viewBox={`0 0 ${dimensions} ${dimensions}`}
          className="overflow-visible"
        >
          <defs>
            <radialGradient id={`knob-cap-${label.replace(/\s+/g, '-')}`} cx="38%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#35353D" />
              <stop offset="65%" stopColor="#1A1A20" />
              <stop offset="100%" stopColor="#0E0E12" />
            </radialGradient>
            <linearGradient id={`knob-rim-${label.replace(/\s+/g, '-')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E9CC74" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#8C6D23" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Track background arc */}
          <path
            d={describeArc(arcRadius, -135, 135)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Active gold arc */}
          {norm > 0.005 && (
            <path
              d={describeArc(arcRadius, -135, angle)}
              fill="none"
              stroke={dragging ? '#F3D77E' : '#D4AF37'}
              strokeWidth={2.75}
              strokeLinecap="round"
            />
          )}

          {/* Machined knob outer bezel */}
          <circle
            cx={cx}
            cy={cy}
            r={capRadius + 2}
            fill="#0A0A0D"
            stroke={`url(#knob-rim-${label.replace(/\s+/g, '-')})`}
            strokeWidth={1}
          />

          {/* Brushed obsidian knob cap */}
          <circle
            cx={cx}
            cy={cy}
            r={capRadius}
            fill={`url(#knob-cap-${label.replace(/\s+/g, '-')})`}
          />

          {/* Gold indicator notch */}
          <line
            x1={indicatorInner.x}
            y1={indicatorInner.y}
            x2={indicatorOuter.x}
            y2={indicatorOuter.y}
            stroke="#F2D479"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex flex-col items-center leading-tight">
        <span className="text-[11px] font-medium text-[#A19B8E] whitespace-nowrap">
          {label}
        </span>
        <span className="font-mono text-[11px] text-[#E6D18F] tabular-nums">
          {formatted}
        </span>
      </div>
    </div>
  );
};
