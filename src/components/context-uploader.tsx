"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED = ".pdf,.docx,.txt,.md";

export function ContextUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setMessage(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/ingest/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok && res.status !== 207) {
        setMessage({ text: data.error ?? "Upload failed", ok: false });
      } else if (data.status === "error") {
        setMessage({ text: "File saved but processing failed. Will retry.", ok: false });
      } else {
        setMessage({ text: `"${file.name}" processed successfully.`, ok: true });
        router.refresh();
      }
    } catch {
      setMessage({ text: "Network error. Please try again.", ok: false });
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  return (
    <div className="space-y-3">
      <div
        data-testid="upload-dropzone"
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
          uploading && "pointer-events-none opacity-60"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
        )}
        <p className="text-sm font-medium mb-1">
          {uploading ? "Processing…" : "Drop a file here"}
        </p>
        <p className="text-xs text-muted-foreground mb-4">PDF, DOCX, TXT, or Markdown — max 10 MB</p>
        <Button
          data-testid="upload-browse-button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          data-testid="upload-file-input"
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {message && (
        <p data-testid="upload-message" className={cn("text-sm", message.ok ? "text-green-600" : "text-destructive")}>
          {message.text}
        </p>
      )}
    </div>
  );
}
