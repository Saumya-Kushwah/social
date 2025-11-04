// hooks/useWebRTC.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import type { CallStatus, ChatUser } from "@/types/chat.types";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface UseWebRTCProps {
  currentUserId: string;
  onCallEnded?: () => void;
}

export function useWebRTC({ currentUserId, onCallEnded }: UseWebRTCProps) {
  const { socket } = useSocket();
  
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [otherUser, setOtherUser] = useState<ChatUser | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const otherUserIdRef = useRef<string | null>(null);

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && otherUserIdRef.current && callId) {
        socket.emit("webrtc-ice-candidate", {
          to: otherUserIdRef.current,
          candidate: event.candidate.toJSON(),
          callId,
        });
      }
    };

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        endCall();
      }
    };

    return pc;
  }, [socket, callId]);

  // Get user media
  const getUserMedia = useCallback(async (video: boolean, audio: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("Error getting user media:", error);
      throw error;
    }
  }, []);

  // Start call (initiator)
  const startCall = useCallback(
    async (user: ChatUser, video: boolean = true) => {
      try {
        const newCallId = `call-${Date.now()}`;
        setCallId(newCallId);
        setIsVideoCall(video);
        setOtherUser(user);
        setCallStatus("calling");
        otherUserIdRef.current = user.id;

        // Get user media
        const stream = await getUserMedia(video, true);
        
        // Create peer connection
        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        // Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Send call initiation
        if (socket) {
          socket.emit("initiate-call", {
            to: user.id,
            callId: newCallId,
            isVideoCall: video,
            callerName: "You", // This should be actual user name
            callerImage: null,
          });
        }
      } catch (error) {
        console.error("Error starting call:", error);
        setCallStatus("idle");
      }
    },
    [socket, getUserMedia, createPeerConnection]
  );

  // Answer call (receiver)
  const answerCall = useCallback(
    async (incomingCallId: string, fromUserId: string, video: boolean) => {
      try {
        setCallId(incomingCallId);
        setIsVideoCall(video);
        setCallStatus("connected");
        otherUserIdRef.current = fromUserId;

        // Get user media
        const stream = await getUserMedia(video, true);

        // Create peer connection
        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        // Add tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Accept call
        if (socket) {
          socket.emit("accept-call", {
            to: fromUserId,
            callId: incomingCallId,
          });
        }
      } catch (error) {
        console.error("Error answering call:", error);
        rejectCall(incomingCallId, fromUserId);
      }
    },
    [socket, getUserMedia, createPeerConnection]
  );

  // Reject call
  const rejectCall = useCallback(
    (incomingCallId: string, fromUserId: string) => {
      if (socket) {
        socket.emit("reject-call", {
          to: fromUserId,
          callId: incomingCallId,
        });
      }
      setCallStatus("idle");
      setCallId(null);
      setOtherUser(null);
    },
    [socket]
  );

  // End call
  const endCall = useCallback(() => {
    if (socket && otherUserIdRef.current && callId) {
      socket.emit("end-call", {
        to: otherUserIdRef.current,
        callId,
      });
    }

    // Stop all tracks
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    
    // Close peer connection
    peerConnectionRef.current?.close();
    
    // Reset state
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    screenStreamRef.current = null;
    otherUserIdRef.current = null;
    
    setCallStatus("idle");
    setCallId(null);
    setOtherUser(null);
    setIsScreenSharing(false);
    
    onCallEnded?.();
  }, [socket, callId, onCallEnded]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        screenStreamRef.current = screenStream;

        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        videoTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }

        screenStreamRef.current?.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  }, [isScreenSharing]);

  // Handle Socket.IO events
  useEffect(() => {
    if (!socket) return;

    // Handle call accepted
    socket.on("call-accepted", async ({ callId: acceptedCallId, from }) => {
      if (callId === acceptedCallId && peerConnectionRef.current) {
        try {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);

          socket.emit("webrtc-offer", {
            to: from,
            offer,
            callId: acceptedCallId,
          });
        } catch (error) {
          console.error("Error creating offer:", error);
        }
      }
    });

    // Handle WebRTC offer
    socket.on("webrtc-offer", async ({ offer, from, callId: offerCallId }) => {
      if (peerConnectionRef.current && callId === offerCallId) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(offer)
          );

          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);

          socket.emit("webrtc-answer", {
            to: from,
            answer,
            callId: offerCallId,
          });
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      }
    });

    // Handle WebRTC answer
    socket.on("webrtc-answer", async ({ answer, callId: answerCallId }) => {
      if (peerConnectionRef.current && callId === answerCallId) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        } catch (error) {
          console.error("Error handling answer:", error);
        }
      }
    });

    // Handle ICE candidate
    socket.on("webrtc-ice-candidate", async ({ candidate, callId: candidateCallId }) => {
      if (peerConnectionRef.current && callId === candidateCallId) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    // Handle call rejected
    socket.on("call-rejected", () => {
      endCall();
    });

    // Handle call ended
    socket.on("call-ended", () => {
      endCall();
    });

    return () => {
      socket.off("call-accepted");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
      socket.off("call-rejected");
      socket.off("call-ended");
    };
  }, [socket, callId, endCall]);

  return {
    callStatus,
    callId,
    isVideoCall,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    otherUser,
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
  };
}