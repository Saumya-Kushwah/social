// hooks/useWebRTC.ts - FIXED VERSION
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import type { CallStatus, ChatUser } from "@/types/chat.types";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

interface UseWebRTCProps {
  currentUserId: string;
  currentUser: ChatUser;
  onCallEnded?: () => void;
}

export function useWebRTC({
  currentUserId,
  currentUser,
  onCallEnded,
}: UseWebRTCProps) {
  const { socket } = useSocket();

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [otherUser, setOtherUser] = useState<ChatUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const otherUserIdRef = useRef<string | null>(null);
  const isEndingCallRef = useRef(false);
  const isInitiatorRef = useRef(false);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    console.log("🔧 Creating peer connection...");
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && otherUserIdRef.current && callId) {
        console.log("🧊 Sending ICE candidate");
        socket.emit("webrtc-ice-candidate", {
          to: otherUserIdRef.current,
          candidate: event.candidate.toJSON(),
          callId,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("📥 Remote track received:", event.track.kind);
      if (event.streams && event.streams[0]) {
        console.log("📺 Setting remote stream");
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔄 Connection state:", pc.connectionState);

      if (pc.connectionState === "connected") {
        console.log("✅ WebRTC connection established!");
        setCallStatus("connected");
        setError(null);
      } else if (pc.connectionState === "failed") {
        console.error("❌ Connection failed");
        setError("Connection failed. Please check your network.");
      } else if (pc.connectionState === "disconnected") {
        console.warn("⚠️ Connection disconnected");
      } else if (pc.connectionState === "closed") {
        console.log("🔴 Connection closed");
        if (!isEndingCallRef.current) {
          endCall();
        }
      }
    };

    pc.onicecandidateerror = (event) => {
      console.error("❌ ICE candidate error:", event);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", pc.iceConnectionState);
    };

    return pc;
  }, [socket, callId]);

  // Get user media
  const getUserMedia = useCallback(async (video: boolean, audio: boolean) => {
    try {
      console.log(`🎥 Requesting user media - Video: ${video}, Audio: ${audio}`);
      setError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio/video calls");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("✅ Got user media stream with tracks:", 
        stream.getTracks().map(t => `${t.kind}: ${t.label}`).join(", ")
      );

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("❌ Error getting user media:", error);

      let errorMessage = "Failed to access camera/microphone";

      if (error instanceof DOMException) {
        switch (error.name) {
          case "NotAllowedError":
          case "PermissionDeniedError":
            errorMessage = "Camera/microphone permission denied. Please allow access in your browser settings.";
            break;
          case "NotFoundError":
          case "DevicesNotFoundError":
            errorMessage = "No camera or microphone found. Please connect a device.";
            break;
          case "NotReadableError":
          case "TrackStartError":
            errorMessage = "Camera/microphone is already in use by another application.";
            break;
          case "OverconstrainedError":
            errorMessage = "Camera settings not supported. Trying with default settings...";
            try {
              const basicStream = await navigator.mediaDevices.getUserMedia({
                video: video ? true : false,
                audio: true,
              });
              localStreamRef.current = basicStream;
              setLocalStream(basicStream);
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

  // Start call (initiator)
  const startCall = useCallback(
    async (user: ChatUser, video: boolean = true) => {
      try {
        console.log(`📞 Starting ${video ? 'video' : 'voice'} call to ${user.name || user.username}`);
        setError(null);
        isEndingCallRef.current = false;
        isInitiatorRef.current = true;

        const newCallId = `call-${Date.now()}`;
        setCallId(newCallId);
        setIsVideoCall(video);
        setOtherUser(user);
        setCallStatus("calling");
        otherUserIdRef.current = user.id;

        // Get local media
        const stream = await getUserMedia(video, true);
        
        // Create peer connection
        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        // Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          console.log(`➕ Adding ${track.kind} track to peer connection`);
          pc.addTrack(track, stream);
        });

        // Send call initiation
        if (socket) {
          socket.emit("initiate-call", {
            to: user.id,
            callId: newCallId,
            isVideoCall: video,
            callerName: currentUser.name || currentUser.username,
            callerImage: currentUser.image,
          });
          console.log("📤 Call initiation sent");
        }
      } catch (error) {
        console.error("❌ Error starting call:", error);
        setCallStatus("idle");
        setCallId(null);
        setOtherUser(null);
      }
    },
    [socket, getUserMedia, createPeerConnection, currentUser]
  );

  // Answer call (receiver)
  const answerCall = useCallback(
    async (incomingCallId: string, fromUser: ChatUser, video: boolean) => {
      try {
        console.log(`✅ Answering ${video ? 'video' : 'voice'} call from ${fromUser.name || fromUser.username}`);
        setError(null);
        isEndingCallRef.current = false;
        isInitiatorRef.current = false;

        setCallId(incomingCallId);
        setIsVideoCall(video);
        setOtherUser(fromUser);
        setCallStatus("ringing");
        otherUserIdRef.current = fromUser.id;

        // Get local media
        const stream = await getUserMedia(video, true);

        // Create peer connection
        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        // Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          console.log(`➕ Adding ${track.kind} track to peer connection`);
          pc.addTrack(track, stream);
        });

        // Send acceptance
        if (socket) {
          socket.emit("accept-call", {
            to: fromUser.id,
            callId: incomingCallId,
          });
          console.log("📤 Call acceptance sent, waiting for offer...");
        }
      } catch (error) {
        console.error("❌ Error answering call:", error);
        rejectCall(incomingCallId, fromUser.id);
      }
    },
    [socket, getUserMedia, createPeerConnection]
  );

  // Reject call
  const rejectCall = useCallback(
    (incomingCallId: string, fromUserId: string) => {
      console.log("❌ Rejecting call");
      if (socket) {
        socket.emit("reject-call", {
          to: fromUserId,
          callId: incomingCallId,
        });
      }
      setCallStatus("idle");
      setCallId(null);
      setOtherUser(null);
      setError(null);
    },
    [socket]
  );

  // End call
  const endCall = useCallback(() => {
    if (isEndingCallRef.current) {
      console.log("⚠️ Already ending call, skipping...");
      return;
    }

    isEndingCallRef.current = true;
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
    screenStreamRef.current = null;
    otherUserIdRef.current = null;
    isInitiatorRef.current = false;

    // Clear state
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setCallId(null);
    setOtherUser(null);
    setIsScreenSharing(false);
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);
    setError(null);

    setTimeout(() => {
      isEndingCallRef.current = false;
    }, 500);

    onCallEnded?.();
  }, [socket, callId, onCallEnded]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log(`📹 Video ${videoTrack.enabled ? "enabled" : "disabled"}`);
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
        console.log(`🎤 Audio ${audioTrack.enabled ? "enabled" : "disabled"}`);
      }
    }
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        console.log("🖥️ Starting screen share...");
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
          console.log("✅ Screen share track replaced");
        }

        videoTrack.onended = () => {
          console.log("🖥️ Screen share ended by user");
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        console.log("🖥️ Stopping screen share...");
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          console.log("✅ Camera track restored");
        }

        screenStreamRef.current?.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error("❌ Error toggling screen share:", error);
      setError("Failed to share screen");
    }
  }, [isScreenSharing]);

  // Handle Socket.IO events
  useEffect(() => {
    if (!socket) return;

    // Call accepted - CREATE OFFER (initiator only)
    socket.on("call-accepted", async ({ callId: acceptedCallId, from }) => {
      console.log("✅ Call accepted by", from);
      
      if (callId === acceptedCallId && peerConnectionRef.current && isInitiatorRef.current) {
        try {
          console.log("📤 Creating and sending offer...");
          const offer = await peerConnectionRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideoCall,
          });
          
          await peerConnectionRef.current.setLocalDescription(offer);
          console.log("✅ Local description set (offer)");

          socket.emit("webrtc-offer", {
            to: from,
            offer,
            callId: acceptedCallId,
          });
          console.log("📤 WebRTC offer sent");
          setCallStatus("connected");
        } catch (error) {
          console.error("❌ Error creating offer:", error);
          setError("Failed to establish connection");
        }
      }
    });

    // Received offer - CREATE ANSWER (receiver only)
    socket.on("webrtc-offer", async ({ offer, from, callId: offerCallId }) => {
      console.log("📥 Received WebRTC offer from", from);
      
      if (peerConnectionRef.current && callId === offerCallId && !isInitiatorRef.current) {
        try {
          console.log("📥 Setting remote description (offer)");
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(offer)
          );
          console.log("✅ Remote description set (offer)");

          console.log("📤 Creating and sending answer...");
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          console.log("✅ Local description set (answer)");

          socket.emit("webrtc-answer", {
            to: from,
            answer,
            callId: offerCallId,
          });
          console.log("📤 WebRTC answer sent");
          setCallStatus("connected");
        } catch (error) {
          console.error("❌ Error handling offer:", error);
          setError("Failed to establish connection");
        }
      }
    });

    // Received answer - SET REMOTE DESCRIPTION (initiator only)
    socket.on("webrtc-answer", async ({ answer, callId: answerCallId }) => {
      console.log("📥 Received WebRTC answer");
      
      if (peerConnectionRef.current && callId === answerCallId && isInitiatorRef.current) {
        try {
          console.log("📥 Setting remote description (answer)");
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          console.log("✅ Remote description set (answer) - Connection should establish!");
        } catch (error) {
          console.error("❌ Error handling answer:", error);
          setError("Failed to establish connection");
        }
      }
    });

    // ICE candidate
    socket.on("webrtc-ice-candidate", async ({ candidate, callId: candidateCallId }) => {
      if (peerConnectionRef.current && callId === candidateCallId) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
          console.log("🧊 ICE candidate added");
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      }
    });

    // Call rejected
    socket.on("call-rejected", () => {
      console.log("❌ Call was rejected");
      setError("Call was rejected");
      endCall();
    });

    // Call ended
    socket.on("call-ended", () => {
      console.log("📴 Call ended by other user");
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
  }, [socket, callId, isVideoCall, endCall]);

  return {
    callStatus,
    callId,
    isVideoCall,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    otherUser,
    error,
    localStream,
    remoteStream,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
  };
}