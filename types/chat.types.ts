// types/chat.types.ts

export interface ChatUser {
  id: string;
  username: string;
  name: string | null;
  image: string | null;
  online?: boolean;
}

export interface UserBasic {
  id: string;
  username: string;
  name: string | null;
  image: string | null;
}

export interface MessageWithSender {
  id: string;
  content: string;
  createdAt: Date;
  read: boolean;
  senderId: string;
  sender: {
    id: string;
    username: string;
    name: string | null;
    image: string | null;
  };
}

export interface LastMessage {
  id: string;
  content: string;
  createdAt: Date;
  senderId: string;
  read: boolean;
}

export interface ConversationWithDetails {
  id: string;
  updatedAt: Date;
  otherUser: ChatUser;
  lastMessage: LastMessage | null;
  unreadCount: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
  image: string | null;
}

export interface Message {
  id: string;
  content: string;
  createdAt: Date;
  read: boolean;
  senderId: string;
  sender: User;
}

export interface Conversation {
  id: string;
  participants: User[];
  lastMessage?: Message;
  updatedAt: Date;
  unreadCount?: number;
}

// Socket.IO Events
export interface ServerToClientEvents {
  "new-message": (message: MessageWithSender) => void;
  "message-read": (data: { conversationId: string; userId: string }) => void;
  "user-typing": (data: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  "user-online": (userId: string) => void;
  "user-offline": (userId: string) => void;
  
  // Video call events
  "call-initiated": (data: CallInitiatedData) => void;
  "call-accepted": (data: { callId: string; from: string }) => void;
  "call-rejected": (data: { callId: string; from: string }) => void;
  "call-ended": (data: { callId: string; from: string }) => void;
  "webrtc-offer": (data: { offer: RTCSessionDescriptionInit; from: string; callId: string }) => void;
  "webrtc-answer": (data: { answer: RTCSessionDescriptionInit; from: string; callId: string }) => void;
  "webrtc-ice-candidate": (data: { candidate: RTCIceCandidateInit; from: string; callId: string }) => void;
}

export interface ClientToServerEvents {
  "join-conversation": (conversationId: string) => void;
  "leave-conversation": (conversationId: string) => void;
  "send-message": (data: { conversationId: string; content: string }) => void;
  "mark-read": (conversationId: string) => void;
  "typing": (data: { conversationId: string; isTyping: boolean }) => void;
  
  // Video call events
  "initiate-call": (data: { to: string; callId: string; isVideoCall: boolean; callerName: string; callerImage: string | null }) => void;
  "accept-call": (data: { to: string; callId: string }) => void;
  "reject-call": (data: { to: string; callId: string }) => void;
  "end-call": (data: { to: string; callId: string }) => void;
  "webrtc-offer": (data: { to: string; offer: RTCSessionDescriptionInit; callId: string }) => void;
  "webrtc-answer": (data: { to: string; answer: RTCSessionDescriptionInit; callId: string }) => void;
  "webrtc-ice-candidate": (data: { to: string; candidate: RTCIceCandidateInit; callId: string }) => void;
}

// Video call types
export interface CallInitiatedData {
  callId: string;
  from: string;
  isVideoCall: boolean;
  callerName: string;
  callerImage: string | null;
}

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface CallState {
  callId: string | null;
  status: CallStatus;
  isVideoCall: boolean;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  otherUser: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}