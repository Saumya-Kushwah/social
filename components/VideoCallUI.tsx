"use client";

import { useEffect, useRef } from "react";
import { X, Mic, MicOff, Video, VideoOff, Monitor, Phone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatUser } from "@/types/chat.types";

interface VideoCallUIProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  callStatus: "calling" | "ringing" | "connected" | "ended";
  otherUser: ChatUser;
  error?: string | null; // ✅ ADDED: Error message
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

  // ✅ IMPROVED: Setup local video with cleanup
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }

    // Cleanup function
    return () => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    };
  }, [localStream]);

  // ✅ IMPROVED: Setup remote video with cleanup
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }

    // Cleanup function
    return () => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative">
        {remoteStream && callStatus === "connected" ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Avatar className="w-32 h-32 mb-4">
              <AvatarImage src={otherUser.image || ""} alt={otherUser.name || ""} />
              <AvatarFallback className="text-4xl">
                {otherUser.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <p className="text-white text-2xl font-semibold mb-2">
              {otherUser.name || otherUser.username}
            </p>
            <p className="text-white/70">
              {callStatus === "calling" && "Calling..."}
              {callStatus === "ringing" && "Ringing..."}
              {callStatus === "connected" && "Connected"}
            </p>
            
            {/* ✅ ADDED: Error display */}
            {error && (
              <div className="mt-4 flex items-center gap-2 bg-red-500/20 border border-red-500 rounded-lg px-4 py-2 max-w-md">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localStream && (
          <div className="absolute top-4 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20">
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
                <VideoOff className="w-8 h-8 text-white/50" />
              </div>
            )}
          </div>
        )}

        {/* Call Info */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
          <p className="text-white text-sm flex items-center gap-2">
            {callStatus === "connected" ? (
              <>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Connected
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                Connecting...
              </>
            )}
          </p>
        </div>

        {/* Connection Status */}
        {callStatus === "connected" && remoteStream && (
          <div className="absolute top-16 left-4 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-lg">
            <p className="text-white/80 text-xs">
              {isScreenSharing ? "Screen sharing" : "Video call"}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-gradient-to-t from-black/90 to-transparent">
        <div className="flex items-center justify-center gap-4">
          {/* Toggle Audio */}
          <Button
            onClick={onToggleAudio}
            size="lg"
            variant={isAudioEnabled ? "secondary" : "destructive"}
            className="rounded-full w-14 h-14"
            title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {isAudioEnabled ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </Button>

          {/* Toggle Video */}
          <Button
            onClick={onToggleVideo}
            size="lg"
            variant={isVideoEnabled ? "secondary" : "destructive"}
            className="rounded-full w-14 h-14"
            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoEnabled ? (
              <Video className="w-6 h-6" />
            ) : (
              <VideoOff className="w-6 h-6" />
            )}
          </Button>

          {/* End Call */}
          <Button
            onClick={onEndCall}
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
            title="End call"
          >
            <Phone className="w-6 h-6 transform rotate-[135deg]" />
          </Button>

          {/* Screen Share */}
          <Button
            onClick={onToggleScreenShare}
            size="lg"
            variant={isScreenSharing ? "default" : "secondary"}
            className="rounded-full w-14 h-14"
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
            disabled={callStatus !== "connected"}
          >
            <Monitor className="w-6 h-6" />
          </Button>
        </div>

        {/* Hints */}
        <div className="mt-4 text-center">
          <p className="text-white/50 text-xs">
            {callStatus === "connected" 
              ? "Call is active" 
              : "Establishing connection..."}
          </p>
        </div>
      </div>
    </div>
  );
}