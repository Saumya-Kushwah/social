import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Create route handler - UploadThing will automatically use UPLOADTHING_TOKEN from environment
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});