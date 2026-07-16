import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import studentAiCoachService, {
  type ChatTurn,
} from "../../../../services/studentAiCoachService";
import { CoachMarkdown, ErrorBlock } from "./components";

const SUGGESTIONS = [
  "What should I learn next?",
  "Why is my score low?",
  "Create a study plan for today",
  "Explain JOIN",
  "Recommend next voice lesson",
];

const HISTORY_KEY = "gradlogic-ai-coach-chat";

function loadHistory(): ChatTurn[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatTurn[];
    return Array.isArray(parsed) ? parsed.slice(-20) : [];
  } catch {
    return [];
  }
}

export default function ChatPanel() {
  const [history, setHistory] = useState<ChatTurn[]>(loadHistory);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-20)));
    } catch {
      /* ignore */
    }
  }, [history]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, pending]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    if (!isOnline) {
      setError("You are offline. Reconnect to chat with AI Coach.");
      return;
    }
    setError(null);
    setBusy(true);
    setPending("");
    const nextHistory: ChatTurn[] = [...history, { role: "student", text: message }];
    setHistory(nextHistory);
    setInput("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    void studentAiCoachService.streamChat(
      { message, history: nextHistory },
      {
        onDelta: (chunk) => setPending((p) => p + chunk),
        onDone: (result) => {
          setHistory((h) => [...h, { role: "coach", text: result.text || "" }]);
          setPending("");
          setBusy(false);
        },
        onError: (msg) => {
          setError(msg || "Chat failed");
          setPending("");
          setBusy(false);
        },
      },
      controller.signal
    );
  };

  return (
    <div className="flex h-[min(60dvh,560px)] flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-black text-slate-900 dark:text-slate-50">Ask AI</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Answers use your Learning Intelligence context — not a generic chatbot.
        </p>
      </div>

      {!isOnline && (
        <div
          role="status"
          className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-center text-[11px] font-semibold text-amber-900"
        >
          Offline — messaging is paused until you reconnect.
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" role="log" aria-live="polite">
        {!history.length && !pending && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={!isOnline || busy}
                  className="min-h-11 rounded-full border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((t, i) => (
          <div
            key={`${t.role}-${i}`}
            className={`max-w-[90%] rounded-2xl px-3 py-2 ${
              t.role === "student"
                ? "ml-auto bg-indigo-600 text-white"
                : "mr-auto bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
            }`}
          >
            {t.role === "coach" ? (
              <CoachMarkdown text={t.text} />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{t.text}</p>
            )}
          </div>
        ))}
        {pending && (
          <div className="mr-auto max-w-[90%] rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
            <CoachMarkdown text={pending} />
            <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-indigo-500" aria-label="Streaming" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="px-4 pb-2">
          <ErrorBlock message={error} onRetry={() => setError(null)} />
        </div>
      )}

      <form
        className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label className="sr-only" htmlFor="ai-coach-input">
          Message AI Coach
        </label>
        <input
          id="ai-coach-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy || !isOnline}
          placeholder={isOnline ? "Ask what to learn or practice next…" : "Reconnect to send…"}
          className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || !isOnline}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          aria-label="Send message"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </form>
    </div>
  );
}
