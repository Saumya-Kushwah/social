"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { useSocket } from "./SocketProvider";
import { useWebRTC } from "@/hooks/useWebRTC";
import VideoCallUI from "./VideoCallUI";
import IncomingCallModal from "./IncomingCallModal";
import type { CallInitiatedData, ChatUser } from "@/types/chat.types";

interface CallContextType {
  startVoiceCall: (user: ChatUser) => void;
  startVideoCall: (user: ChatUser) => void;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
}

interface CallProviderProps {
  children: ReactNode;
  currentUserId: string | null;
  currentUser: ChatUser | null;
}

export default function CallProvider({
  children,
  currentUserId,
  currentUser,
}: CallProviderProps) {
  const { socket } = useSocket();
  const [incomingCall, setIncomingCall] = useState<CallInitiatedData | null>(
    null
  );
  const incomingCallRef = useRef<CallInitiatedData | null>(null);

  const webrtc = useWebRTC({
    currentUserId: currentUserId || "",
    currentUser: currentUser || {
      id: currentUserId || "",
      username: "Unknown",
      name: "Unknown",
      image: null,
    },
    onCallEnded: () => {
      setIncomingCall(null);
      incomingCallRef.current = null;
    },
  });

  // Handle incoming call
  useEffect(() => {
    if (!socket) return;

    const handleCallInitiated = (data: CallInitiatedData) => {
      console.log("📞 Incoming call from:", data.callerName);

      if (incomingCallRef.current?.callId === data.callId) {
        console.log("⚠️ Duplicate call notification, ignoring...");
        return;
      }

      if (webrtc.callStatus === "idle") {
        incomingCallRef.current = data;
        setIncomingCall(data);
      } else {
        console.log("⚠️ Already in a call, auto-rejecting...");
        socket.emit("reject-call", {
          to: data.from,
          callId: data.callId,
        });
      }
    };

    socket.on("call-initiated", handleCallInitiated);

    return () => {
      socket.off("call-initiated", handleCallInitiated);
    };
  }, [socket, webrtc.callStatus]);

  // Handle socket disconnect during call
  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = () => {
      if (webrtc.callStatus !== "idle") {
        console.log("🔴 Socket disconnected during call, ending call...");
        webrtc.endCall();
      }
    };

    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket, webrtc.callStatus, webrtc.endCall]);

  const startVoiceCall = (user: ChatUser) => {
    setIncomingCall(null);
    incomingCallRef.current = null;
    webrtc.startCall(user, false);
  };

  const startVideoCall = (user: ChatUser) => {
    setIncomingCall(null);
    incomingCallRef.current = null;
    webrtc.startCall(user, true);
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      const otherUser: ChatUser = {
        id: incomingCall.from,
        username: incomingCall.callerName,
        name: incomingCall.callerName,
        image: incomingCall.callerImage,
      };

      // ✅ FIX: Pass the full otherUser object to answerCall
      webrtc.answerCall(
        incomingCall.callId,
        otherUser,
        incomingCall.isVideoCall
      );

      // ❌ FIX: Removed the incorrect manual state mutation
      // (webrtc.otherUser = otherUser;)

      setIncomingCall(null);
      incomingCallRef.current = null;
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      webrtc.rejectCall(incomingCall.callId, incomingCall.from);
      setIncomingCall(null);
      incomingCallRef.current = null;
    }
  };

  return (
    <CallContext.Provider value={{ startVoiceCall, startVideoCall }}>
      {children}

      {/* Incoming Call Modal */}
      {incomingCall && webrtc.callStatus === "idle" && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          callerImage={incomingCall.callerImage}
          isVideoCall={incomingCall.isVideoCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Video Call UI */}
      {webrtc.callStatus !== "idle" && webrtc.otherUser && (
        <VideoCallUI
          localStream={webrtc.localStream}
          remoteStream={webrtc.remoteStream}
          isVideoEnabled={webrtc.isVideoEnabled}
          isAudioEnabled={webrtc.isAudioEnabled}
          isScreenSharing={webrtc.isScreenSharing}
          callStatus={webrtc.callStatus}
          otherUser={webrtc.otherUser}
          error={webrtc.error}
          onToggleVideo={webrtc.toggleVideo}
          onToggleAudio={webrtc.toggleAudio}
          onToggleScreenShare={webrtc.toggleScreenShare}
          onEndCall={webrtc.endCall}
        />
      )}
    </CallContext.Provider>
  );
}