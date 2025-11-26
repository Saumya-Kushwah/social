"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Phone,
  AlertCircle,
  Maximize2,
  Minimize2
} from "lucide-react";
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
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);

  // FIX: Robust Local Stream Attachment
  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (!videoElement || !localStream) return;

    // Only assign if different to prevent flickering
    if (videoElement.srcObject !== localStream) {
      console.log("🎬 Attaching local stream");
      videoElement.srcObject = localStream;
      videoElement.muted = true; // Always mute local

      // Handle autoplay promise
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Local video playback failed:", error);
        });
      }
    }
  }, [localStream]);

  // FIX: Robust Remote Stream Attachment
  useEffect(() => {
    const videoElement = remoteVideoRef.current;
    if (!videoElement || !remoteStream) return;

    if (videoElement.srcObject !== remoteStream) {
      console.log("🎬 Attaching remote stream");
      videoElement.srcObject = remoteStream;
      videoElement.muted = false; // Never mute remote

      videoElement.onloadedmetadata = () => {
        setRemoteVideoReady(true);
        videoElement.play().catch(e => console.error("Remote play error:", e));
      };
    }
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden">
        {remoteStream && callStatus === "connected" ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full ${isScreenSharing ? 'object-contain' : 'object-cover'}`}
              style={{ backgroundColor: '#1a1a1a' }}
            />

            {/* Loading Spinner */}
            {!remoteVideoReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-white/70">Receiving video...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Placeholder when no remote video */
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <Avatar className="w-32 h-32 mb-6 ring-4 ring-white/10">
              <AvatarImage src={otherUser.image || ""} alt={otherUser.name || ""} />
              <AvatarFallback className="text-4xl bg-gray-800 text-white">
                {otherUser.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-white text-2xl font-semibold mb-2">
              {otherUser.name || otherUser.username}
            </h3>
            <p className="text-white/60 animate-pulse">
              {callStatus === "calling" && "Calling..."}
              {callStatus === "ringing" && "Ringing..."}
              {callStatus === "connected" && "Waiting for video..."}
            </p>

            {error && (
              <div className="mt-6 flex items-center gap-3 bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 max-w-sm">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Local Video (Floating PIP) */}
        {localStream && callStatus !== "ended" && (
          <div className="absolute top-4 right-4 w-32 md:w-48 aspect-[3/4] bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-white/10 z-20 transition-all hover:scale-105">
            {isVideoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <VideoOff className="w-8 h-8 text-white/30" />
              </div>
            )}

            {/* Local Mute Indicator */}
            {!isAudioEnabled && (
              <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1.5 shadow-lg">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-xs font-medium text-white/90 capitalize">{callStatus}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-950 p-6 pb-8">
        <div className="flex items-center justify-center gap-6 max-w-md mx-auto">
          <Button
            onClick={onToggleAudio}
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110"
          >
            {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>

          <Button
            onClick={onToggleVideo}
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110"
          >
            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>

          <Button
            onClick={onEndCall}
            variant="destructive"
            size="icon"
            className="h-16 w-16 rounded-full shadow-xl bg-red-600 hover:bg-red-700 transition-all hover:scale-110 mx-2"
          >
            <Phone className="h-8 w-8 rotate-[135deg]" />
          </Button>

          <Button
            onClick={onToggleScreenShare}
            variant={isScreenSharing ? "default" : "secondary"}
            size="icon"
            className={`h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110 ${callStatus !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={callStatus !== 'connected'}
          >
            <Monitor className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}