"use client";

import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import type { MessageWithSender, ChatUser } from "@/types/chat.types";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: MessageWithSender[];
  currentUserId: string;
  isTyping: boolean;
  otherUser: ChatUser;
}

export default function MessageList({ messages, currentUserId, isTyping, otherUser }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const showAvatar = !isOwn && (index === 0 || messages[index - 1].senderId !== message.senderId);

        return (
          <div
            key={message.id}
            className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}
          >
            {!isOwn && (
              <div className="flex-shrink-0">
                {showAvatar ? (
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={otherUser.image || ""} alt={otherUser.username} />
                    <AvatarFallback>
                      {otherUser.name?.[0] || otherUser.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-8" />
                )}
              </div>
            )}

            <div className={cn("flex flex-col max-w-[70%]", isOwn && "items-end")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2 break-words",
                  isOwn
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              <span className="text-xs text-muted-foreground mt-1 px-2">
                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        );
      })}

      {isTyping && (
        <div className="flex gap-2 items-end">
          <Avatar className="w-8 h-8">
            <AvatarImage src={otherUser.image || ""} alt={otherUser.username} />
            <AvatarFallback>
              {otherUser.name?.[0] || otherUser.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="bg-accent rounded-2xl px-4 py-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}