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
  currentUser: ChatUser;
  onCallEnded?: () => void;
}

export function useWebRTC({
  currentUser,
  onCallEnded,
}: UseWebRTCProps) {
  const { socket } = useSocket();

  // UI State
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

  // WebRTC Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Call State Refs
  const callIdRef = useRef<string | null>(null);
  const isVideoCallRef = useRef(false);
  const otherUserIdRef = useRef<string | null>(null);
  const isEndingCallRef = useRef(false);
  const isInitiatorRef = useRef(false);

  // ICE Candidate Management
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const isRemoteDescriptionSetRef = useRef(false);
  
  // -------------------------------------------------------------------
  // 1. HELPER: Media Cleanup
  // -------------------------------------------------------------------
  const cleanupStreams = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  // -------------------------------------------------------------------
  // 2. HELPER: End Call (Stable Ref Pattern)
  // -------------------------------------------------------------------
  const endCallRef = useRef<() => void>();

  useEffect(() => {
    endCallRef.current = () => {
      if (isEndingCallRef.current) return;
      isEndingCallRef.current = true;
      console.log("🔴 Ending call...");

      // Notify other peer
      if (socket && otherUserIdRef.current && callIdRef.current) {
        socket.emit("end-call", {
          to: otherUserIdRef.current,
          callId: callIdRef.current,
        });
      }

      // Close Peer Connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Cleanup Media
      cleanupStreams();

      // Reset Refs
      otherUserIdRef.current = null;
      callIdRef.current = null;
      isInitiatorRef.current = false;
      isVideoCallRef.current = false;
      isRemoteDescriptionSetRef.current = false;
      iceCandidateQueueRef.current = [];

      // Reset UI
      setCallStatus("idle");
      setCallId(null);
      setOtherUser(null);
      setIsScreenSharing(false);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      setError(null);

      onCallEnded?.();

      // Reset lock after state updates settle
      setTimeout(() => {
        isEndingCallRef.current = false;
      }, 500);
    };
  }, [socket, onCallEnded, cleanupStreams]);

  const endCall = useCallback(() => {
    endCallRef.current?.();
  }, []);

  // -------------------------------------------------------------------
  // 3. HELPER: ICE Processing
  // -------------------------------------------------------------------
  const processIceQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const queue = iceCandidateQueueRef.current;
    if (!pc || queue.length === 0) return;

    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("⚠️ Error processing queued ICE candidate", error);
      }
    }
    iceCandidateQueueRef.current = [];
  }, []);

  // -------------------------------------------------------------------
  // 4. CORE: Peer Connection Creation
  // -------------------------------------------------------------------
  const createPeerConnection = useCallback((activeCallId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && otherUserIdRef.current) {
        socket.emit("webrtc-ice-candidate", {
          to: otherUserIdRef.current,
          candidate: event.candidate.toJSON(),
          callId: activeCallId,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          setCallStatus("connected");
          break;
        case "failed":
        case "disconnected":
        case "closed":
          if (pc.connectionState === "failed") setError("Connection failed");
          // Only end call if strictly failed/closed
          if (["failed", "closed"].includes(pc.connectionState) && !isEndingCallRef.current) {
             endCallRef.current?.();
          }
          break;
      }
    };

    return pc;
  }, [socket]);

  // -------------------------------------------------------------------
  // 5. CORE: Media Management
  // -------------------------------------------------------------------
  const getUserMedia = useCallback(async (video: boolean, audio: boolean) => {
    try {
      if (localStreamRef.current) {
        // Stop existing tracks to prevent hardware conflict
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error: any) {
      console.error("❌ Media Error:", error);
      setError("Could not access camera/microphone");
      throw error;
    }
  }, []);

  // -------------------------------------------------------------------
  // 6. TOGGLES (Fixed for Audio-Only / Missing Track Cases)
  // -------------------------------------------------------------------
  
  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      // CASE 1: Track exists, just toggle it (Mute/Unmute)
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      } else {
        // CASE 2: No video track (Audio-only call). 
        // WARNING: To add video mid-call requires renegotiation. 
        // For this implementation, we will warn the user.
        console.warn("Cannot toggle video: No video track initialized.");
        setError("Video unavailable in audio-only call");
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // STOP SHARING
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
        
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      } else {
        // START SHARING
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Handle user stopping via browser UI
        screenTrack.onended = () => {
          if (screenStreamRef.current) toggleScreenShare();
        };

        const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === "video");
        
        if (sender) {
          await sender.replaceTrack(screenTrack);
          setIsScreenSharing(true);
        } else {
           // Fallback for audio-only calls: This requires adding a track (renegotiation)
           // or simple error handling.
           setError("Cannot share screen in audio-only mode");
           screenTrack.stop();
           screenStreamRef.current = null;
        }
      }
    } catch (error) {
      console.error("Screen share error:", error);
      setIsScreenSharing(false);
    }
  }, [isScreenSharing, toggleScreenShare]);

  // -------------------------------------------------------------------
  // 7. SIGNALING: Call Control
  // -------------------------------------------------------------------
  const startCall = useCallback(async (user: ChatUser, video: boolean = true) => {
    try {
      isInitiatorRef.current = true;
      const newCallId = `call-${Date.now()}`;
      callIdRef.current = newCallId;
      otherUserIdRef.current = user.id;
      isVideoCallRef.current = video;

      setCallStatus("calling");
      setCallId(newCallId);
      setOtherUser(user);
      setIsVideoCall(video);

      const stream = await getUserMedia(video, true);
      const pc = createPeerConnection(newCallId);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (socket) {
        socket.emit("initiate-call", {
          to: user.id,
          callId: newCallId,
          isVideoCall: video,
          callerName: currentUser.name || currentUser.username,
        });
      }
    } catch (err) {
      endCall();
    }
  }, [socket, currentUser, getUserMedia, createPeerConnection, endCall]);

  const answerCall = useCallback(async (incomingCallId: string, fromUser: ChatUser, video: boolean) => {
    try {
      isInitiatorRef.current = false;
      callIdRef.current = incomingCallId;
      otherUserIdRef.current = fromUser.id;
      isVideoCallRef.current = video;

      setCallStatus("ringing");
      setCallId(incomingCallId);
      setOtherUser(fromUser);
      setIsVideoCall(video);

      const stream = await getUserMedia(video, true);
      const pc = createPeerConnection(incomingCallId);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (socket) {
        socket.emit("accept-call", { to: fromUser.id, callId: incomingCallId });
      }
    } catch (err) {
      endCall();
    }
  }, [socket, getUserMedia, createPeerConnection, endCall]);

  // -------------------------------------------------------------------
  // 8. SOCKET LISTENERS
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const handleCallAccepted = async ({ callId: acceptedId, from }: any) => {
      if (callIdRef.current !== acceptedId || !peerConnectionRef.current) return;
      
      try {
        const offer = await peerConnectionRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideoCallRef.current
        });
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit("webrtc-offer", { to: from, offer, callId: acceptedId });
      } catch (e) { setError("Failed to negotiate call"); }
    };

    const handleOffer = async ({ offer, from, callId: offerId }: any) => {
      if (callIdRef.current !== offerId || !peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        isRemoteDescriptionSetRef.current = true;
        await processIceQueue();

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit("webrtc-answer", { to: from, answer, callId: offerId });
      } catch (e) { setError("Failed to negotiate call"); }
    };

    const handleAnswer = async ({ answer, callId: answerId }: any) => {
      if (callIdRef.current !== answerId || !peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        isRemoteDescriptionSetRef.current = true;
        await processIceQueue();
      } catch (e) { console.error(e); }
    };

    const handleIceCandidate = async ({ candidate, callId: candidateId }: any) => {
      if (callIdRef.current !== candidateId || !peerConnectionRef.current) return;
      
      if (isRemoteDescriptionSetRef.current) {
        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      } else {
        iceCandidateQueueRef.current.push(candidate);
      }
    };

    const handleCallEndedEvent = () => endCallRef.current?.();

    socket.on("call-accepted", handleCallAccepted);
    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEndedEvent);
    socket.on("call-rejected", handleCallEndedEvent);

    return () => {
      socket.off("call-accepted", handleCallAccepted);
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIceCandidate);
      socket.off("call-ended", handleCallEndedEvent);
      socket.off("call-rejected", handleCallEndedEvent);
    };
  }, [socket, processIceQueue]);

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
    rejectCall: endCall, // Reusing endCall for simplicity
    endCall,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
  };
}