"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  ArrowLeft,
  Loader2,
  CheckCircle,
  X,
  Upload,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Status = "idle" | "uploading" | "success" | "error";

export default function UploadMeetingPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  function addAttendee() {
    const name = attendeeInput.trim();
    if (name && !attendees.includes(name)) {
      setAttendees((prev) => [...prev, name]);
    }
    setAttendeeInput("");
  }

  function removeAttendee(name: string) {
    setAttendees((prev) => prev.filter((a) => a !== name));
  }

  function handleAttendeeKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addAttendee();
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("File too large (max 10 MB)");
      return;
    }
    const text = await file.text();
    setTranscript(text);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !transcript.trim()) {
      setStatus("error");
      setMessage("Title and transcript content are required.");
      return;
    }

    setStatus("uploading");
    setMessage("");

    // Use the file upload endpoint with a synthetic file
    // This goes through the full pipeline (extract → embed → link)
    const blob = new Blob([transcript], { type: "text/plain" });
    const file = new File([blob], `${title.trim()}.txt`, {
      type: "text/plain",
    });

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/ingest/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (!res.ok && res.status !== 207) {
        setStatus("error");
        setMessage(data.error ?? "Upload failed");
        return;
      }

      if (data.status === "error") {
        setStatus("error");
        setMessage("Saved but processing failed. It will be retried.");
        return;
      }

      setStatus("success");
      setMessage("Meeting transcript uploaded and processed successfully.");
      setTimeout(() => router.push("/context"), 1500);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  const canSubmit = title.trim() && transcript.trim() && status !== "uploading";

  return (
    <div className="flex flex-col p-4 sm:p-8 gap-6 max-w-2xl">
      {/* Header */}
      <div>
        <Link
          href="/context"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Library
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Mic className="h-5 w-5 text-orange-500" />
          <h1 className="text-2xl font-semibold">Upload Meeting Transcript</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Paste or upload a meeting transcript to add it to your context
          library. It will be automatically processed and linked to relevant
          sessions.
        </p>
      </div>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Weekly Sprint Planning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={status === "uploading"}
            />
          </div>

          {/* Date + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Meeting Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={status === "uploading"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={status === "uploading"}
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label>Attendees</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Name or email"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={handleAttendeeKeyDown}
                disabled={status === "uploading"}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAttendee}
                disabled={!attendeeInput.trim() || status === "uploading"}
                className="shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {attendees.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="gap-1 text-xs font-normal"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => removeAttendee(name)}
                      className="hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Transcript */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="transcript">Transcript Content *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={status === "uploading"}
                className="text-xs h-7"
              >
                <Upload className="h-3 w-3 mr-1" />
                Upload .txt / .md
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
            <Textarea
              id="transcript"
              placeholder="Paste your meeting transcript here…"
              rows={12}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={status === "uploading"}
              className="font-mono text-sm"
            />
            {transcript && (
              <p className="text-xs text-muted-foreground">
                {transcript.length.toLocaleString()} characters
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {status === "success" && (
                <p className="text-sm text-green-600 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  {message}
                </p>
              )}
              {status === "error" && (
                <p className="text-sm text-destructive">{message}</p>
              )}
            </div>
            <Button type="submit" disabled={!canSubmit}>
              {status === "uploading" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mic className="h-4 w-4 mr-2" />
              )}
              {status === "uploading"
                ? "Processing…"
                : "Upload Transcript"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
