"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/types/chat.types";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

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
  userId 
}: SocketProviderProps): JSX.Element {
  const [socket, setSocket] = useState<SocketType | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect((): (() => void) | undefined => {
    if (!userId) return;

    // ✅ IMPROVED: Dynamic socket URL for mobile support
    const getSocketURL = (): string => {
      // Use environment variable if set
      if (process.env.NEXT_PUBLIC_SOCKET_URL) {
        return process.env.NEXT_PUBLIC_SOCKET_URL;
      }

      // In browser, use current hostname with socket port
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const socketPort = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001";
        return `http://${hostname}:${socketPort}`;
      }

      // Fallback
      return "http://localhost:3001";
    };

    const SOCKET_URL: string = getSocketURL();
    console.log("🔌 Connecting to Socket.IO server:", SOCKET_URL);
    
    const socketInstance: SocketType = io(SOCKET_URL, {
      auth: {
        userId,
      },
      transports: ["websocket", "polling"], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000, // 20 seconds timeout
    });

    socketInstance.on("connect", (): void => {
      console.log("✅ Socket connected to", SOCKET_URL);
      console.log("   Transport:", socketInstance.io.engine.transport.name);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", (reason: Socket.DisconnectReason): void => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
      
      if (reason === "io server disconnect") {
        // Server disconnected the socket, reconnect manually
        console.log("🔄 Server disconnected socket, reconnecting...");
        socketInstance.connect();
      }
    });

    socketInstance.on("connect_error", (error: Error): void => {
      console.error("🔴 Socket connection error:", error.message);
      setIsConnected(false);
      
      // Switch to polling if websocket fails
      if (socketInstance.io.engine.transport.name === "websocket") {
        console.log("⚠️ WebSocket failed, trying polling...");
        socketInstance.io.opts.transports = ["polling", "websocket"];
      }
    });

    socketInstance.on("reconnect", (attemptNumber: number): void => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      setIsConnected(true);
    });

    socketInstance.on("reconnect_attempt", (attemptNumber: number): void => {
      console.log("⏳ Socket reconnection attempt", attemptNumber);
    });

    socketInstance.on("reconnect_failed", (): void => {
      console.error("❌ Socket reconnection failed after max attempts");
    });

    // ✅ ADDED: Handle transport upgrades
    socketInstance.io.engine.on("upgrade", (transport): void => {
      console.log("⬆️ Socket transport upgraded to:", transport.name);
    });

    setSocket(socketInstance);

    return (): void => {
      console.log("🔌 Disconnecting socket...");
      socketInstance.disconnect();
    };
  }, [userId]);

  // ✅ ADDED: Log connection status changes
  useEffect(() => {
    if (isConnected) {
      console.log("🟢 Socket is connected and ready");
    } else {
      console.log("🔴 Socket is disconnected");
    }
  }, [isConnected]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}