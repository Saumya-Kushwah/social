"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
}

export default function CallProvider({ children, currentUserId }: CallProviderProps) {
  const { socket } = useSocket();
  const [incomingCall, setIncomingCall] = useState<CallInitiatedData | null>(null);

  const webrtc = useWebRTC({
    currentUserId: currentUserId || "",
    onCallEnded: () => {
      setIncomingCall(null);
    },
  });

  // Handle incoming call
  useEffect(() => {
    if (!socket) return;

    socket.on("call-initiated", (data: CallInitiatedData) => {
      // Only show incoming call if not already in a call
      if (webrtc.callStatus === "idle") {
        setIncomingCall(data);
      }
    });

    return () => {
      socket.off("call-initiated");
    };
  }, [socket, webrtc.callStatus]);

  const startVoiceCall = (user: ChatUser) => {
    webrtc.startCall(user, false);
  };

  const startVideoCall = (user: ChatUser) => {
    webrtc.startCall(user, true);
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      webrtc.answerCall(incomingCall.callId, incomingCall.from, incomingCall.isVideoCall);
      setIncomingCall(null);
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      webrtc.rejectCall(incomingCall.callId, incomingCall.from);
      setIncomingCall(null);
    }
  };

  return (
    <CallContext.Provider value={{ startVoiceCall, startVideoCall }}>
      {children}

      {/* Incoming Call Modal */}
      {incomingCall && (
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
          onToggleVideo={webrtc.toggleVideo}
          onToggleAudio={webrtc.toggleAudio}
          onToggleScreenShare={webrtc.toggleScreenShare}
          onEndCall={webrtc.endCall}
        />
      )}
    </CallContext.Provider>
  );
}