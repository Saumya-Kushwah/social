import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getDbUserId } from "@/actions/user.action";
import { getMessages } from "@/actions/chat.action";
import prisma from "@/lib/prisma";
import ChatRoom from "@/components/ChatRoom";

interface ConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect("/sign-in");
  }

  const dbUserId = await getDbUserId();

  if (!dbUserId) {
    redirect("/");
  }

  // Verify user is part of this conversation
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: dbUserId,
    },
  });

  if (!participant) {
    redirect("/messages");
  }

  // Get the other user in the conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        where: {
          userId: { not: dbUserId },
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
    },
  });

  if (!conversation || conversation.participants.length === 0) {
    redirect("/messages");
  }

  const otherUser = conversation.participants[0].user;

  const currentUserData = {
    id: dbUserId,
    username: clerkUser.username || clerkUser.emailAddresses[0].emailAddress.split("@")[0],
    name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || null,
    image: clerkUser.imageUrl,
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)]">
      <div className="bg-card rounded-lg shadow-sm border h-full flex flex-col">
        <ChatRoom
          conversationId={conversationId}
          otherUser={otherUser}
          currentUserId={dbUserId}
          currentUser={currentUserData}
        />
      </div>
    </div>
  );
}