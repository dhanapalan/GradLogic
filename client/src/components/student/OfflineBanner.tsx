/**
 * Soft offline indicator for the student portal shell.
 * Assessment attempts keep their own integrity queue.
 */
export default function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100"
    >
      You are offline. Learning and practice will wait until you reconnect. Assessment autosave queues
      answers when available.
    </div>
  );
}
