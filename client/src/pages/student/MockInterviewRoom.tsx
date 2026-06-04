import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Vapi from "@vapi-ai/web";
import { Mic, MicOff, PhoneOff, Volume2, Loader2, CheckCircle } from "lucide-react";
import api from "../../lib/api";

type CallStatus = "connecting" | "active" | "ending" | "done" | "error";

interface TranscriptLine {
  role: "user" | "assistant";
  text: string;
}

export default function MockInterviewRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    session_id: string;
    vapi_public_key: string;
    assistant_config: Record<string, unknown>;
    target_role: string;
    difficulty: string;
  } | null;

  const vapiRef = useRef<Vapi | null>(null);
  const callIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<CallStatus>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);  // AI speaking
  const [isListening, setIsListening] = useState(false); // user speaking
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [error, setError] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Redirect if arrived without state (e.g. direct URL)
  useEffect(() => {
    if (!state?.session_id) {
      navigate("/app/student-portal/mock-interview", { replace: true });
    }
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Init Vapi call
  useEffect(() => {
    if (!state) return;
    const { vapi_public_key, assistant_config } = state;

    if (!vapi_public_key) {
      setError("Vapi is not configured yet. Ask your administrator to add VAPI_PUBLIC_KEY.");
      setStatus("error");
      return;
    }

    const vapi = new Vapi(vapi_public_key);
    vapiRef.current = vapi;

    vapi.on("call-start", () => {
      setStatus("active");
    });

    vapi.on("call-end", () => {
      handleCallEnd();
    });

    vapi.on("speech-start", () => setIsSpeaking(true));
    vapi.on("speech-end", () => setIsSpeaking(false));

    vapi.on("message", (msg: any) => {
      // Real-time transcript
      if (msg.type === "transcript" && msg.transcript) {
        const role = msg.role === "assistant" ? "assistant" : "user";
        if (msg.transcriptType === "final") {
          setTranscript(prev => [...prev, { role, text: msg.transcript }]);
        }
        setIsListening(role === "user");
      }
    });

    vapi.on("error", (err: any) => {
      console.error("Vapi error:", err);
      setError(err?.message || "Connection error. Please try again.");
      setStatus("error");
    });

    // Start the call with the assistant config from the server
    vapi.start(assistant_config as any).then((call: any) => {
      if (call?.id) callIdRef.current = call.id;
    }).catch((err: any) => {
      setError(err?.message || "Failed to start call");
      setStatus("error");
    });

    return () => {
      vapi.stop();
    };
  }, []);

  const handleCallEnd = async () => {
    setStatus("ending");
    try {
      // Tell the server the call ended so it can fetch transcript + generate feedback
      const vapiCallId = callIdRef.current;
      if (vapiCallId && state?.session_id) {
        await api.post(`/mock-interviews/${state.session_id}/complete`, {
          vapi_call_id: vapiCallId,
        });
      }
    } catch (err) {
      console.error("Failed to complete session:", err);
    }
    setStatus("done");
  };

  const endCall = () => {
    vapiRef.current?.stop();
  };

  const toggleMute = () => {
    if (!vapiRef.current) return;
    vapiRef.current.setMuted(!isMuted);
    setIsMuted(m => !m);
  };

  const goToFeedback = () => {
    navigate(`/app/student-portal/mock-interview/${state!.session_id}/feedback`);
  };

  // ── Error state ──────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MicOff className="h-8 w-8 text-rose-400" />
          </div>
          <h2 className="text-white text-lg font-bold mb-2">Connection Failed</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate("/app/student-portal/mock-interview")}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Done state ───────────────────────────────────────────────────────────
  if (status === "done" || status === "ending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Interview Complete!</h2>
          <p className="text-slate-400 text-sm mb-2">
            Great job! Your AI interviewer is reviewing your responses.
          </p>
          <p className="text-slate-500 text-xs mb-8">Feedback is usually ready within 30 seconds.</p>
          <button
            onClick={goToFeedback}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors mb-3"
          >
            View My Feedback
          </button>
          <button
            onClick={() => navigate("/app/student-portal/mock-interview")}
            className="w-full text-slate-400 hover:text-white text-sm py-2"
          >
            Start another interview
          </button>
        </div>
      </div>
    );
  }

  // ── Active call ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">

      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div>
          <p className="text-white font-bold text-sm">{state?.target_role} Interview</p>
          <p className="text-slate-500 text-xs capitalize">{state?.difficulty} level</p>
        </div>
        <div className="flex items-center gap-2">
          {status === "connecting" && (
            <span className="text-slate-400 text-xs flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Connecting…
            </span>
          )}
          {status === "active" && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" /> Live
            </span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">

        {/* AI avatar with speaking animation */}
        <div className="relative">
          <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl transition-all ${isSpeaking ? "scale-110" : "scale-100"}`}>
            <Volume2 className="h-12 w-12 text-white" />
          </div>
          {isSpeaking && (
            <span className="absolute inset-0 rounded-full border-4 border-indigo-400 animate-ping opacity-40" />
          )}
          <p className="text-center text-slate-300 text-sm font-medium mt-3">AI Interviewer</p>
        </div>

        {/* User speaking indicator */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${isListening && !isMuted ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-slate-700 text-slate-600"}`}>
          <Mic className="h-4 w-4" />
          <span className="text-xs font-semibold">{isListening && !isMuted ? "Speaking…" : isMuted ? "Muted" : "Listening"}</span>
        </div>

        {/* Transcript feed */}
        {transcript.length > 0 && (
          <div className="w-full max-w-lg bg-slate-800/60 rounded-2xl p-4 max-h-52 overflow-y-auto space-y-3">
            {transcript.map((line, i) => (
              <div key={i} className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${line.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-200"}`}>
                  {line.text}
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {status === "connecting" && transcript.length === 0 && (
          <p className="text-slate-500 text-sm animate-pulse">Connecting to your interviewer…</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 px-6 py-6 border-t border-slate-800">
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center shadow-lg shadow-rose-900/40 transition-all"
          title="End interview"
        >
          <PhoneOff className="h-6 w-6 text-white" />
        </button>

        {/* spacer to balance layout */}
        <div className="w-12 h-12" />
      </div>
    </div>
  );
}
