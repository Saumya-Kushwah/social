"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/types/chat.types";

// ✅ Extend server events with built-in Socket.IO reconnect events
interface SocketExtraEvents {
  reconnect: (attemptNumber: number) => void;
  reconnect_attempt: (attemptNumber: number) => void;
  reconnect_failed: () => void;
}

type ExtendedServerToClientEvents = ServerToClientEvents & SocketExtraEvents;
type SocketType = Socket<ExtendedServerToClientEvents, ClientToServerEvents>;

interface SocketContextType {
  socket: SocketType | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function useSocket(): SocketContextType {
  return useContext(SocketContext);
}

interface SocketProviderProps {
  children: ReactNode;
  userId: string | null;
}

export default function SocketProvider({
  children,
  userId,
}: SocketProviderProps): React.ReactElement {
  const [socket, setSocket] = useState<SocketType | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!userId) return;

    const getSocketURL = (): string => {
      if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const socketPort = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001";
        return `http://${hostname}:${socketPort}`;
      }
      return "http://localhost:3001";
    };

    const SOCKET_URL = getSocketURL();
    console.log("🔌 Connecting to Socket.IO server:", SOCKET_URL);

    const socketInstance: SocketType = io(SOCKET_URL, {
      auth: { userId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socketInstance.on("connect", () => {
      console.log("✅ Socket connected to", SOCKET_URL);
      console.log("   Transport:", socketInstance.io.engine.transport.name);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);

      if (reason === "io server disconnect") {
        console.log("🔄 Server disconnected socket, reconnecting...");
        socketInstance.connect();
      }
    });

    socketInstance.on("connect_error", (error) => {
      console.error("🔴 Socket connection error:", error.message);
      setIsConnected(false);

      if (socketInstance.io.engine.transport.name === "websocket") {
        console.log("⚠️ WebSocket failed, trying polling...");
        socketInstance.io.opts.transports = ["polling", "websocket"];
      }
    });

    socketInstance.on("reconnect", (attemptNumber) => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      setIsConnected(true);
    });

    socketInstance.on("reconnect_attempt", (attemptNumber) => {
      console.log("⏳ Socket reconnection attempt", attemptNumber);
    });

    socketInstance.on("reconnect_failed", () => {
      console.error("❌ Socket reconnection failed after max attempts");
    });

    socketInstance.io.engine.on("upgrade", (transport) => {
      console.log("⬆️ Socket transport upgraded to:", transport.name);
    });

    setSocket(socketInstance);

    return () => {
      console.log("🔌 Disconnecting socket...");
      socketInstance.disconnect();
    };
  }, [userId]);

  useEffect(() => {
    console.log(isConnected ? "🟢 Socket is connected and ready" : "🔴 Socket is disconnected");
  }, [isConnected]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
