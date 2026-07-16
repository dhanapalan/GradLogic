type Props = {
  fontScale: number;
  highContrast: boolean;
  onFontScale: (n: number) => void;
  onHighContrast: (v: boolean) => void;
};

export default function AccessibilityToolbar({
  fontScale,
  highContrast,
  onFontScale,
  onHighContrast,
}: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
      role="toolbar"
      aria-label="Accessibility options"
    >
      <span className="font-semibold text-slate-500">Accessibility</span>
      <button
        type="button"
        className="rounded border border-slate-200 px-2 py-1 font-bold"
        onClick={() => onFontScale(Math.max(0.9, Number((fontScale - 0.1).toFixed(1))))}
        aria-label="Decrease font size"
      >
        A−
      </button>
      <button
        type="button"
        className="rounded border border-slate-200 px-2 py-1 font-bold"
        onClick={() => onFontScale(Math.min(1.4, Number((fontScale + 0.1).toFixed(1))))}
        aria-label="Increase font size"
      >
        A+
      </button>
      <button
        type="button"
        className={`rounded border px-2 py-1 font-bold ${
          highContrast ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200"
        }`}
        onClick={() => onHighContrast(!highContrast)}
        aria-pressed={highContrast}
      >
        High contrast
      </button>
      <button
        type="button"
        className="rounded border border-slate-200 px-2 py-1 font-bold"
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.();
        }}
      >
        Zoom / Fullscreen
      </button>
    </div>
  );
}
