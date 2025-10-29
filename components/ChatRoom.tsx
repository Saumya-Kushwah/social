"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { getMessages } from "@/actions/chat.action";
import { useSocket } from "./SocketProvider";
import type { ChatUser, MessageWithSender } from "@/types/chat.types";
import { ChatHeader } from "./ChatHeader";

interface ChatRoomProps {
  conversationId: string;
  otherUser: ChatUser;
  currentUserId: string;
  currentUser: ChatUser;
}

export default function ChatRoom({
  conversationId,
  otherUser,
  currentUserId,
  currentUser,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const { socket } = useSocket();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("join-conversation", conversationId);

    const handleNewMessage = (message: MessageWithSender) => {
      if (message.senderId !== currentUserId) {
        setMessages((prev) => [...prev, message]);
        socket.emit("mark-read", conversationId);
      }
    };

    const handleUserTyping = (data: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId === conversationId && data.userId === otherUser.id) {
        setIsTyping(data.isTyping);

        if (data.isTyping) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      }
    };

    socket.on("new-message", handleNewMessage);
    socket.on("user-typing", handleUserTyping);
    socket.emit("mark-read", conversationId);

    return () => {
      socket.emit("leave-conversation", conversationId);
      socket.off("new-message", handleNewMessage);
      socket.off("user-typing", handleUserTyping);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, conversationId, currentUserId, otherUser.id]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const msgs = await getMessages(conversationId);
      setMessages(msgs);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!socket) return;

    socket.emit("send-message", { conversationId, content });

    const tempMessage: MessageWithSender = {
      id: `temp-${Date.now()}`,
      content,
      createdAt: new Date(),
      read: false,
      senderId: currentUserId,
      sender: {
        id: currentUser.id,
        username: currentUser.username || "",
        name: currentUser.name || null,
        image: currentUser.image || null,
      },
    };
    setMessages((prev) => [...prev, tempMessage]);
  };

  const handleTyping = (isTyping: boolean) => {
    if (!socket) return;
    socket.emit("typing", { conversationId, isTyping });
  };

  const handleBack = () => {
    router.push("/messages");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header - Fixed at top */}
      <ChatHeader otherUser={otherUser} onBack={handleBack} />

      {/* Messages Area - Scrollable middle section */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            isTyping={isTyping}
            otherUser={otherUser}
          />
        </div>
      )}

      {/* Message Input - Fixed at bottom */}
      <div className="flex-shrink-0 border-t">
        <MessageInput onSendMessage={handleSendMessage} onTyping={handleTyping} />
      </div>
    </div>
  );
}