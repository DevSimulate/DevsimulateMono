export function LevelMeter({ level }: { level: number }): React.ReactElement {
  const bars = 12;
  const active = Math.round(level * bars);
  return (
    <div className="flex items-center gap-0.5" role="meter" aria-label="Microphone input level" aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-1 rounded-full transition-colors duration-100"
          style={{
            height: 4 + i * 1.2,
            background: i < active ? "var(--verified)" : "var(--hairline)",
          }}
        />
      ))}
    </div>
  );
}
