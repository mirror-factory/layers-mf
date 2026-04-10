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
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // Keep ref in sync with state
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

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
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(url);
          // Restart listening after TTS finishes
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
      <div className="relative flex flex-col items-center justify-end gap-3 py-6 px-4 min-h-[220px] animate-in fade-in zoom-in-95 duration-500">
        {/* Top fade gradient — fades message history into background */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-12 z-10 pointer-events-none bg-gradient-to-b",
            isDark ? "from-[#1a1f2e] via-[#1a1f2e]/80" : "from-slate-50 via-slate-50/80"
          )}
        />

        {/* Recent messages — faded transcript bubbles above the mic */}
        {messageList.length > 0 && (
          <div className="w-full max-w-md flex flex-col gap-2 mb-1">
            {messageList.map((msg, i) => {
              // Older messages are more faded
              const age = messageList.length - 1 - i;
              const opacity = age === 0 ? 1 : age === 1 ? 0.55 : 0.3;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                    msg.role === "user"
                      ? cn("ml-auto", isDark ? "bg-white/10 text-white/90" : "bg-sky-100 text-slate-800")
                      : cn("mr-auto", isDark ? "text-white/80" : "text-slate-700")
                  )}
                  style={{ opacity }}
                >
                  {msg.text.length > 160 ? msg.text.slice(0, 160) + "..." : msg.text}
                </div>
              );
            })}
          </div>
        )}

        {/* Live transcript as typing indicator (above mic) */}
        {transcript && (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-[13px] ml-auto max-w-[85%] animate-in fade-in duration-200",
              isDark ? "bg-white/5 text-white/60" : "bg-slate-100 text-slate-500"
            )}
          >
            <span className="animate-pulse">{transcript}</span>
          </div>
        )}

        {/* Mic button — large, centered, prominent */}
        <div className="relative flex flex-col items-center gap-2 mt-2">
          {/* Pulsing halo when listening */}
          {isListening && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full animate-ping pointer-events-none"
              style={{ backgroundColor: brandColor, opacity: 0.25 }}
            />
          )}
          <button
            onClick={toggleVoice}
            className={cn(
              "relative flex items-center justify-center rounded-full h-16 w-16 transition-all duration-300 hover:scale-105",
              isSpeaking && "animate-pulse"
            )}
            style={{
              backgroundColor: brandColor,
              boxShadow: `0 0 0 4px ${brandColor}20, 0 8px 24px ${brandColor}40`,
            }}
            title="Stop voice mode"
            aria-label="Stop voice mode"
          >
            <Mic className="h-7 w-7 text-white" />
          </button>

          {/* Status + TTS toggle */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5">
              <div
                className={cn("h-1.5 w-1.5 rounded-full shrink-0", isListening ? "animate-pulse" : "")}
                style={{ backgroundColor: isListening ? "#22c55e" : isSpeaking ? brandColor : "#94a3b8" }}
              />
              <span className={cn("text-[11px] font-medium", isDark ? "text-white/50" : "text-slate-500")}>
                {isListening ? "Listening…" : isSpeaking ? "Speaking…" : "Ready"}
              </span>
            </div>
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={cn(
                "p-1 rounded-lg transition-colors",
                isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
              )}
              title={ttsEnabled ? "Mute voice" : "Unmute voice"}
            >
              {ttsEnabled ? (
                <Volume2 className={cn("h-3 w-3", isDark ? "text-white/50" : "text-slate-400")} />
              ) : (
                <VolumeX className={cn("h-3 w-3", isDark ? "text-white/30" : "text-slate-300")} />
              )}
            </button>
          </div>
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
