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
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenRef = useRef<string>("");
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // Single source of truth: use `active` prop if provided, else internal state
  const [internalActive, setInternalActive] = useState(false);
  const voiceEnabled = active !== undefined ? active : internalActive;
  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;

  // Barge-in: stop TTS audio when user starts speaking
  const stopTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Start or restart speech recognition (reuses single instance)
  const startListening = useCallback(() => {
    if (disabled) return;

    // If already have a recognition instance, just restart it
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch {}
      setIsListening(true);
      return;
    }

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
      // Barge-in: stop TTS when user starts speaking
      stopTTS();

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

      // Reset silence timer — send after 1.5s of silence
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (finalTranscript.trim()) {
          onTranscriptRef.current(finalTranscript.trim());
          finalTranscript = "";
          setTranscript("");
        }
      }, 1500);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setIsListening(false);
        return;
      }
      // For transient errors, auto-restart
      if (voiceEnabledRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 500);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in voice mode
      if (voiceEnabledRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 200);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      console.error("Failed to start recognition");
    }
  }, [disabled, stopTTS]);

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
      setInternalActive(false);
      onActiveChange?.(false);
    } else {
      setInternalActive(true);
      onActiveChange?.(true);
      // Start listening on next tick after state updates
      setTimeout(() => startListening(), 50);
    }
  }, [voiceEnabled, startListening, stopListening, onActiveChange]);

  // Start/stop recognition when voiceEnabled changes
  useEffect(() => {
    if (voiceEnabled) {
      startListening();
    } else {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled]);

  // Speak AI response via Cartesia TTS API
  useEffect(() => {
    if (!ttsEnabled || !voiceEnabled || !lastAIResponse) return;
    if (lastAIResponse === lastSpokenRef.current) return;
    lastSpokenRef.current = lastAIResponse;

    // Strip markdown for speech
    const cleanText = lastAIResponse
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\|[^\n]+\|/g, "") // Remove markdown tables
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);

    if (!cleanText || cleanText.length < 3) return;

    setIsSpeaking(true);
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText }),
        });

        if (!res.ok || cancelled) {
          // Fall back to browser TTS
          if (!cancelled) {
            const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 500));
            utterance.rate = 1.1;
            utterance.onend = () => {
              setIsSpeaking(false);
              // Restart listening after TTS finishes
              if (voiceEnabledRef.current) startListening();
            };
            utterance.onerror = () => setIsSpeaking(false);
            speechSynthesis.cancel();
            speechSynthesis.speak(utterance);
          }
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        // Ensure recognition stays active during TTS for barge-in
        if (voiceEnabledRef.current) {
          setTimeout(() => startListening(), 300);
        }

        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(url);
          if (voiceEnabledRef.current) startListening();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(url);
        };
        if (!cancelled) {
          await audio.play();
        }
      } catch {
        if (!cancelled) setIsSpeaking(false);
      }
    })();

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [lastAIResponse, ttsEnabled, voiceEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [stopListening]);

  if (disabled) return null;

  // Inline mode: clean centered column that transforms the chat input area.
  // Messages/transcript fade out at the top, big mic button at bottom.
  if (inline) {
    if (!voiceEnabled) return null;

    const messageList = recentMessages?.slice(-3) ?? [];

    return (
      <div className="flex flex-col items-center gap-2 py-3 px-3 animate-in fade-in duration-300">
        {/* Live transcript */}
        {transcript && (
          <div className={cn(
            "w-full rounded-lg px-3 py-1.5 text-[12px] text-center",
            isDark ? "bg-white/5 text-white/60" : "bg-slate-100 text-slate-500"
          )}>
            <span className="animate-pulse">{transcript}</span>
          </div>
        )}

        {/* Waveform + mic row */}
        <div className="flex items-center gap-3">
          {/* Waveform bars (left) */}
          <div className="flex items-center gap-0.5 h-8 w-12 justify-end">
            {isListening && [0,1,2,3].map(i => (
              <div key={i} className="w-[3px] rounded-full animate-pulse"
                style={{ backgroundColor: brandColor, height: `${10 + Math.random() * 14}px`, animationDelay: `${i * 120}ms`, opacity: 0.6 }} />
            ))}
            {isSpeaking && [0,1,2,3].map(i => (
              <div key={i} className="w-[3px] rounded-full animate-pulse"
                style={{ backgroundColor: "#f59e0b", height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 100}ms`, opacity: 0.7 }} />
            ))}
          </div>

          {/* Mic button — compact */}
          <button
            onClick={toggleVoice}
            className={cn(
              "relative flex items-center justify-center rounded-full h-10 w-10 transition-all duration-200 hover:scale-105 shrink-0",
              isSpeaking && "animate-pulse"
            )}
            style={{ backgroundColor: brandColor, boxShadow: `0 0 0 3px ${brandColor}20` }}
            title="Stop voice mode"
          >
            <Mic className="h-4 w-4 text-white" />
          </button>

          {/* Waveform bars (right) */}
          <div className="flex items-center gap-0.5 h-8 w-12">
            {isListening && [0,1,2,3].map(i => (
              <div key={i} className="w-[3px] rounded-full animate-pulse"
                style={{ backgroundColor: brandColor, height: `${10 + Math.random() * 14}px`, animationDelay: `${i * 120 + 60}ms`, opacity: 0.6 }} />
            ))}
            {isSpeaking && [0,1,2,3].map(i => (
              <div key={i} className="w-[3px] rounded-full animate-pulse"
                style={{ backgroundColor: "#f59e0b", height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 100 + 50}ms`, opacity: 0.7 }} />
            ))}
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2">
          <div className={cn("h-1.5 w-1.5 rounded-full", isListening ? "bg-green-500 animate-pulse" : isSpeaking ? "animate-pulse" : "bg-slate-400")}
            style={isSpeaking ? { backgroundColor: "#f59e0b" } : undefined} />
          <span className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
            {isListening ? "Listening — speak to interrupt" : isSpeaking ? "Speaking — tap mic to stop" : "Ready"}
          </span>
          <button onClick={() => setTtsEnabled(!ttsEnabled)}
            className={cn("p-0.5 rounded", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}
            title={ttsEnabled ? "Mute" : "Unmute"}>
            {ttsEnabled ? <Volume2 className="h-3 w-3 text-muted-foreground" /> : <VolumeX className="h-3 w-3 text-muted-foreground/50" />}
          </button>
        </div>
      </div>
    );
  }

  // Standalone (fixed) voice chat bubble content
  const voiceChatBubble = voiceEnabled ? (
    <div className={cn(
      "flex flex-col",
      "fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border backdrop-blur-xl",
      isDark ? "bg-[#1a1f2e]/95 border-white/10" : "bg-slate-50/95 border-slate-200"
    )}>
      {/* Header — close + mute controls */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5">
          <div
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", isListening ? "animate-pulse" : "")}
            style={{ backgroundColor: isListening ? "#22c55e" : isSpeaking ? brandColor : "#94a3b8" }}
          />
          <span className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
            {isListening ? "Listening..." : isSpeaking ? "Speaking..." : "Ready"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={cn("p-1 rounded-lg transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}
          >
            {ttsEnabled
              ? <Volume2 className={cn("h-3 w-3", isDark ? "text-white/50" : "text-slate-400")} />
              : <VolumeX className={cn("h-3 w-3", isDark ? "text-white/30" : "text-slate-300")} />}
          </button>
          <button onClick={toggleVoice} className={cn("p-1 rounded-lg transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}>
            <X className={cn("h-3 w-3", isDark ? "text-white/50" : "text-slate-400")} />
          </button>
        </div>
      </div>

      {/* Messages area with top fade */}
      <div className="relative max-h-48 overflow-y-auto">
        {/* Top fade gradient */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none bg-gradient-to-b",
          isDark ? "from-[#1a1f2e]" : "from-slate-50"
        )} />

        <div className="space-y-2 px-3 py-2">
          {recentMessages?.slice(-4).map((msg, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl px-3 py-2 text-[13px] leading-relaxed max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === "user"
                  ? cn("ml-auto", isDark ? "bg-white/10 text-white/90" : "bg-sky-100 text-slate-800")
                  : cn("mr-auto", isDark ? "text-white/80" : "text-slate-700")
              )}
            >
              {msg.text.length > 150 ? msg.text.slice(0, 150) + "..." : msg.text}
            </div>
          ))}
        </div>
      </div>

      {/* Current transcript as typing indicator */}
      {transcript && (
        <div className={cn(
          "mx-3 mb-2 rounded-2xl px-3 py-2 text-[13px] ml-auto max-w-[85%]",
          isDark ? "bg-white/5 text-white/50" : "bg-slate-100 text-slate-400"
        )}>
          <span className="animate-pulse">{transcript}</span>
        </div>
      )}

      {/* Waveform visualization during listening */}
      {isListening && !transcript && (
        <div className="flex items-center justify-center gap-0.5 h-4 mb-1">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="w-0.5 rounded-full animate-pulse"
              style={{
                backgroundColor: brandColor,
                height: `${4 + Math.random() * 10}px`,
                animationDelay: `${i * 100}ms`,
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      )}

      {/* Mic button — prominent, centered at bottom */}
      <div className="flex items-center justify-center py-2">
        <button
          onClick={toggleVoice}
          className={cn(
            "flex items-center justify-center rounded-full h-12 w-12 transition-all duration-300 shadow-lg",
            isListening && "animate-pulse"
          )}
          style={{
            backgroundColor: brandColor,
            border: `2px solid ${brandColor}`,
          }}
          title="Stop voice mode"
        >
          <Mic className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  ) : null;

  // Standalone (fixed) mode: show mic button when off, transformed card when on
  if (voiceEnabled) {
    return voiceChatBubble;
  }

  return (
    <button
      onClick={toggleVoice}
      className={cn(
        "fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-center justify-center rounded-full h-12 w-12 shadow-2xl transition-all duration-300"
      )}
      style={{
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        border: "2px solid transparent",
      }}
      title="Enable voice mode"
    >
      <MicOff className={cn("h-5 w-5", isDark ? "text-white/50" : "text-slate-500")} />
    </button>
  );
}
