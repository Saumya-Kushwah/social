// hooks/useWebRTC.ts - FINAL FIXED VERSION
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import type { CallStatus, ChatUser } from "@/types/chat.types";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // TODO: Add TURN servers here for production
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

  // FIX 1: Refs to handle ICE candidate race conditions (Queueing)
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const isRemoteDescriptionSetRef = useRef(false);

  // Helper: Process queued ICE candidates
  const processIceQueue = useCallback(async () => {
    if (!peerConnectionRef.current || iceCandidateQueueRef.current.length === 0) return;

    console.log(`🧊 Processing ${iceCandidateQueueRef.current.length} queued ICE candidates...`);

    for (const candidate of iceCandidateQueueRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("❌ Error adding queued ICE candidate:", error);
      }
    }
    iceCandidateQueueRef.current = [];
  }, []);

  // Create peer connection
  // FIX 2: Accept activeCallId as argument to avoid closure staleness
  const createPeerConnection = useCallback((activeCallId: string) => {
    console.log("🔧 Creating peer connection for Call ID:", activeCallId);

    isRemoteDescriptionSetRef.current = false;
    iceCandidateQueueRef.current = [];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      // FIX: Ensure we use the passed activeCallId, not the state
      if (event.candidate && socket && otherUserIdRef.current) {
        socket.emit("webrtc-ice-candidate", {
          to: otherUserIdRef.current,
          candidate: event.candidate.toJSON(),
          callId: activeCallId, // Uses the explicit ID passed in
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
        setError("Connection failed. Check network/firewall.");
      } else if (pc.connectionState === "closed") {
        if (!isEndingCallRef.current) endCall();
      }
    };

    return pc;
  }, [socket]); // Removed callId from dependency

  // Get user media
  const getUserMedia = useCallback(async (video: boolean, audio: boolean) => {
    try {
      // Return existing stream if we have one to prevent camera flickering
      if (localStreamRef.current) return localStreamRef.current;

      console.log(`🎥 Requesting user media - Video: ${video}, Audio: ${audio}`);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("❌ Media Error:", error);
      setError("Could not access camera/microphone.");
      throw error;
    }
  }, []);

  // Start call (initiator)
  const startCall = useCallback(
    async (user: ChatUser, video: boolean = true) => {
      try {
        console.log(`📞 Starting call to ${user.username}`);
        setError(null);
        isEndingCallRef.current = false;
        isInitiatorRef.current = true;

        const newCallId = `call-${Date.now()}`;
        setCallId(newCallId); // State update is slow...
        setIsVideoCall(video);
        setOtherUser(user);
        setCallStatus("calling");
        otherUserIdRef.current = user.id;

        const stream = await getUserMedia(video, true);

        // FIX: Pass newCallId directly so we don't wait for state update
        const pc = createPeerConnection(newCallId);
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        if (socket) {
          socket.emit("initiate-call", {
            to: user.id,
            callId: newCallId,
            isVideoCall: video,
            callerName: currentUser.name || currentUser.username,
            callerImage: currentUser.image,
          });
        }
      } catch (error) {
        console.error("❌ Start call error:", error);
        setCallStatus("idle");
      }
    },
    [socket, getUserMedia, createPeerConnection, currentUser]
  );

  // Answer call (receiver)
  const answerCall = useCallback(
    async (incomingCallId: string, fromUser: ChatUser, video: boolean) => {
      try {
        console.log(`✅ Answering call from ${fromUser.username}`);
        setError(null);
        isEndingCallRef.current = false;
        isInitiatorRef.current = false;

        setCallId(incomingCallId);
        setIsVideoCall(video);
        setOtherUser(fromUser);
        setCallStatus("ringing");
        otherUserIdRef.current = fromUser.id;

        const stream = await getUserMedia(video, true);

        // FIX: Pass incomingCallId directly
        const pc = createPeerConnection(incomingCallId);
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        if (socket) {
          socket.emit("accept-call", { to: fromUser.id, callId: incomingCallId });
        }
      } catch (error) {
        console.error("❌ Answer call error:", error);
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
    if (isEndingCallRef.current) return;
    isEndingCallRef.current = true;
    console.log("🔴 Ending call...");

    if (socket && otherUserIdRef.current && callId) {
      socket.emit("end-call", { to: otherUserIdRef.current, callId });
    }

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerConnectionRef.current?.close();

    peerConnectionRef.current = null;
    localStreamRef.current = null;
    screenStreamRef.current = null;
    otherUserIdRef.current = null;
    isInitiatorRef.current = false;
    isRemoteDescriptionSetRef.current = false;
    iceCandidateQueueRef.current = [];

    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setCallId(null);
    setOtherUser(null);
    setIsScreenSharing(false);
    setError(null);

    setTimeout(() => { isEndingCallRef.current = false; }, 500);
    onCallEnded?.();
  }, [socket, callId, onCallEnded]);

  // Media Toggles
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(videoTrack);

        videoTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } else {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === "video");
        if (sender && videoTrack) await sender.replaceTrack(videoTrack);

        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      }
    } catch (e) {
      console.error("Screen share error", e);
    }
  }, [isScreenSharing]);

  // Socket Events
  useEffect(() => {
    if (!socket) return;

    // 1. Call Accepted -> Send Offer
    const handleCallAccepted = async ({ callId: acceptedId, from }: any) => {
      if (callId === acceptedId && peerConnectionRef.current && isInitiatorRef.current) {
        try {
          const offer = await peerConnectionRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideoCall,
          });
          await peerConnectionRef.current.setLocalDescription(offer);
          socket.emit("webrtc-offer", { to: from, offer, callId: acceptedId });
        } catch (e) { console.error("Error creating offer", e); }
      }
    };

    // 2. Offer Received -> Send Answer
    const handleOffer = async ({ offer, from, callId: offerId }: any) => {
      if (peerConnectionRef.current && callId === offerId) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
          isRemoteDescriptionSetRef.current = true;
          await processIceQueue(); // Process any candidates that arrived early

          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socket.emit("webrtc-answer", { to: from, answer, callId: offerId });
        } catch (e) { console.error("Error handling offer", e); }
      }
    };

    // 3. Answer Received -> Set Remote Description
    const handleAnswer = async ({ answer, callId: answerId }: any) => {
      if (peerConnectionRef.current && callId === answerId) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          isRemoteDescriptionSetRef.current = true;
          await processIceQueue(); // Process any candidates that arrived early
        } catch (e) { console.error("Error handling answer", e); }
      }
    };

    // 4. ICE Candidate Received -> Add or Queue
    const handleIceCandidate = async ({ candidate, callId: candidateId }: any) => {
      if (peerConnectionRef.current && callId === candidateId) {
        if (isRemoteDescriptionSetRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) { console.error("Error adding candidate", e); }
        } else {
          iceCandidateQueueRef.current.push(candidate);
        }
      }
    };

    socket.on("call-accepted", handleCallAccepted);
    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIceCandidate);
    socket.on("call-rejected", () => {
      setError("Call rejected");
      endCall();
    });
    socket.on("call-ended", () => endCall());

    return () => {
      socket.off("call-accepted", handleCallAccepted);
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIceCandidate);
      socket.off("call-rejected");
      socket.off("call-ended");
    };
  }, [socket, callId, isVideoCall, processIceQueue, endCall]);

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