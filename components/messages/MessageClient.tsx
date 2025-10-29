"use client";

import { useState, useEffect } from "react";
import { Search, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConversationItem from "@/components/ConversationItem";
import NewChatDialog from "@/components/messages/NewChatDialog";
import type { ConversationWithDetails, ChatUser } from "@/types/chat.types";
import { useSocket } from "@/components/SocketProvider";
import { getConversations } from "@/actions/chat.action";

interface MessagesClientProps {
  conversations: ConversationWithDetails[];
  mutualFollowers: ChatUser[];
  currentUser: ChatUser;
}

export default function MessagesClient({
  conversations: initialConversations,
  mutualFollowers,
  currentUser,
}: MessagesClientProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const { socket } = useSocket();

  // Refresh conversations when new message arrives
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = async () => {
      const updated = await getConversations();
      setConversations(updated);
    };

    socket.on("new-message", handleNewMessage);

    return () => {
      socket.off("new-message", handleNewMessage);
    };
  }, [socket]);

  const filteredConversations = conversations.filter((conv) => {
    const name = conv.otherUser.name || conv.otherUser.username;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-card rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Messages</h1>
            <Button onClick={() => setIsNewChatOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-accent rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="divide-y">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No conversations yet</p>
              <p className="text-sm text-center max-w-sm">
                {searchQuery
                  ? "No conversations match your search"
                  : "Start a conversation with mutual followers"}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setIsNewChatOpen(true)}
                  className="mt-4"
                  variant="outline"
                >
                  Start Chatting
                </Button>
              )}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                onClick={() => {
                  window.location.href = `/messages/${conversation.id}`;
                }}
              />
            ))
          )}
        </div>
      </div>

      <NewChatDialog
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        mutualFollowers={mutualFollowers}
        currentUserId={currentUser.id}
      />
    </div>
  );
}