// // server.ts - Updated with WebRTC signaling
// import { createServer } from "http";
// import { Server } from "socket.io";
// import { parse } from "url";
// import next from "next";
// import prisma from './lib/prisma';
// import type { ServerToClientEvents, ClientToServerEvents } from "./types/chat.types";

// const dev = process.env.NODE_ENV !== "production";
// const hostname = "localhost";
// const port = parseInt(process.env.PORT || "3000", 10);

// const app = next({ dev, hostname, port });
// const handler = app.getRequestHandler();

// app.prepare().then(() => {
//   const httpServer = createServer(async (req, res) => {
//     try {
//       const parsedUrl = parse(req.url!, true);
//       await handler(req, res, parsedUrl);
//     } catch (err) {
//       console.error("Error occurred handling", req.url, err);
//       res.statusCode = 500;
//       res.end("internal server error");
//     }
//   });

//   const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
//     cors: {
//       origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
//       methods: ["GET", "POST"],
//     },
//   });

//   // Store online users
//   const onlineUsers = new Map<string, string>(); // userId -> socketId

//   io.on("connection", (socket) => {
//     console.log("✅ Client connected:", socket.id);

//     // User authentication
//     const userId = socket.handshake.auth.userId as string;
    
//     if (userId) {
//       onlineUsers.set(userId, socket.id);
//       socket.broadcast.emit("user-online", userId);
//       console.log(`👤 User ${userId} is now online`);
//     }

//     // Join a conversation room
//     socket.on("join-conversation", (conversationId: string) => {
//       socket.join(conversationId);
//       console.log(`💬 User ${userId} joined conversation ${conversationId}`);
//     });

//     // Leave a conversation room
//     socket.on("leave-conversation", (conversationId: string) => {
//       socket.leave(conversationId);
//       console.log(`👋 User ${userId} left conversation ${conversationId}`);
//     });

//     // Send message
//     socket.on("send-message", async (data: { conversationId: string; content: string }) => {
//       try {
//         if (!userId) return;

//         const message = await prisma.message.create({
//           data: {
//             conversationId: data.conversationId,
//             senderId: userId,
//             content: data.content,
//           },
//           include: {
//             sender: {
//               select: {
//                 id: true,
//                 username: true,
//                 name: true,
//                 image: true,
//               },
//             },
//           },
//         });

//         await prisma.conversation.update({
//           where: { id: data.conversationId },
//           data: { updatedAt: new Date() },
//         });

//         io.to(data.conversationId).emit("new-message", {
//           id: message.id,
//           content: message.content,
//           createdAt: message.createdAt,
//           read: message.read,
//           senderId: message.senderId,
//           sender: {
//             id: message.sender.id,
//             username: message.sender.username,
//             name: message.sender.name,
//             image: message.sender.image,
//           },
//         });

//         console.log(`📨 Message sent in conversation ${data.conversationId}`);
//       } catch (error) {
//         console.error("❌ Error sending message:", error);
//       }
//     });

//     // Mark messages as read
//     socket.on("mark-read", async (conversationId: string) => {
//       try {
//         if (!userId) return;

//         await prisma.$transaction([
//           prisma.message.updateMany({
//             where: {
//               conversationId,
//               senderId: { not: userId },
//               read: false,
//             },
//             data: { read: true },
//           }),
//           prisma.conversationParticipant.updateMany({
//             where: {
//               conversationId,
//               userId,
//             },
//             data: { lastReadAt: new Date() },
//           }),
//         ]);

//         socket.to(conversationId).emit("message-read", { conversationId, userId });
//         console.log(`✓ Messages marked as read in conversation ${conversationId}`);
//       } catch (error) {
//         console.error("❌ Error marking messages as read:", error);
//       }
//     });

//     // Typing indicator
//     socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
//       if (!userId) return;
//       socket.to(data.conversationId).emit("user-typing", {
//         conversationId: data.conversationId,
//         userId,
//         isTyping: data.isTyping,
//       });
//     });

//     // ========== VIDEO CALL SIGNALING ==========

//     // Initiate call
//     socket.on("initiate-call", (data) => {
//       const targetSocketId = onlineUsers.get(data.to);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("call-initiated", {
//           callId: data.callId,
//           from: userId,
//           isVideoCall: data.isVideoCall,
//           callerName: data.callerName,
//           callerImage: data.callerImage,
//         });
//         console.log(`📞 Call initiated from ${userId} to ${data.to}`);
//       }
//     });

//     // Accept call
//     socket.on("accept-call", (data) => {
//       const targetSocketId = onlineUsers.get(data.to);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("call-accepted", {
//           callId: data.callId,
//           from: userId,
//         });
//         console.log(`✓ Call ${data.callId} accepted by ${userId}`);
//       }
//     });

//     // Reject call
//     socket.on("reject-call", (data) => {
//       const targetSocketId = onlineUsers.get(data.to);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("call-rejected", {
//           callId: data.callId,
//           from: userId,
//         });
//         console.log(`✗ Call ${data.callId} rejected by ${userId}`);
//       }
//     });

//     // End call
//     socket.on("end-call", (data) => {
//       const targetSocketId = onlineUsers.get(data.to);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("call-ended", {
//           callId: data.callId,
//           from: userId,
//         });
//         console.log(`📴 Call ${data.callId} ended by ${userId}`);
//       }
//     });

//     // WebRTC Offer
//     socket.on("webrtc-offer", (data) => {
//       const targetSocketId = onlineUsers.get(data.to);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("webrtc-offer", {
//           offer: data.offer,
//           from: userId,
//           callId: data.callId,
//         });
//         console.log(`🔄 WebRTC offer sent from ${userId} to ${data.to}`);
//       }
//     });

//     // WebRTC Answer
//     socket.on("webrtc-answer", (data) => {
//       const targetSocketId = onlineUsers.get(data.to);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("webrtc-answer", {
//           answer: data.answer,
//           from: userId,
//           callId: data.callId,
//         });
//         console.log(`🔄 WebRTC answer sent from ${userId} to ${data.to}`);
//       }
//     });

//     // WebRTC ICE Candidate
//     socket.on("webrtc-ice-candidate", (data) => {
//       const targetSocketId = onlineUsers.get(data.to);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("webrtc-ice-candidate", {
//           candidate: data.candidate,
//           from: userId,
//           callId: data.callId,
//         });
//       }
//     });

//     // Handle disconnect
//     socket.on("disconnect", () => {
//       console.log("❌ Client disconnected:", socket.id);
//       if (userId) {
//         onlineUsers.delete(userId);
//         socket.broadcast.emit("user-offline", userId);
//         console.log(`👤 User ${userId} is now offline`);
//       }
//     });
//   });

//   httpServer
//     .once("error", (err) => {
//       console.error("❌ Server error:", err);
//       process.exit(1);
//     })
//     .listen(port, () => {
//       console.log(`\n🚀 Server ready at http://${hostname}:${port}`);
//       console.log(`📡 Socket.IO server is running`);
//       console.log(`📹 WebRTC signaling enabled`);
//       console.log(`🔥 Environment: ${dev ? "development" : "production"}\n`);
//     });
// });