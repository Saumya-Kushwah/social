"use client";

import { useEffect, useRef } from "react";
import { X, Mic, MicOff, Video, VideoOff, Monitor, Phone } from "lucide-react";
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
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onEndCall,
}: VideoCallUIProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Setup local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Setup remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
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
          <p className="text-white text-sm">
            {callStatus === "connected" ? "Connected" : "Connecting..."}
          </p>
        </div>
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
          >
            <Phone className="w-6 h-6 transform rotate-[135deg]" />
          </Button>

          {/* Screen Share */}
          <Button
            onClick={onToggleScreenShare}
            size="lg"
            variant={isScreenSharing ? "default" : "secondary"}
            className="rounded-full w-14 h-14"
          >
            <Monitor className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}