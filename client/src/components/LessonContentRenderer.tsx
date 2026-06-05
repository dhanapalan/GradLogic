// =============================================================================
// LessonContentRenderer — shared content player for LMS lessons + skill modules
//
// Props:
//   contentType  — "video" | "pdf" | "text" | "reading" | "quiz" |
//                  "coding" | "coding_exercise" | "soft_skill" | "live_session"
//   contentUrl   — external URL (YouTube, S3, Vimeo, …)
//   contentText  — inline markdown/plain text or HTML body
//   title        — lesson/module title (used in fallbacks)
//   onEnded      — fires when a video finishes (use to auto-mark complete)
// =============================================================================

import { useRef, useEffect } from "react";
import { FileText, Code2, Video, Mic, Calendar, ExternalLink, BookOpen } from "lucide-react";

interface Props {
  contentType: string;
  contentUrl?: string | null;
  contentText?: string | null;
  title?: string;
  onEnded?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isYouTube(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function toYouTubeEmbed(url: string): string {
  // https://www.youtube.com/watch?v=ID  →  https://www.youtube.com/embed/ID
  // https://youtu.be/ID                 →  https://www.youtube.com/embed/ID
  try {
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1].split("?")[0];
      return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
    }
    const u = new URL(url);
    const id = u.searchParams.get("v") || u.pathname.split("/").pop();
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
  } catch {
    return url;
  }
}

function isVimeo(url: string) {
  return url.includes("vimeo.com");
}

function toVimeoEmbed(url: string): string {
  const id = url.split("vimeo.com/")[1]?.split("?")[0];
  return `https://player.vimeo.com/video/${id}`;
}

function isPDF(url: string) {
  return url.toLowerCase().endsWith(".pdf") || url.includes("/pdf") || url.includes("application/pdf");
}

// ── Video player ──────────────────────────────────────────────────────────────

function VideoPlayer({ url, title, onEnded }: { url: string; title?: string; onEnded?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !onEnded) return;
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [onEnded]);

  if (isYouTube(url)) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={toYouTubeEmbed(url)}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title={title ?? "Video lesson"}
        />
      </div>
    );
  }

  if (isVimeo(url)) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={toVimeoEmbed(url)}
          className="w-full h-full"
          allowFullScreen
          title={title ?? "Video lesson"}
        />
      </div>
    );
  }

  // Native video (MP4, WebM, etc.)
  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={url}
        controls
        className="w-full h-full"
        onEnded={onEnded}
        preload="metadata"
      >
        Your browser does not support HTML5 video.
      </video>
    </div>
  );
}

// ── PDF viewer ────────────────────────────────────────────────────────────────

function PDFViewer({ url, title }: { url: string; title?: string }) {
  // Use browser PDF viewer via iframe — works for direct PDF URLs and Google Drive links
  const embedUrl = url.includes("drive.google.com")
    ? url.replace("/view", "/preview")
    : url;

  return (
    <div className="space-y-3">
      <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50" style={{ height: "600px" }}>
        <iframe
          src={embedUrl}
          className="w-full h-full"
          title={title ?? "PDF document"}
          onError={() => {/* handled by fallback below */}}
        />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline font-semibold"
      >
        <ExternalLink className="h-4 w-4" />
        Open PDF in new tab
      </a>
    </div>
  );
}

// ── Text / reading content ────────────────────────────────────────────────────

