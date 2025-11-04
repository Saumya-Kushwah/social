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

    // Connect to standalone Socket.IO server (port 3001)
    const SOCKET_URL: string = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    
    const socketInstance: SocketType = io(SOCKET_URL, {
      auth: {
        userId,
      },
      transports: ["websocket", "polling"], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketInstance.on("connect", (): void => {
      console.log("✅ Socket connected to", SOCKET_URL);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", (reason: Socket.DisconnectReason): void => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error: Error): void => {
      console.error("🔴 Socket connection error:", error.message);
      setIsConnected(false);
    });

    socketInstance.on("reconnect", (attemptNumber: number): void => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      setIsConnected(true);
    });

    socketInstance.on("reconnect_attempt", (attemptNumber: number): void => {
      console.log("⏳ Socket reconnection attempt", attemptNumber);
    });

    setSocket(socketInstance);

    return (): void => {
      console.log("🔌 Disconnecting socket...");
      socketInstance.disconnect();
    };
  }, [userId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}