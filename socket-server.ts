// socket-server.ts - Standalone Socket.IO server (separate from Next.js)
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import prisma from "./lib/prisma";
import type { ServerToClientEvents, ClientToServerEvents } from "./types/chat.types";

const PORT: number = parseInt(process.env.SOCKET_PORT || "3001", 10);
const CORS_ORIGIN: string = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const httpServer = createServer();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Store online users with proper typing
const onlineUsers = new Map<string, string>(); // userId -> socketId

io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log("✅ Client connected:", socket.id);

  // User authentication with type assertion
  const userId: string = socket.handshake.auth.userId as string;
  
  if (userId) {
    onlineUsers.set(userId, socket.id);
    socket.broadcast.emit("user-online", userId);
    console.log(`👤 User ${userId} is now online (${onlineUsers.size} users total)`);
  }

  // Join a conversation room
  socket.on("join-conversation", (conversationId: string): void => {
    socket.join(conversationId);
    console.log(`💬 User ${userId} joined conversation ${conversationId}`);
  });

  // Leave a conversation room
  socket.on("leave-conversation", (conversationId: string): void => {
    socket.leave(conversationId);
    console.log(`👋 User ${userId} left conversation ${conversationId}`);
  });

  // Send message
  socket.on("send-message", async (data: { conversationId: string; content: string }): Promise<void> => {
    try {
      if (!userId) return;

      const message = await prisma.message.create({
        data: {
          conversationId: data.conversationId,
          senderId: userId,
          content: data.content,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              name: true,
              image: true,
            },
          },
        },
      });

      await prisma.conversation.update({
        where: { id: data.conversationId },
        data: { updatedAt: new Date() },
      });

      io.to(data.conversationId).emit("new-message", {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        read: message.read,
        senderId: message.senderId,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          name: message.sender.name,
          image: message.sender.image,
        },
      });

      console.log(`📨 Message sent in conversation ${data.conversationId}`);
    } catch (error: unknown) {
      console.error("❌ Error sending message:", error);
    }
  });

  // Mark messages as read
  socket.on("mark-read", async (conversationId: string): Promise<void> => {
    try {
      if (!userId) return;

      await prisma.$transaction([
        prisma.message.updateMany({
          where: {
            conversationId,
            senderId: { not: userId },
            read: false,
          },
          data: { read: true },
        }),
        prisma.conversationParticipant.updateMany({
          where: {
            conversationId,
            userId,
          },
          data: { lastReadAt: new Date() },
        }),
      ]);

      socket.to(conversationId).emit("message-read", { conversationId, userId });
      console.log(`✓ Messages marked as read in conversation ${conversationId}`);
    } catch (error: unknown) {
      console.error("❌ Error marking messages as read:", error);
    }
  });

  // Typing indicator
  socket.on("typing", (data: { conversationId: string; isTyping: boolean }): void => {
    if (!userId) return;
    socket.to(data.conversationId).emit("user-typing", {
      conversationId: data.conversationId,
      userId,
      isTyping: data.isTyping,
    });
  });

  // ========== VIDEO CALL SIGNALING ==========

  // Initiate call
  socket.on("initiate-call", (data: { 
    to: string; 
    callId: string; 
    isVideoCall: boolean; 
    callerName: string; 
    callerImage: string | null 
  }): void => {
    const targetSocketId: string | undefined = onlineUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-initiated", {
        callId: data.callId,
        from: userId,
        isVideoCall: data.isVideoCall,
        callerName: data.callerName,
        callerImage: data.callerImage,
      });
      console.log(`📞 Call initiated from ${userId} to ${data.to}`);
    } else {
      console.log(`⚠️ User ${data.to} is not online`);
    }
  });

  // Accept call
  socket.on("accept-call", (data: { to: string; callId: string }): void => {
    const targetSocketId: string | undefined = onlineUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-accepted", {
        callId: data.callId,
        from: userId,
      });
      console.log(`✓ Call ${data.callId} accepted by ${userId}`);
    }
  });

  // Reject call
  socket.on("reject-call", (data: { to: string; callId: string }): void => {
    const targetSocketId: string | undefined = onlineUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-rejected", {
        callId: data.callId,
        from: userId,
      });
      console.log(`✗ Call ${data.callId} rejected by ${userId}`);
    }
  });

  // End call
  socket.on("end-call", (data: { to: string; callId: string }): void => {
    const targetSocketId: string | undefined = onlineUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended", {
        callId: data.callId,
        from: userId,
      });
      console.log(`🔴 Call ${data.callId} ended by ${userId}`);
    }
  });

  // WebRTC Offer
  socket.on("webrtc-offer", (data: { 
    to: string; 
    offer: RTCSessionDescriptionInit; 
    callId: string 
  }): void => {
    const targetSocketId: string | undefined = onlineUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("webrtc-offer", {
        offer: data.offer,
        from: userId,
        callId: data.callId,
      });
      console.log(`🔄 WebRTC offer sent from ${userId} to ${data.to}`);
    } else {
      console.log(`⚠️ Cannot send offer: User ${data.to} is not online`);
    }
  });

  // WebRTC Answer
  socket.on("webrtc-answer", (data: { 
    to: string; 
    answer: RTCSessionDescriptionInit; 
    callId: string 
  }): void => {
    const targetSocketId: string | undefined = onlineUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("webrtc-answer", {
        answer: data.answer,
        from: userId,
        callId: data.callId,
      });
      console.log(`🔄 WebRTC answer sent from ${userId} to ${data.to}`);
    } else {
      console.log(`⚠️ Cannot send answer: User ${data.to} is not online`);
    }
  });

  // WebRTC ICE Candidate
  socket.on("webrtc-ice-candidate", (data: { 
    to: string; 
    candidate: RTCIceCandidateInit; 
    callId: string 
  }): void => {
    const targetSocketId: string | undefined = onlineUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("webrtc-ice-candidate", {
        candidate: data.candidate,
        from: userId,
        callId: data.callId,
      });
      console.log(`🧊 ICE candidate sent from ${userId} to ${data.to}`);
    }
  });

  // Handle disconnect
  socket.on("disconnect", (): void => {
    console.log("❌ Client disconnected:", socket.id);
    if (userId) {
      onlineUsers.delete(userId);
      socket.broadcast.emit("user-offline", userId);
      console.log(`👤 User ${userId} is now offline (${onlineUsers.size} users remaining)`);
    }
  });
});

// Error handling
httpServer.on("error", (err: Error): void => {
  console.error("❌ Socket server error:", err);
});

// Graceful shutdown
process.on("SIGTERM", (): void => {
  console.log("🛑 SIGTERM received, closing server gracefully...");
  httpServer.close((): void => {
    prisma.$disconnect().then((): void => {
      console.log("✅ Socket server closed and database disconnected");
      process.exit(0);
    });
  });
});

process.on("SIGINT", (): void => {
  console.log("🛑 SIGINT received, closing server gracefully...");
  httpServer.close((): void => {
    prisma.$disconnect().then((): void => {
      console.log("✅ Socket server closed and database disconnected");
      process.exit(0);
    });
  });
});

// Start server
httpServer.listen(PORT, (): void => {
  console.log(`\n🚀 Socket.IO server ready at http://localhost:${PORT}`);
  console.log(`📡 Accepting connections from ${CORS_ORIGIN}`);
  console.log(`🔹 WebRTC signaling enabled`);
  console.log(`🟢 Server is stable and ready\n`);
});