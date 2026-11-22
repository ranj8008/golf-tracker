"use client";

export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex rounded-lg bg-surface p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-md px-3 text-sm font-medium whitespace-nowrap tabular-nums ${
            value === o.value ? "bg-accent text-on-accent" : "text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
