"use server";

import prisma from "@/lib/prisma";
import { getDbUserId } from "./user.action";
import type { ConversationWithDetails, MessageWithSender } from "@/types/chat.types";

export async function getOrCreateConversation(otherUserId: string) {
  try {
    const userId = await getDbUserId();
    if (!userId) throw new Error("Unauthorized");

    // Check if both users follow each other
    const [isFollowing, isFollowedBy] = await Promise.all([
      prisma.follows.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: otherUserId,
          },
        },
      }),
      prisma.follows.findUnique({
        where: {
          followerId_followingId: {
            followerId: otherUserId,
            followingId: userId,
          },
        },
      }),
    ]);

    if (!isFollowing || !isFollowedBy) {
      throw new Error("You can only chat with mutual followers");
    }

    // ✅ FIXED: Find existing conversation between exactly these two users
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            participants: {
              some: { userId: userId }
            }
          },
          {
            participants: {
              some: { userId: otherUserId }
            }
          }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    // Additional verification: ensure conversation has exactly 2 participants
    if (existingConversation) {
      const participantIds = existingConversation.participants.map(p => p.userId);
      if (participantIds.length === 2 && 
          participantIds.includes(userId) && 
          participantIds.includes(otherUserId)) {
        return { conversationId: existingConversation.id };
      }
    }

    // Create new conversation
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId },
            { userId: otherUserId },
          ],
        },
      },
    });

    return { conversationId: newConversation.id };
  } catch (error) {
    console.error("Error in getOrCreateConversation:", error);
    throw error;
  }
}

export async function getConversations(): Promise<ConversationWithDetails[]> {
  try {
    const userId = await getDbUserId();
    if (!userId) return [];

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: {
          where: {
            userId: { not: userId },
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                image: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Get unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation) => {
        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            conversationId: conversation.id,
            userId,
          },
        });

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: userId },
            createdAt: {
              gt: participant?.lastReadAt || new Date(0),
            },
          },
        });

        const otherUser = conversation.participants[0]?.user;
        const lastMessage = conversation.messages[0];

        return {
          id: conversation.id,
          updatedAt: conversation.updatedAt,
          otherUser: {
            id: otherUser.id,
            username: otherUser.username,
            name: otherUser.name,
            image: otherUser.image,
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
                read: lastMessage.read,
              }
            : null,
          unreadCount,
        };
      })
    );

    return conversationsWithUnread;
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
}

export async function getMessages(conversationId: string): Promise<MessageWithSender[]> {
  try {
    const userId = await getDbUserId();
    if (!userId) return [];

    // Verify user is part of this conversation
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!participant) {
      throw new Error("Unauthorized");
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return messages.map((message) => ({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      read: message.read,
      senderId: message.senderId,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        name: message.sender.name,
        image: message.sender.image,
      },
    }));
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

export async function getMutualFollowers() {
  try {
    const userId = await getDbUserId();
    if (!userId) return [];

    // Get users who follow us AND we follow them
    const mutualFollowers = await prisma.user.findMany({
      where: {
        AND: [
          {
            followers: {
              some: {
                followerId: userId,
              },
            },
          },
          {
            following: {
              some: {
                followingId: userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        image: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return mutualFollowers;
  } catch (error) {
    console.error("Error fetching mutual followers:", error);
    return [];
  }
}

export async function getTotalUnreadCount(): Promise<number> {
  try {
    const userId = await getDbUserId();
    if (!userId) return 0;

    const participants = await prisma.conversationParticipant.findMany({
      where: {
        userId,
      },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    });

    let totalUnread = 0;

    for (const participant of participants) {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: participant.conversationId,
          senderId: { not: userId },
          createdAt: {
            gt: participant.lastReadAt,
          },
        },
      });
      totalUnread += unreadCount;
    }

    return totalUnread;
  } catch (error) {
    console.error("Error getting total unread count:", error);
    return 0;
  }
}