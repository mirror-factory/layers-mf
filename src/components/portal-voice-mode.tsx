"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalVoiceModeProps {
  onTranscript: (text: string) => void;
  lastAIResponse?: string;
  recentMessages?: { role: "user" | "assistant"; text: string }[];
  brandColor?: string;
  isDark?: boolean;
  disabled?: boolean;
  /** When true, renders inline (no fixed positioning) for embedding inside a container */
  inline?: boolean;
  /** External control: when provided, voice mode is toggled from outside */
  active?: boolean;
  /** Callback when voice mode is toggled internally */
  onActiveChange?: (active: boolean) => void;
}

export function PortalVoiceMode({
  onTranscript,
  lastAIResponse,
  recentMessages,
  brandColor = "#0DE4F2",
  isDark = true,
  disabled = false,
  inline = false,
  active,
  onActiveChange,
}: PortalVoiceModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenRef = useRef<string>("");
  const voiceEnabledRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Initialize speech recognition
  const startListening = useCallback(() => {
    if (disabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interim = result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);

      // Reset silence timer — send after 2s of silence
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (finalTranscript.trim()) {
          onTranscript(finalTranscript.trim());
          finalTranscript = "";
          setTranscript("");
        }
      }, 2000);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "aborted") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in voice mode (use ref to avoid stale closure)
      if (voiceEnabledRef.current) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [disabled, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript("");
  }, []);

  // Toggle voice mode
  const toggleVoice = useCallback(() => {
    if (voiceEnabled) {
      stopListening();
      setVoiceEnabled(false);
      onActiveChange?.(false);
    } else {
      setVoiceEnabled(true);
      startListening();
      onActiveChange?.(true);
    }
  }, [voiceEnabled, startListening, stopListening, onActiveChange]);

  // Sync external active prop with internal state
  useEffect(() => {
    if (active === undefined) return;
    if (active && !voiceEnabled) {
      setVoiceEnabled(true);
      startListening();
    } else if (!active && voiceEnabled) {
      stopListening();
      setVoiceEnabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Speak AI response via browser TTS (fallback — ElevenLabs integration can be added)
  useEffect(() => {
    if (!ttsEnabled || !voiceEnabled || !lastAIResponse) return;
    if (lastAIResponse === lastSpokenRef.current) return;
    lastSpokenRef.current = lastAIResponse;

    // Strip markdown formatting for speech
    const cleanText = lastAIResponse
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/```[\s\S]*?```/g, "code block omitted")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .slice(0, 500); // Limit to first 500 chars for TTS

    if (!cleanText.trim()) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesis.cancel(); // Cancel any ongoing speech
    speechSynthesis.speak(utterance);
  }, [lastAIResponse, ttsEnabled, voiceEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      speechSynthesis.cancel();
    };
  }, [stopListening]);

  if (disabled) return null;

  // Shared overlay content (transcript, messages, waveform)
  const overlayContent = voiceEnabled ? (
    <div className={cn(
      inline
        ? "p-3 border-b"
        : "fixed bottom-24 right-4 md:right-6 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-3 shadow-2xl border backdrop-blur-xl",
      isDark ? (inline ? "border-white/10" : "bg-[#0a0a0f]/95 border-white/10") : (inline ? "border-slate-200" : "bg-white/95 border-slate-200")
    )}>
      {/* Controls row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn("h-2 w-2 rounded-full", isListening ? "animate-pulse" : "")}
            style={{ backgroundColor: isListening ? "#22c55e" : "#94a3b8" }}
          />
          <span className={cn("text-[11px] font-medium", isDark ? "text-white/60" : "text-slate-500")}>
            {isListening ? "Listening..." : isSpeaking ? "Speaking..." : "Ready"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={cn("p-1 rounded-lg", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}
          >
            {ttsEnabled ? <Volume2 className={cn("h-3 w-3", isDark ? "text-white/50" : "text-slate-400")} /> : <VolumeX className={cn("h-3 w-3", isDark ? "text-white/30" : "text-slate-300")} />}
          </button>
          {!inline && (
            <button onClick={toggleVoice} className={cn("p-1 rounded-lg", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}>
              <X className={cn("h-3 w-3", isDark ? "text-white/50" : "text-slate-400")} />
            </button>
          )}
        </div>
      </div>

      {/* Recent messages — last 4 */}
      {recentMessages && recentMessages.length > 0 && (
        <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
          {recentMessages.slice(-4).map((msg, i) => (
            <div key={i} className={cn(
              "rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed",
              msg.role === "user"
                ? isDark ? "bg-white/5 text-white/70 ml-6" : "bg-sky-50 text-slate-700 ml-6"
                : isDark ? "text-white/80 mr-6" : "text-slate-700 mr-6"
            )}>
              {msg.text.length > 120 ? msg.text.slice(0, 120) + "..." : msg.text}
            </div>
          ))}
        </div>
      )}

      {/* Live transcript */}
      {transcript && (
        <div className={cn(
          "rounded-lg p-2 text-[12px] animate-pulse",
          isDark ? "bg-white/5 text-white/70" : "bg-slate-50 text-slate-600"
        )}>
          {transcript}
        </div>
      )}

      {/* Waveform when idle */}
      {isListening && !transcript && (!recentMessages || recentMessages.length === 0) && (
        <div className="flex items-center justify-center gap-1 h-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-0.5 rounded-full animate-pulse"
              style={{
                backgroundColor: brandColor,
                height: `${8 + Math.random() * 12}px`,
                animationDelay: `${i * 150}ms`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      )}
    </div>
  ) : null;

  // Inline mode: only render the overlay content (mic button is in parent header)
  if (inline) {
    return overlayContent;
  }

  // Standalone (fixed) mode: render floating button + overlay
  return (
    <>
      {/* Voice mode floating button */}
      <button
        onClick={toggleVoice}
        className={cn(
          "fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-center justify-center rounded-full shadow-2xl transition-all duration-300",
          voiceEnabled ? "h-16 w-16" : "h-12 w-12",
          voiceEnabled && isListening && "animate-pulse"
        )}
        style={{
          backgroundColor: voiceEnabled ? brandColor : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
          border: `2px solid ${voiceEnabled ? brandColor : "transparent"}`,
        }}
        title={voiceEnabled ? "Disable voice mode" : "Enable voice mode"}
      >
        {voiceEnabled ? (
          <Mic className={cn("h-6 w-6", voiceEnabled ? "text-white" : isDark ? "text-white/70" : "text-slate-600")} />
        ) : (
          <MicOff className={cn("h-5 w-5", isDark ? "text-white/50" : "text-slate-500")} />
        )}
      </button>

      {overlayContent}
    </>
  );
}
