type Props = {
  requireFullscreen?: boolean;
  onContinue: () => void;
};

/** Soft gate: warn on narrow viewports when desktop policy is likely required. */
export default function MobilePolicyGate({ requireFullscreen, onContinue }: Props) {
  const narrow = typeof window !== "undefined" && window.innerWidth < 768;
  if (!narrow) return null;

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          {requireFullscreen
            ? "This assessment prefers a desktop or tablet with fullscreen. Mobile may be restricted by campus policy."
            : "For the best experience, take this assessment on a desktop or tablet."}
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}
