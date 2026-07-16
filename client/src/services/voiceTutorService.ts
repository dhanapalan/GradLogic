import api from "../lib/api";
import { postSSE } from "../lib/sse";

// =============================================================================
// AI Voice Tutor (Phase 6) — client wrapper.
//
//   Speech-to-Text  → browser SpeechRecognition (mic capture + STT happen
//                      entirely client-side; no audio is ever sent to the
//                      server, only the recognized text).
//   LLM             → POST /api/voice-tutor/converse, a server-sent-events
//                      stream of text deltas scoped to one knowledge object.
//   Text-to-Speech  → browser speechSynthesis, fed sentence-by-sentence as
//                      deltas arrive, so playback starts before the full
//                      reply has finished generating ("streaming audio").
//                      Any new action or a fresh mic press cancels playback
//                      in progress (interruptible / barge-in).
// =============================================================================

export type VoiceTutorLanguage = "en" | "ta" | "hi" | "ml" | "te";
export type VoiceTutorAction = "listen" | "explain" | "hint" | "example" | "translate" | "ask";

export const VOICE_TUTOR_LANGUAGES: Record<VoiceTutorLanguage, { label: string; bcp47: string }> = {
  en: { label: "English", bcp47: "en-IN" },
  ta: { label: "Tamil", bcp47: "ta-IN" },
  hi: { label: "Hindi", bcp47: "hi-IN" },
  ml: { label: "Malayalam", bcp47: "ml-IN" },
  te: { label: "Telugu", bcp47: "te-IN" },
};

export interface ConversationTurn {
  role: "student" | "tutor";
  text: string;
}

export interface KnowledgeObjectView {
  id: string;
  question_text: string;
  category: string;
  type: string;
  difficulty_level: string;
  options: string[] | null;
  hint: string | null;
  explanation: string | null;
  learning_objectives: string[];
  bloom_level: string | null;
}

async function fetchKnowledgeObject(questionId: string): Promise<KnowledgeObjectView> {
  const res = await api.get(`/voice-tutor/knowledge-object/${questionId}`);
  return res.data.data;
}

/** Streams one Voice Tutor turn over SSE (see lib/sse.ts for the frame parser). */
async function streamConverse(
  params: {
    questionId: string;
    action: VoiceTutorAction;
    message?: string;
    language: VoiceTutorLanguage;
    history: ConversationTurn[];
  },
  handlers: {
    onDelta: (chunk: string) => void;
    onDone: (result: { text: string; ssml: string; requiresReview: boolean }) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  await postSSE("/voice-tutor/converse", params, (event) => {
    if (event.type === "delta") handlers.onDelta(event.text);
    else if (event.type === "done") handlers.onDone(event);
    else if (event.type === "error") handlers.onError(event.message);
  }, signal);
}

// ── Speech-to-Text ────────────────────────────────────────────────────────

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSttSupported(): boolean {
  return getRecognitionCtor() !== null;
}

let activeRecognition: SpeechRecognitionLike | null = null;

export function stopListening(): void {
  activeRecognition?.abort();
  activeRecognition = null;
}

export function startListening(
  language: VoiceTutorLanguage,
  handlers: { onResult: (text: string) => void; onEnd: () => void; onError: (message: string) => void },
): void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    handlers.onError("Speech recognition isn't supported in this browser — try typing instead.");
    return;
  }
  stopListening();
  const recognition = new Ctor();
  recognition.lang = VOICE_TUTOR_LANGUAGES[language].bcp47;
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event: any) => {
    const text = event.results?.[0]?.[0]?.transcript;
    if (text) handlers.onResult(text);
  };
  recognition.onerror = (event: any) => {
    handlers.onError(event.error === "no-speech" ? "Didn't catch that — try again." : `Mic error: ${event.error}`);
  };
  recognition.onend = () => {
    activeRecognition = null;
    handlers.onEnd();
  };
  activeRecognition = recognition;
  recognition.start();
}

// ── Text-to-Speech ────────────────────────────────────────────────────────

const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
let speechQueue: string[] = [];
let speaking = false;
let speechRate = 1;

/** Playback rate for speechSynthesis (aligned with lesson speeds). */
export function setSpeechRate(rate: number): void {
  speechRate = Math.min(2, Math.max(0.75, rate || 1));
}

function pickVoice(bcp47: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const lang = bcp47.toLowerCase();
  const langPrefix = lang.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase() === lang) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
    undefined
  );
}

export function isTtsSupported(): boolean {
  return speechSupported;
}

/** Stops any in-progress or queued speech immediately — the "interrupt" primitive. */
export function stopSpeaking(): void {
  speechQueue = [];
  speaking = false;
  if (speechSupported) window.speechSynthesis.cancel();
}

function pumpQueue(language: VoiceTutorLanguage, onEnd: () => void): void {
  if (speaking || speechQueue.length === 0) {
    if (speechQueue.length === 0) onEnd();
    return;
  }
  const next = speechQueue.shift()!;
  const utterance = new SpeechSynthesisUtterance(next);
  const bcp47 = VOICE_TUTOR_LANGUAGES[language].bcp47;
  utterance.lang = bcp47;
  utterance.rate = speechRate;
  const voice = pickVoice(bcp47);
  if (voice) utterance.voice = voice;
  speaking = true;
  utterance.onend = () => {
    speaking = false;
    pumpQueue(language, onEnd);
  };
  utterance.onerror = () => {
    speaking = false;
    pumpQueue(language, onEnd);
  };
  window.speechSynthesis.speak(utterance);
}

/** Appends a chunk of text to the speech queue and starts/continues playback. */
export function speakChunk(text: string, language: VoiceTutorLanguage, onQueueDrained: () => void): void {
  if (!speechSupported || !text.trim()) return;
  speechQueue.push(text.trim());
  pumpQueue(language, onQueueDrained);
}

// ── Sentence splitting for streaming playback ────────────────────────────
// Flushes a growing text buffer into speakable sentences as SSE deltas
// arrive, so audio starts well before the full reply is done generating.

const SENTENCE_END = /([.!?।]|\n)\s*/;

export function createSentenceSplitter(onSentence: (sentence: string) => void) {
  let buffer = "";
  return {
    push(delta: string) {
      buffer += delta;
      const parts = buffer.split(SENTENCE_END);
      // parts alternates [text, delimiter, text, delimiter, ..., trailing]
      let complete = "";
      let i = 0;
      for (; i + 1 < parts.length; i += 2) {
        complete += parts[i] + (parts[i + 1] || "");
      }
      if (complete.trim()) onSentence(complete.trim());
      buffer = parts[i] || "";
    },
    flush() {
      if (buffer.trim()) onSentence(buffer.trim());
      buffer = "";
    },
  };
}

export default {
  fetchKnowledgeObject,
  streamConverse,
  isSttSupported,
  startListening,
  stopListening,
  isTtsSupported,
  speakChunk,
  stopSpeaking,
  setSpeechRate,
  createSentenceSplitter,
};