function TextContent({ text, contentUrl, title }: { text?: string | null; contentUrl?: string | null; title?: string }) {
  const isHTML = text?.trim().startsWith("<");

  return (
    <div className="space-y-4">
      {text ? (
        <div className="prose prose-slate max-w-none">
          {isHTML ? (
            /* Render raw HTML (sanitise in production with DOMPurify) */
            <div
              className="text-sm text-slate-700 leading-relaxed space-y-3"
              dangerouslySetInnerHTML={{ __html: text }}
            />
          ) : (
            /* Plain text — preserve whitespace and line breaks */
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-5 border border-slate-100">
              {text}
            </pre>
          )}
        </div>
      ) : contentUrl ? (
        <a
          href={contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors"
        >
          <BookOpen className="h-5 w-5 shrink-0" />
          Open Reading Material
          <ExternalLink className="h-4 w-4 ml-auto" />
        </a>
      ) : (
        <p className="text-slate-400 text-sm italic">No content available for this lesson.</p>
      )}
    </div>
  );
}

// ── External link card ────────────────────────────────────────────────────────

function ExternalCard({
  url, label, icon: Icon, colorClass,
}: {
  url: string;
  label: string;
  icon: typeof ExternalLink;
  colorClass: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-4 rounded-xl border font-bold text-sm hover:opacity-90 transition-opacity ${colorClass}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
      <ExternalLink className="h-4 w-4 ml-auto" />
    </a>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export default function LessonContentRenderer({ contentType, contentUrl, contentText, title, onEnded }: Props) {
  const type = contentType?.toLowerCase() ?? "text";

  return (
    <div className="space-y-5">
      {/* ── Video ──────────────────────────────────────────────────────────── */}
      {type === "video" && (
        contentUrl
          ? <VideoPlayer url={contentUrl} title={title} onEnded={onEnded} />
          : <div className="aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center gap-3">
              <Video className="h-12 w-12 text-slate-600" />
              <p className="text-slate-400 text-sm">Video URL not set for this lesson</p>
            </div>
      )}

      {/* ── PDF ────────────────────────────────────────────────────────────── */}
      {(type === "pdf") && (
        contentUrl
          ? <PDFViewer url={contentUrl} title={title} />
          : <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">PDF URL not set</p>
            </div>
      )}

      {/* ── Text / Reading ─────────────────────────────────────────────────── */}
      {(type === "text" || type === "reading" || type === "article") && (
        <TextContent text={contentText} contentUrl={contentUrl} title={title} />
      )}

      {/* ── Soft skill — usually a video or article ─────────────────────── */}
      {type === "soft_skill" && (
        contentUrl && isYouTube(contentUrl)
          ? <VideoPlayer url={contentUrl} title={title} onEnded={onEnded} />
          : contentUrl
            ? <ExternalCard url={contentUrl} label="Open Soft Skill Resource" icon={Mic} colorClass="bg-pink-50 border-pink-100 text-pink-700" />
            : <TextContent text={contentText} contentUrl={null} />
      )}

      {/* ── Coding exercise ─────────────────────────────────────────────────── */}
      {(type === "coding" || type === "coding_exercise") && (
        <div className="space-y-4">
          {contentText && (
            <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
              <p className="text-xs text-slate-400 font-mono mb-3 uppercase tracking-widest">Problem Statement</p>
              <pre className="text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {contentText}
              </pre>
            </div>
          )}
          {contentUrl && (
            <ExternalCard url={contentUrl} label="Open Coding Exercise" icon={Code2} colorClass="bg-violet-50 border-violet-100 text-violet-700" />
          )}
        </div>
      )}

      {/* ── Quiz ────────────────────────────────────────────────────────────── */}
      {type === "quiz" && (
        <div className="space-y-4">
          {contentText && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <p className="text-sm text-amber-800 leading-relaxed">{contentText}</p>
            </div>
          )}
          {contentUrl && (
            <ExternalCard url={contentUrl} label="Start Quiz" icon={FileText} colorClass="bg-amber-50 border-amber-100 text-amber-700" />
          )}
          {!contentUrl && !contentText && (
            <p className="text-slate-400 text-sm italic p-4">Quiz content not yet available.</p>
          )}
        </div>
      )}

      {/* ── Live session ────────────────────────────────────────────────────── */}
      {type === "live_session" && (
        contentUrl
          ? <ExternalCard url={contentUrl} label="Join Live Session" icon={Calendar} colorClass="bg-emerald-50 border-emerald-100 text-emerald-700" />
          : <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
              <Calendar className="h-5 w-5 mb-2" />
              Live session link will be shared before the session.
            </div>
      )}

      {/* ── Inline text body shown under all content types if present ──────── */}
      {contentText && !["text", "reading", "article", "coding", "coding_exercise", "soft_skill", "quiz"].includes(type) && (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Description</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{contentText}</p>
        </div>
      )}

      {/* ── Unknown type fallback ────────────────────────────────────────────── */}
      {!["video","pdf","text","reading","article","soft_skill","coding","coding_exercise","quiz","live_session"].includes(type) && (
        <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl">
          {contentUrl && (
            <ExternalCard url={contentUrl} label={`Open ${title ?? "Resource"}`} icon={ExternalLink} colorClass="bg-indigo-50 border-indigo-100 text-indigo-700" />
          )}
          {contentText && <p className="text-sm text-slate-600 leading-relaxed mt-3 whitespace-pre-wrap">{contentText}</p>}
        </div>
      )}
    </div>
  );
}
