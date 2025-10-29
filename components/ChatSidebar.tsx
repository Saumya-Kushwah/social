"use client";

import { useState, useEffect } from "react";
import { X, Search, ArrowLeft, MessageCircle } from "lucide-react";
import ChatRoom from "./ChatRoom";
import ConversationItem from "./ConversationItem";
import {
  getConversations,
  getMutualFollowers,
  getOrCreateConversation,
} from "@/actions/chat.action";
import type { ConversationWithDetails, ChatUser } from "@/types/chat.types";
import { useSocket } from "./SocketProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUser: ChatUser;
}

export default function ChatSidebar({
  isOpen,
  onClose,
  currentUser,
  currentUserId,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [mutualFollowers, setMutualFollowers] = useState<ChatUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [convos, followers] = await Promise.all([
        getConversations(),
        getMutualFollowers(),
      ]);
      setConversations(convos);
      setMutualFollowers(followers);
      setFilteredUsers(followers);
    } catch (error) {
      console.error("Error fetching chat data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => {
      fetchData();
    };
    socket.on("new-message", handleNewMessage);
    return () => {
      socket.off("new-message", handleNewMessage);
    };
  }, [socket]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = mutualFollowers.filter(
        (user) =>
          user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(mutualFollowers);
    }
  }, [searchQuery, mutualFollowers]);

  const handleUserSelect = async (user: ChatUser) => {
    try {
      const { conversationId } = await getOrCreateConversation(user.id);
      setSelectedConversationId(conversationId);
      setSelectedUser(user);
      setSearchQuery("");
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setSelectedUser(null);
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
    setSelectedUser(null);
    fetchData();
  };

  if (!isOpen) return null;

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );
  const otherUser = selectedConversation?.otherUser || selectedUser;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Main Sidebar Container */}
      <div className="relative ml-auto w-full max-w-lg h-full bg-card shadow-xl flex flex-col border-l">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {selectedConversationId ? (
            <button
              onClick={handleBackToList}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <h2 className="text-xl font-semibold">Messages</h2>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        {selectedConversationId && otherUser ? (
          <ChatRoom
            conversationId={selectedConversationId}
            otherUser={otherUser}
            currentUserId={currentUserId}
            currentUser={currentUser}
            
          />
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search Bar */}
            <div className="p-4 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search mutual followers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-accent rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="border-b shrink-0">
                <div className="p-2 text-sm text-muted-foreground font-medium">
                  Mutual Followers
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No users found
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        className="w-full p-3 hover:bg-accent transition-colors flex items-center gap-3 text-left"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage
                            src={user.image || ""}
                            alt={user.username || "User avatar"}
                          />
                          <AvatarFallback>
                            {user.name?.[0] ||
                              user.username?.[0]?.toUpperCase() ||
                              "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {user.name || user.username || "User"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            @{user.username ?? "user"}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
                  <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-center">
                    No messages yet. Search for mutual followers to start
                    chatting!
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      onClick={() => handleConversationSelect(conversation.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
