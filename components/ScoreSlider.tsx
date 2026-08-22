"use client";

export function ScoreSlider({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-medium text-white">{label}</p>
          {sublabel && <p className="text-xs text-white/50">{sublabel}</p>}
        </div>
        <span className="glow-text text-2xl font-black tabular-nums">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan"
        aria-label={label}
      />
    </div>
  );
}
