import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";

const f = createUploadthing();

export const ourFileRouter = {
  // define routes for different upload types
  postImage: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // this code runs on your server before upload
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");

      // whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
  try {
    // You have the userId and fileUrl here
    console.log("Upload complete for user:", metadata.userId);
    console.log("File URL:", file.url);

    // 👇 Example: Update the user's profile picture URL in your database
    // await db.user.update({
    //   where: { id: metadata.userId },
    //   data: { profileImageUrl: file.url },
    // });

    return { fileUrl: file.url };
  } catch (error) {
    console.error("Error saving to database:", error);
    // You might want to delete the uploaded file from UploadThing here
    // if the database update fails.
    throw new Error("Failed to save file URL to database.");
  }
}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;