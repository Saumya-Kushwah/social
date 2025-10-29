"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/types/chat.types";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  currentUserId: string;
}

export default function ConversationList({ 
  conversations, 
  currentUserId 
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>No conversations yet</p>
        <p className="text-sm mt-2">Start a conversation by following someone</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((conversation) => {
        const otherUser = conversation.participants.find(
          (p) => p.id !== currentUserId
        );

        if (!otherUser) return null;

        const lastMessage = conversation.lastMessage;
        const isUnread = lastMessage && !lastMessage.read && lastMessage.senderId !== currentUserId;

        return (
          <Link
            key={conversation.id}
            href={`/messages/${conversation.id}`}
            className={cn(
              "flex items-center gap-3 p-4 hover:bg-accent transition-colors",
              isUnread && "bg-accent/50"
            )}
          >
            <Avatar className="w-12 h-12">
              <AvatarImage src={otherUser.image || ""} alt={otherUser.username} />
              <AvatarFallback>
                {otherUser.name?.[0] || otherUser.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={cn(
                  "font-medium truncate",
                  isUnread && "font-semibold"
                )}>
                  {otherUser.name || otherUser.username}
                </p>
                {lastMessage && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatDistanceToNow(new Date(lastMessage.createdAt), { 
                      addSuffix: false 
                    })}
                  </span>
                )}
              </div>
              
              {lastMessage && (
                <p className={cn(
                  "text-sm text-muted-foreground truncate",
                  isUnread && "text-foreground font-medium"
                )}>
                  {lastMessage.senderId === currentUserId && "You: "}
                  {lastMessage.content}
                </p>
              )}
            </div>

            {isUnread && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </Link>
        );
      })}
    </div>
  );
}