// =============================================================================
// TalentSecure AI — Vapi.ai Service
// Fetches call transcripts from Vapi and generates interview feedback via Claude
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const VAPI_BASE = "https://api.vapi.ai";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VapiMessage {
  role: "user" | "assistant" | "system" | "tool" | "function";
  message: string;
  time?: number;         // seconds from call start
  secondsFromStart?: number;
}

export interface VapiCall {
  id: string;
  status: string;
  messages?: VapiMessage[];
  transcript?: string;   // flat text transcript (older format)
  endedReason?: string;
  duration?: number;     // seconds
  startedAt?: string;
  endedAt?: string;
}

export interface InterviewFeedback {
  overall_score: number;
  communication_score: number;
  technical_score: number;
  confidence_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  skill_gaps: { skill: string; priority: "high" | "medium" | "low" }[];
  transcript_highlights: { time_approx: string; quote: string; note: string }[];
  recommended_courses: { title: string; reason: string }[];
}

// ── Fetch call from Vapi API ─────────────────────────────────────────────────

export async function fetchVapiCall(callId: string): Promise<VapiCall> {
  if (!env.VAPI_API_KEY) throw new Error("VAPI_API_KEY not configured");

  const res = await fetch(`${VAPI_BASE}/call/${callId}`, {
    headers: { Authorization: `Bearer ${env.VAPI_API_KEY}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vapi API ${res.status}: ${body}`);
  }

  return res.json() as Promise<VapiCall>;
}

// ── Build readable transcript string ────────────────────────────────────────

export function formatTranscript(messages: VapiMessage[]): string {
  return messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => {
      const speaker = m.role === "user" ? "Candidate" : "Interviewer";
      const time = m.secondsFromStart != null
        ? `[${Math.floor(m.secondsFromStart / 60)}:${String(m.secondsFromStart % 60).padStart(2, "0")}] `
        : "";
      return `${time}${speaker}: ${m.message}`;
    })
    .join("\n");
}

// ── Generate feedback from transcript using Claude ───────────────────────────

export async function analyseInterview(opts: {
  transcript: string;
  targetRole: string;
  difficulty: string;
  studentName: string;
  degree?: string;
  skills?: string[];
}): Promise<InterviewFeedback> {
  const { transcript, targetRole, difficulty, studentName, degree, skills } = opts;

  if (!transcript.trim()) {
    return emptyFeedback("No transcript available — the call may have ended early.");
  }

  const prompt = `You are an expert career coach reviewing a mock interview transcript.

Interview details:
- Candidate: ${studentName}
- Target role: ${targetRole}
- Difficulty: ${difficulty}
- Degree: ${degree || "Not specified"}
- Skills listed: ${skills?.join(", ") || "Not specified"}

Transcript:
${transcript}

Analyse this interview and respond ONLY with a valid JSON object in this exact structure:
{
  "overall_score": <0-100>,
  "communication_score": <0-100>,
  "technical_score": <0-100>,
  "confidence_score": <0-100>,
  "summary": "<2-3 sentence honest assessment of the candidate's performance>",
  "strengths": ["<specific strength with an example from the transcript>"],
  "improvements": ["<specific area for improvement with an actionable suggestion>"],
  "skill_gaps": [{ "skill": "<skill name>", "priority": "high|medium|low" }],
  "transcript_highlights": [{ "time_approx": "<e.g. 2:30>", "quote": "<short quote>", "note": "<why this moment matters>" }],
  "recommended_courses": [{ "title": "<course topic>", "reason": "<why this course addresses a gap>" }]
}

Provide 2–4 strengths, 2–4 improvements, 2–4 skill gaps, 2–3 highlights, and 2–3 recommended courses.
Be specific and reference actual moments from the transcript where possible.`;

  try {
    const message = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : "{}") as InterviewFeedback;
  } catch (err: any) {
    logger.error("Interview feedback generation failed", { error: err.message });
    return emptyFeedback("Feedback generation failed. Please try again.");
  }
}

function emptyFeedback(summary: string): InterviewFeedback {
  return {
    overall_score: 0,
    communication_score: 0,
    technical_score: 0,
    confidence_score: 0,
    summary,
    strengths: [],
    improvements: [],
    skill_gaps: [],
    transcript_highlights: [],
    recommended_courses: [],
  };
}

// ── Build Vapi assistant config (returned to client for vapi.start()) ────────

export function buildAssistantConfig(opts: {
  targetRole: string;
  difficulty: string;
  studentName: string;
  degree?: string;
  skills?: string[];
}) {
  const { targetRole, difficulty, studentName, degree, skills } = opts;

  const difficultyGuide = {
    easy: "Ask 2 beginner-level questions. Be very encouraging and supportive.",
    medium: "Ask 2–3 intermediate questions. Probe answers gently with one follow-up each.",
    hard: "Ask 3 challenging questions including one system-design or complex coding scenario. Push for depth.",
  }[difficulty] || "Ask 2–3 intermediate questions.";

  const systemPrompt = `You are a professional technical interviewer conducting a mock interview for a ${targetRole} position at a mid-to-large tech company.

Candidate profile:
- Name: ${studentName}
- Degree: ${degree || "Not specified"}
- Skills: ${skills?.join(", ") || "Not specified"}

Difficulty level: ${difficulty.toUpperCase()}
${difficultyGuide}

Interview structure (follow this order):
1. Warm greeting and brief introduction of yourself (1–2 sentences)
2. Ask the candidate to introduce themselves (30 seconds)
3. Ask ${difficulty === "hard" ? "3" : "2"} technical questions relevant to ${targetRole}
4. Ask 1 behavioral question ("Tell me about a time when...")
5. Close with "Do you have any questions for me?" — give a brief, realistic answer
6. Thank them and end the interview

Rules:
- Keep responses SHORT and conversational — this is voice, not text
- After each answer, give brief acknowledgement then move on
- Do NOT give lengthy explanations or lecture
- Total interview: 10–15 minutes
- If the candidate is unclear, ask ONE clarifying question only
- End naturally when the structure is complete`;

  return {
    model: {
      provider: "anthropic" as const,
      model: "claude-haiku-4-5-20251001", // faster for real-time voice
      messages: [{ role: "system" as const, content: systemPrompt }],
      temperature: 0.6,
    },
    voice: {
      provider: "playht" as const,
      voiceId: "jennifer",
    },
    firstMessage: `Hello ${studentName}! I'm your interviewer today. We're here for a mock ${targetRole} interview — this should take about 10 to 15 minutes. Are you ready to begin?`,
    endCallMessage: "Thank you for your time today. I'll have the feedback ready for you shortly. Best of luck!",
    endCallFunctionEnabled: true,
    recordingEnabled: false,
    transcriber: {
      provider: "deepgram" as const,
      model: "nova-2",
      language: "en",
    },
  };
}
