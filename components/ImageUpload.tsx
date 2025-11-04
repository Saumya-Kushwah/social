"use client";

import { UploadDropzone } from "@/lib/uploadthing";
import { XIcon } from "lucide-react";
import Image from "next/image";

interface ImageUploadProps {
  onChange: (url: string) => void;
  value: string;
  endpoint: "postImage";
}

export default function ImageUpload({ endpoint, onChange, value }: ImageUploadProps) {
  if (value) {
    return (
      <div className="relative w-40 h-40">
        <Image 
          src={value} 
          alt="Upload" 
          fill
          className="rounded-md object-cover" 
        />
        <button
          onClick={() => onChange("")}
          className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full shadow-sm hover:bg-red-600 transition-colors"
          type="button"
          aria-label="Remove image"
        >
          <XIcon className="h-4 w-4 text-white" />
        </button>
      </div>
    );
  }

  return (
    <UploadDropzone
      endpoint={endpoint}
      onClientUploadComplete={(res) => {
        if (res && res[0]) {
          onChange(res[0].url);
        }
      }}
      onUploadError={(error: Error) => {
        console.error("Upload error:", error);
        alert(`Upload failed: ${error.message}`);
      }}
      appearance={{
        button: "ut-ready:bg-primary ut-uploading:cursor-not-allowed bg-primary/50",
        container: "w-full flex-col gap-2 p-4 border-2 border-dashed rounded-lg",
        allowedContent: "text-sm text-muted-foreground",
      }}
    />
  );
}