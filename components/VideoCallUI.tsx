"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatUser } from "@/types/chat.types";

interface VideoCallUIProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  callStatus: "calling" | "ringing" | "connected" | "ended" | "idle";
  otherUser: ChatUser;
  error?: string | null;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
}

export default function VideoCallUI({
  localStream,
  remoteStream,
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  callStatus,
  otherUser,
  error,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onEndCall,
}: VideoCallUIProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Track state for the UI (Avatar vs Video)
  const [isVideoTrackActive, setIsVideoTrackActive] = useState(false);
  const [isRemoteLoaded, setIsRemoteLoaded] = useState(false);

  // -------------------------------------------------------------------
  // 1. REMOTE VIDEO HANDLING (Complex Logic)
  // -------------------------------------------------------------------
  useEffect(() => {
    const videoElement = remoteVideoRef.current;
    if (!videoElement || !remoteStream) {
      setIsVideoTrackActive(false);
      setIsRemoteLoaded(false);
      return;
    }

    console.log("📺 UI: Attaching remote stream");
    videoElement.srcObject = remoteStream;

    // A. Check initial track state
    const videoTrack = remoteStream.getVideoTracks()[0];
    const initialTrackState = videoTrack && videoTrack.enabled && videoTrack.readyState === 'live';
    setIsVideoTrackActive(!!initialTrackState);

    // B. Handle Track Events (Mute/Unmute from remote side)
    const handleTrackMute = () => {
      console.log("😶 Remote video track muted (camera off)");
      setIsVideoTrackActive(false);
    };

    const handleTrackUnmute = () => {
      console.log("📸 Remote video track unmuted (camera on)");
      setIsVideoTrackActive(true);
    };

    // C. Handle Video Element Events
    const handleLoadedData = () => setIsRemoteLoaded(true);
    
    if (videoTrack) {
      videoTrack.addEventListener("mute", handleTrackMute);
      videoTrack.addEventListener("unmute", handleTrackUnmute);
      // Determine if the track was added later (negotiation)
      videoTrack.onended = () => setIsVideoTrackActive(false);
    }

    videoElement.addEventListener("loadeddata", handleLoadedData);

    // Attempt autoplay
    videoElement.play().catch((err) => console.warn("Remote autoplay blocked:", err));

    return () => {
      if (videoTrack) {
        videoTrack.removeEventListener("mute", handleTrackMute);
        videoTrack.removeEventListener("unmute", handleTrackUnmute);
      }
      videoElement.removeEventListener("loadeddata", handleLoadedData);
      videoElement.srcObject = null;
    };
  }, [remoteStream]);

  // -------------------------------------------------------------------
  // 2. LOCAL VIDEO HANDLING
  // -------------------------------------------------------------------
  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (!videoElement || !localStream) return;

    videoElement.srcObject = localStream;
    // CRITICAL: Ensure local video is always muted to prevent feedback loop
    videoElement.muted = true; 

    videoElement.play().catch((err) => console.error("Local autoplay error:", err));

    // No cleanup of srcObject needed here usually, but good practice if stream changes
  }, [localStream]);


  // Helper to determine if we show the remote video or the avatar
  const showRemoteVideo = callStatus === 'connected' && isVideoTrackActive && isRemoteLoaded;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col font-sans">
      
      {/* ---------------- MAIN REMOTE AREA ---------------- */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center">
        
        {/* Remote Video Element */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full transition-opacity duration-500 ${
            isScreenSharing ? "object-contain" : "object-cover"
          } ${showRemoteVideo ? "opacity-100" : "opacity-0"}`}
        />

        {/* Fallback: Avatar / Status / Loading */}
        {!showRemoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-900/95 backdrop-blur-sm">
            <Avatar className="w-32 h-32 mb-6 ring-4 ring-white/10 shadow-2xl animate-in fade-in zoom-in duration-300">
              <AvatarImage src={otherUser.image || ""} />
              <AvatarFallback className="text-4xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {otherUser.name?.[0] || otherUser.username?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            
            <h3 className="text-white text-2xl font-bold mb-2">
              {otherUser.name || otherUser.username}
            </h3>
            
            <p className="text-white/60 animate-pulse text-lg">
              {callStatus === "connected"
                ? "Camera off"
                : `${callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}...`}
            </p>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-20 bg-black/40 border border-white/10 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              callStatus === "connected" ? "bg-green-500 animate-pulse" : "bg-yellow-500"
            }`}
          />
          <span className="font-medium tracking-wide">
             {callStatus === "connected" 
               ? (isVideoTrackActive ? "Live" : "Audio Only") 
               : "Connecting..."}
          </span>
        </div>

        {/* Error Toast */}
        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm animate-in slide-in-from-top-4">
             ⚠️ {error}
          </div>
        )}
      </div>

      {/* ---------------- PIP LOCAL VIDEO ---------------- */}
      {/* Only show if we have a stream and it's enabled */}
      {localStream && (
        <div className="absolute top-4 right-4 w-32 md:w-48 aspect-[3/4] bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-30 transition-all duration-300 hover:scale-105">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted // React prop backup
              className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
                isVideoEnabled ? "opacity-100" : "opacity-0"
              }`}
            />
            
            {/* Local Camera Off Overlay */}
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
                <VideoOff className="text-white/50 w-8 h-8 mb-2" />
                <span className="text-white/50 text-xs font-medium">Camera Off</span>
              </div>
            )}

            {/* Local Mute Indicator */}
            {!isAudioEnabled && (
               <div className="absolute bottom-3 left-3 bg-red-500/90 p-1.5 rounded-full backdrop-blur-sm">
                  <MicOff className="w-3 h-3 text-white" />
               </div>
            )}
        </div>
      )}

      {/* ---------------- CONTROLS BAR ---------------- */}
      <div className="relative z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-8 pb-10">
        <div className="flex items-center justify-center gap-4 md:gap-8">
          
          {/* Audio Toggle */}
          <Button
            onClick={onToggleAudio}
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110"
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </Button>

          {/* Video Toggle */}
          <Button
            onClick={onToggleVideo}
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110"
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>

          {/* End Call - Distinct styling */}
          <Button
            onClick={onEndCall}
            size="icon"
            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/20 transition-all hover:scale-110 hover:rotate-90"
          >
            <Phone className="w-8 h-8 fill-current" />
          </Button>

          {/* Screen Share */}
          <Button
            onClick={onToggleScreenShare}
            variant={isScreenSharing ? "default" : "secondary"}
            size="icon"
            disabled={callStatus !== "connected"}
            className={`h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110 ${
                isScreenSharing ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
            }`}
          >
            <Monitor className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}