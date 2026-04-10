"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalVoiceModeProps {
  onTranscript: (text: string) => void;
  lastAIResponse?: string;
  brandColor?: string;
  isDark?: boolean;
  disabled?: boolean;
}

export function PortalVoiceMode({
  onTranscript,
  lastAIResponse,
  brandColor = "#0DE4F2",
  isDark = true,
  disabled = false,
}: PortalVoiceModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenRef = useRef<string>("");

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
      // Auto-restart if still in voice mode
      if (voiceEnabled && isListening) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [disabled, onTranscript, voiceEnabled, isListening]);

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
    } else {
      setVoiceEnabled(true);
      startListening();
    }
  }, [voiceEnabled, startListening, stopListening]);

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

  return (
    <>
      {/* Voice mode floating button */}
      <button
        onClick={toggleVoice}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-2xl transition-all duration-300",
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

      {/* Voice mode overlay — shows transcript and controls */}
      {voiceEnabled && (
        <div className={cn(
          "fixed bottom-24 right-6 z-50 w-72 rounded-2xl p-4 shadow-2xl border backdrop-blur-xl",
          isDark ? "bg-[#0a0a0f]/95 border-white/10" : "bg-white/95 border-slate-200"
        )}>
          {/* Controls */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2 w-2 rounded-full", isListening ? "animate-pulse" : "")}
                style={{ backgroundColor: isListening ? "#22c55e" : "#94a3b8" }}
              />
              <span className={cn("text-xs font-medium", isDark ? "text-white/70" : "text-slate-600")}>
                {isListening ? "Listening..." : isSpeaking ? "Speaking..." : "Paused"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={cn("p-1.5 rounded-lg transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}
                title={ttsEnabled ? "Mute responses" : "Unmute responses"}
              >
                {ttsEnabled ? (
                  <Volume2 className={cn("h-3.5 w-3.5", isDark ? "text-white/60" : "text-slate-500")} />
                ) : (
                  <VolumeX className={cn("h-3.5 w-3.5", isDark ? "text-white/40" : "text-slate-400")} />
                )}
              </button>
              <button
                onClick={toggleVoice}
                className={cn("p-1.5 rounded-lg transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}
              >
                <X className={cn("h-3.5 w-3.5", isDark ? "text-white/60" : "text-slate-500")} />
              </button>
            </div>
          </div>

          {/* Live transcript */}
          {transcript && (
            <div className={cn(
              "rounded-lg p-2.5 text-sm min-h-[2rem]",
              isDark ? "bg-white/5 text-white/80" : "bg-slate-50 text-slate-700"
            )}>
              {transcript}
            </div>
          )}

          {/* Waveform visualization placeholder */}
          {isListening && !transcript && (
            <div className="flex items-center justify-center gap-1 h-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1 rounded-full animate-pulse"
                  style={{
                    backgroundColor: brandColor,
                    height: `${12 + Math.random() * 16}px`,
                    animationDelay: `${i * 150}ms`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
