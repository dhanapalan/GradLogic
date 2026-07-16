import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { allowedCorsOrigins, isAllowedCorsOrigin } from "./corsOrigins.js";
import { logger } from "./logger.js";

let io: Server;

export const initSocketIO = (server: HTTPServer): Server => {
  io = new Server(server, {
    cors: {
      origin: allowedCorsOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, isAllowedCorsOrigin(typeof origin === "string" ? origin : undefined));
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Proctoring namespace
  const proctoringNs = io.of("/proctoring");

  proctoringNs.on("connection", (socket: Socket) => {
    logger.debug(`Proctoring client connected: ${socket.id}`);

    socket.on("join-session", (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      logger.debug(`Socket ${socket.id} joined session:${sessionId}`);
    });

    // Receive face verification snapshots from client
    socket.on("face-snapshot", (data: { sessionId: string; image: string; timestamp: number }) => {
      // Forward to AI engine for face match verification
      proctoringNs.to(`session:${data.sessionId}`).emit("face-snapshot-ack", {
        timestamp: data.timestamp,
        status: "received",
      });
    });

    // Browser focus events
    socket.on("browser-event", (data: { sessionId: string; event: string; timestamp: number }) => {
      logger.warn(`Browser event [${data.event}] in session ${data.sessionId}`);
      proctoringNs.to(`session:${data.sessionId}`).emit("violation-alert", {
        type: data.event,
        timestamp: data.timestamp,
      });
    });

    socket.on("disconnect", (reason) => {
      logger.debug(`Proctoring client disconnected: ${socket.id} — ${reason}`);
    });
  });

  logger.info("✓ Socket.IO proctoring namespace initialized");
  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};
