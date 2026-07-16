import { io, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.gradlogic.atherasys.com";

let proctoringSocket: Socket | null = null;

export function connectProctoringSocket(): Socket {
  if (proctoringSocket?.connected) return proctoringSocket;

  proctoringSocket = io(`${API_BASE}/proctoring`, {
    path: "/socket.io/",
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: {
      token: sessionStorage.getItem("accessToken"),
    },
  });

  return proctoringSocket;
}

export function disconnectProctoringSocket(): void {
  proctoringSocket?.disconnect();
  proctoringSocket = null;
}

export function getProctoringSocket(): Socket | null {
  return proctoringSocket;
}

// ── General / Notifications Namespace ────────────────────────────────────────

let generalSocket: Socket | null = null;

export function connectGeneralSocket(): Socket {
  if (generalSocket?.connected) return generalSocket;

  generalSocket = io(API_BASE, {
    path: "/socket.io/",
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: {
      token: sessionStorage.getItem("accessToken"),
    },
  });

  return generalSocket;
}

export function disconnectGeneralSocket(): void {
  generalSocket?.disconnect();
  generalSocket = null;
}

export function getGeneralSocket(): Socket | null {
  return generalSocket;
}
