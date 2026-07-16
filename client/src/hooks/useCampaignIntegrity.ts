/**
 * Phase 2 Module 09 — browser integrity capture for college campaign attempts.
 * Fire-and-forget logging; never blocks autosave/submit.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../lib/api";

export interface CampaignIntegritySettings {
  proctoring_enabled: boolean;
  require_fullscreen: boolean;
  detect_tab_switch: boolean;
  detect_window_blur: boolean;
  detect_copy_paste: boolean;
  detect_multi_monitor: boolean;
  require_camera: boolean;
  require_microphone: boolean;
  tab_switch_limit: number;
  integrity_auto_flag: boolean;
}

interface UseCampaignIntegrityOptions {
  campaignId: string;
  enabled: boolean;
  settings: CampaignIntegritySettings | null | undefined;
  onScoreChange?: (score: number, status: string) => void;
}

export function useCampaignIntegrity({
  campaignId,
  enabled,
  settings,
  onScoreChange,
}: UseCampaignIntegrityOptions) {
  const lastEventTimeMap = useRef<Record<string, number>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [fullscreenOk, setFullscreenOk] = useState(!!document.fullscreenElement);

  const active = enabled && !!settings?.proctoring_enabled && !!campaignId;

  const logEvent = useCallback(
    (eventType: string, metadata?: Record<string, unknown>) => {
      if (!active) return;
      const now = Date.now();
      const last = lastEventTimeMap.current[eventType] || 0;
      if (now - last < 2000) return;
      lastEventTimeMap.current[eventType] = now;

      api
        .post(`/student-assessments/my-assessments/${campaignId}/attempt/integrity/events`, {
          event_type: eventType,
          metadata: { ...metadata, timestamp: new Date().toISOString() },
        })
        .then((res) => {
          const data = res.data?.data;
          if (data?.score != null) {
            setIntegrityScore(Number(data.score));
            onScoreChange?.(Number(data.score), String(data.integrity_status || ""));
          }
        })
        .catch(() => {
          /* fail-open: exam continues if integrity API is down */
        });
    },
    [active, campaignId, onScoreChange]
  );

  // Media: camera / microphone monitoring
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const startMedia = async () => {
      const needCam = !!settings?.require_camera;
      const needMic = !!settings?.require_microphone;
      if (!needCam && !needMic) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: needCam ? { facingMode: "user" } : false,
          audio: needMic,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraActive(stream.getVideoTracks().some((t) => t.readyState === "live"));
        setMicActive(stream.getAudioTracks().some((t) => t.readyState === "live"));
        if (needCam) logEvent("CAMERA_OK");
        if (needMic) logEvent("MICROPHONE_OK");

        // Bind hidden video for frame sampling (AI / heuristic face checks)
        if (needCam) {
          let video = videoRef.current;
          if (!video) {
            video = document.createElement("video");
            video.muted = true;
            video.playsInline = true;
            video.setAttribute("playsinline", "true");
            video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px";
            document.body.appendChild(video);
            videoRef.current = video;
          }
          video.srcObject = stream;
          void video.play().catch(() => {});

          if (!canvasRef.current) {
            canvasRef.current = document.createElement("canvas");
          }

          if (analyzeTimerRef.current) clearInterval(analyzeTimerRef.current);
          analyzeTimerRef.current = setInterval(() => {
            const v = videoRef.current;
            const c = canvasRef.current;
            if (!v || !c || v.videoWidth < 16) return;
            c.width = Math.min(v.videoWidth, 320);
            c.height = Math.min(v.videoHeight, 240);
            const ctx = c.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const image = c.toDataURL("image/jpeg", 0.6);
            api
              .post("/platform/proctoring/analyze", { campaign_id: campaignId, image })
              .then((res) => {
                const data = res.data?.data;
                if (data?.logged?.score != null) {
                  setIntegrityScore(Number(data.logged.score));
                  onScoreChange?.(
                    Number(data.logged.score),
                    String(data.logged.integrity_status || "")
                  );
                } else if (data?.is_anomaly && data?.event_type) {
                  // Score may arrive via event log response shape
                }
              })
              .catch(() => {
                /* fail-open */
              });
          }, 5000);
        }

        stream.getTracks().forEach((track) => {
          track.onended = () => {
            if (track.kind === "video") {
              setCameraActive(false);
              logEvent("CAMERA_OFF");
            }
            if (track.kind === "audio") {
              setMicActive(false);
              logEvent("MICROPHONE_OFF");
            }
          };
        });
      } catch {
        if (needCam) {
          setCameraActive(false);
          logEvent("CAMERA_DENIED");
        }
        if (needMic) {
          setMicActive(false);
          logEvent("MICROPHONE_DENIED");
        }
      }
    };

    void startMedia();

    return () => {
      cancelled = true;
      if (analyzeTimerRef.current) {
        clearInterval(analyzeTimerRef.current);
        analyzeTimerRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, [
    active,
    campaignId,
    settings?.require_camera,
    settings?.require_microphone,
    logEvent,
    onScoreChange,
  ]);

  // Fullscreen request when required
  useEffect(() => {
    if (!active || !settings?.require_fullscreen) return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        logEvent("FULLSCREEN_EXIT", { reason: "request_failed" });
      });
    }
  }, [active, settings?.require_fullscreen, logEvent]);

  // Browser event listeners
  useEffect(() => {
    if (!active || !settings) return;

    const onVisibility = () => {
      if (!settings.detect_tab_switch) return;
      logEvent("TAB_SWITCH", { state: document.visibilityState });
    };

    const onBlur = () => {
      if (!settings.detect_window_blur) return;
      logEvent("WINDOW_BLUR");
    };

    const onCopy = (e: ClipboardEvent) => {
      if (!settings.detect_copy_paste) return;
      logEvent("COPY_ATTEMPT");
      e.preventDefault();
    };

    const onPaste = (e: ClipboardEvent) => {
      if (!settings.detect_copy_paste) return;
      logEvent("PASTE_ATTEMPT");
      e.preventDefault();
    };

    const onContext = (e: MouseEvent) => {
      if (!settings.detect_copy_paste) return;
      logEvent("RIGHT_CLICK");
      e.preventDefault();
    };

    const onFullscreen = () => {
      const ok = !!document.fullscreenElement;
      setFullscreenOk(ok);
      if (!ok) logEvent("FULLSCREEN_EXIT");
      else logEvent("FULLSCREEN_ENTER");
    };

    const onOffline = () => {
      setOffline(true);
      logEvent("NETWORK_DISCONNECT", { status: "offline" });
    };

    const onOnline = () => {
      setOffline(false);
      logEvent("NETWORK_RECONNECT", { status: "online" });
    };

    const checkMultiMonitor = () => {
      if (!settings.detect_multi_monitor) return;
      const screenAny = window.screen as Screen & { isExtended?: boolean };
      if (screenAny.isExtended === true) {
        logEvent("MULTI_MONITOR", { method: "isExtended" });
        return;
      }
      // Heuristic: secondary display often widens avail vs window
      if (window.screen.width > window.screen.availWidth + 100) {
        logEvent("MULTI_MONITOR", {
          method: "availWidth",
          screenWidth: window.screen.width,
          availWidth: window.screen.availWidth,
        });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    checkMultiMonitor();
    const multiTimer = window.setInterval(checkMultiMonitor, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.clearInterval(multiTimer);
    };
  }, [active, settings, logEvent]);

  return {
    logEvent,
    integrityScore,
    cameraActive,
    micActive,
    offline,
    fullscreenOk,
    proctoringActive: active,
  };
}
