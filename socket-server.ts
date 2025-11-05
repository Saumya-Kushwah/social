// socket-server.ts - Standalone Socket.IO server with mobile support
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import prisma from "./lib/prisma";
import type { ServerToClientEvents, ClientToServerEvents } from "./types/chat.types";

const PORT: number = parseInt(process.env.PORT || process.env.SOCKET_PORT || "3001", 10);

// // ✅ IMPROVED: Support multiple origins for mobile testing
// const getAllowedOrigins = (): (string | RegExp)[] => {
//   const origins: (string | RegExp)[] = [
//     "http://localhost:3000",
//     "http://localhost:3001",
//     process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
//     /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/, // Local network (192.168.x.x)
//     /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/, // Alternative local network
//     /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:3000$/, // Docker network
//   ];

//   // Add custom origins from environment
//   if (process.env.ALLOWED_ORIGINS) {
//     const customOrigins = process.env.ALLOWED_ORIGINS.split(",");
//     origins.push(...customOrigins);
//   }

//   return origins;
// };

const getAllowedOrigins = (): (string | RegExp)[] => {
  const origins: (string | RegExp)[] = [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    // Add production URL
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.render\.com$/,
  ];

  if (process.env.NODE_ENV === "development") {
    origins.push(
      "http://localhost:3000",
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/,
    );
  }

  if (process.env.ALLOWED_ORIGINS) {
    const customOrigins = process.env.ALLOWED_ORIGINS.split(",");
    origins.push(...customOrigins);
  }

  return origins;
};

const httpServer = createServer();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST"],
    credentials: true,
  },
  // ✅ ADDED: Better transport options for mobile
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Store online users with proper typing
const onlineUsers = new Map<string, string>(); // userId -> socketId

io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  // ✅ ADDED: Log connection details
  const clientIp = socket.handshake.address;
  console.log("✅ Client connected:", socket.id, "from", clientIp);

  // User authentication with type assertion
  const userId: string = socket.handshake.auth.userId as string;
  
  if (userId) {
    onlineUsers.set(userId, socket.id);
    socket.broadcast.emit("user-online", userId);
    console.log(`👤 User ${userId} is now online (${onlineUsers.size} users total)`);
  } else {
    console.warn("⚠️ Client connected without userId");
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
      if (!userId) {
        console.error("❌ Cannot send message: No userId");
        return;
      }

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
      console.log(`📞 ${data.isVideoCall ? 'Video' : 'Voice'} call initiated from ${userId} (${data.callerName}) to ${data.to}`);
    } else {
      console.log(`⚠️ User ${data.to} is not online (can't initiate call)`);
      // Optionally emit a "user-not-available" event back to caller
      socket.emit("call-rejected", {
        callId: data.callId,
        from: data.to,
      });
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
    } else {
      console.log(`⚠️ Cannot accept call: User ${data.to} is not online`);
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
      // Don't log every ICE candidate to reduce noise
    }
  });

  // Handle disconnect
  socket.on("disconnect", (reason: string): void => {
    console.log("❌ Client disconnected:", socket.id, "- Reason:", reason);
    if (userId) {
      onlineUsers.delete(userId);
      socket.broadcast.emit("user-offline", userId);
      console.log(`👤 User ${userId} is now offline (${onlineUsers.size} users remaining)`);
    }
  });

  // ✅ ADDED: Handle errors
  socket.on("error", (error: Error): void => {
    console.error("🔴 Socket error:", error);
  });
});

// Error handling
httpServer.on("error", (err: Error): void => {
  console.error("❌ Socket server error:", err);
  if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
    process.exit(1);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal: string): void => {
  console.log(`\n🛑 ${signal} received, closing server gracefully...`);
  
  // Close socket.io connections
  io.close(() => {
    console.log("✅ All socket connections closed");
    
    // Close HTTP server
    httpServer.close(() => {
      console.log("✅ HTTP server closed");
      
      // Disconnect from database
      prisma.$disconnect().then(() => {
        console.log("✅ Database disconnected");
        process.exit(0);
      }).catch((err) => {
        console.error("❌ Error disconnecting from database:", err);
        process.exit(1);
      });
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
httpServer.listen(PORT, "0.0.0.0", (): void => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 Socket.IO Server Started Successfully");
  console.log("=".repeat(50));
  console.log(`📡 Server URL: http://localhost:${PORT}`);
  console.log(`🌐 Network URL: http://0.0.0.0:${PORT}`);
  console.log(`🔹 WebRTC signaling: ✅ Enabled`);
  console.log(`🔹 CORS: ✅ Configured for local network`);
  console.log(`🔹 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("=".repeat(50) + "\n");
  console.log("📱 Mobile testing:");
  console.log("   1. Find your computer's IP: ipconfig (Windows) or ifconfig (Mac/Linux)");
  console.log("   2. Use http://YOUR_IP:3000 on mobile");
  console.log("   3. Ensure both devices are on the same WiFi network\n");
});