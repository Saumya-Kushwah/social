import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getDbUserId } from "@/actions/user.action";
import { getConversations, getMutualFollowers } from "@/actions/chat.action";
import MessagesClient from "@/components/messages/MessageClient";

export default async function MessagesPage() {
  const clerkUser = await currentUser();
  
  if (!clerkUser) {
    redirect("/sign-in");
  }

  const dbUserId = await getDbUserId();
  
  if (!dbUserId) {
    redirect("/");
  }

  const [conversations, mutualFollowers] = await Promise.all([
    getConversations(),
    getMutualFollowers(),
  ]);

  const currentUserData = {
    id: dbUserId,
    username: clerkUser.username || clerkUser.emailAddresses[0].emailAddress.split("@")[0],
    name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || null,
    image: clerkUser.imageUrl,
  };

  return (
    <MessagesClient
      conversations={conversations}
      mutualFollowers={mutualFollowers}
      currentUser={currentUserData}
    />
  );
}