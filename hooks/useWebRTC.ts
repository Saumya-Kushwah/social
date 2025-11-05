// hooks/useWebRTC.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import type { CallStatus, ChatUser } from "@/types/chat.types";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // ✅ Add TURN servers for production (uncomment and configure)
    // {
    //   urls: "turn:your-turn-server.com:3478",
    //   username: "username",
    //   credential: "password"
    // }
  ],
};

interface UseWebRTCProps {
  currentUserId: string;
  currentUser: ChatUser; // ✅ ADDED: Current user data
  onCallEnded?: () => void;
}

export function useWebRTC({ currentUserId, currentUser, onCallEnded }: UseWebRTCProps) {
  const { socket } = useSocket();
  
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [otherUser, setOtherUser] = useState<ChatUser | null>(null);
  const [error, setError] = useState<string | null>(null); // ✅ ADDED: Error state
  
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
        console.log("🧊 ICE candidate sent");
      }
    };

    pc.ontrack = (event) => {
      console.log("📥 Remote track received");
      remoteStreamRef.current = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      console.log("🔄 Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        setError(null);
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        if (pc.connectionState === "failed") {
          setError("Connection failed. Please check your network.");
        }
        endCall();
      }
    };

    pc.onicecandidateerror = (event) => {
      console.error("❌ ICE candidate error:", event);
    };

    return pc;
  }, [socket, callId]);

  // ✅ IMPROVED: Get user media with better error handling
  const getUserMedia = useCallback(async (video: boolean, audio: boolean) => {
    try {
      setError(null);
      
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio/video calls");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: "user"
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("Error getting user media:", error);
      
      let errorMessage = "Failed to access camera/microphone";
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            errorMessage = "Camera/microphone permission denied. Please allow access in your browser settings.";
            break;
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            errorMessage = "No camera or microphone found. Please connect a device.";
            break;
          case 'NotReadableError':
          case 'TrackStartError':
            errorMessage = "Camera/microphone is already in use by another application.";
            break;
          case 'OverconstrainedError':
            errorMessage = "Camera settings not supported. Trying with default settings...";
            // Retry with basic constraints
            try {
              const basicStream = await navigator.mediaDevices.getUserMedia({
                video: video ? true : false,
                audio: true,
              });
              localStreamRef.current = basicStream;
              return basicStream;
            } catch {
              errorMessage = "Failed to access camera with any settings.";
            }
            break;
          default:
            errorMessage = `Media error: ${error.message}`;
        }
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // ✅ FIXED: Start call with proper user data
  const startCall = useCallback(
    async (user: ChatUser, video: boolean = true) => {
      try {
        setError(null);
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

        // ✅ FIXED: Send call initiation with actual user data
        if (socket) {
          socket.emit("initiate-call", {
            to: user.id,
            callId: newCallId,
            isVideoCall: video,
            callerName: currentUser.name || currentUser.username,
            callerImage: currentUser.image,
          });
          console.log(`📞 Call initiated to ${user.name || user.username}`);
        }
      } catch (error) {
        console.error("Error starting call:", error);
        setCallStatus("idle");
        setCallId(null);
        setOtherUser(null);
      }
    },
    [socket, getUserMedia, createPeerConnection, currentUser]
  );

  // Answer call (receiver)
  const answerCall = useCallback(
    async (incomingCallId: string, fromUserId: string, video: boolean) => {
      try {
        setError(null);
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
          console.log("✅ Call accepted");
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
        console.log("❌ Call rejected");
      }
      setCallStatus("idle");
      setCallId(null);
      setOtherUser(null);
      setError(null);
    },
    [socket]
  );

  // ✅ IMPROVED: End call with proper cleanup
  const endCall = useCallback(() => {
    console.log("🔴 Ending call...");
    
    if (socket && otherUserIdRef.current && callId) {
      socket.emit("end-call", {
        to: otherUserIdRef.current,
        callId,
      });
    }

    // Stop all tracks
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
      console.log(`⏹️ Stopped ${track.kind} track`);
    });
    
    screenStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
      console.log(`⏹️ Stopped screen share track`);
    });
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      console.log("🔌 Peer connection closed");
    }
    
    // Reset refs
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    screenStreamRef.current = null;
    otherUserIdRef.current = null;
    
    // Reset state
    setCallStatus("idle");
    setCallId(null);
    setOtherUser(null);
    setIsScreenSharing(false);
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);
    setError(null);
    
    onCallEnded?.();
  }, [socket, callId, onCallEnded]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
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
        console.log(`🎤 Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
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
          await sender.replaceTrack(videoTrack);
        }

        videoTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        console.log("🖥️ Screen sharing started");
      } else {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }

        screenStreamRef.current?.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        console.log("🖥️ Screen sharing stopped");
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
      setError("Failed to share screen");
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
          console.log("📤 WebRTC offer sent");
        } catch (error) {
          console.error("Error creating offer:", error);
          setError("Failed to establish connection");
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
          console.log("📤 WebRTC answer sent");
        } catch (error) {
          console.error("Error handling offer:", error);
          setError("Failed to establish connection");
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
          console.log("✅ WebRTC answer received");
        } catch (error) {
          console.error("Error handling answer:", error);
          setError("Failed to establish connection");
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
      setError("Call was rejected");
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

  // ✅ ADDED: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callStatus !== "idle") {
        endCall();
      }
    };
  }, []);

  return {
    callStatus,
    callId,
    isVideoCall,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    otherUser,
    error, // ✅ ADDED: Expose error state
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