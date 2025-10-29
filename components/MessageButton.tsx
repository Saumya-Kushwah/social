"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getTotalUnreadCount } from "@/actions/chat.action";
import { useSocket } from "./SocketProvider";

interface MessageButtonProps {
  onClick: () => void;
}

export default function MessageButton({ onClick }: MessageButtonProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocket();

  useEffect(() => {
    // Fetch initial unread count
    getTotalUnreadCount().then(setUnreadCount);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = () => {
      getTotalUnreadCount().then(setUnreadCount);
    };

    const handleMessageRead = () => {
      getTotalUnreadCount().then(setUnreadCount);
    };

    socket.on("new-message", handleNewMessage);
    socket.on("message-read", handleMessageRead);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("message-read", handleMessageRead);
    };
  }, [socket]);

  return (
    <Button
      variant="ghost"
      className="flex items-center gap-2 relative"
      onClick={onClick}
    >
      <MessageCircle className="w-4 h-4" />
      <span className="hidden lg:inline">Messages</span>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  );
}