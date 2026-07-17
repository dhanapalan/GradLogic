import { baseURL } from "./api";
import { getAccessToken } from "../stores/authStore";

/**
 * Shared SSE-over-fetch helper. `fetch` (not axios, not EventSource) because
 * EventSource can't send a POST body and axios can't hand back a readable
 * byte stream to consume incrementally — this is a plain hand-rolled parser
 * for `data: {...}\n\n` frames, used by both the Voice Tutor (Phase 6) and
 * the Placement Coach's voice coaching (Phase 9).
 */
export async function postSSE(
  path: string,
  body: unknown,
  onEvent: (event: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: `Request failed (HTTP ${res.status})` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(6)));
    }
  }
}
