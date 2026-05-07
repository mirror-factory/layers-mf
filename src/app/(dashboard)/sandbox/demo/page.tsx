"use client";

import { useState, useCallback } from "react";
import {
  Play,
  Square,
  RotateCcw,
  Loader2,
  ExternalLink,
  Clock,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SandboxStatus = "stopped" | "starting" | "running" | "stopping" | "unhealthy" | "error";

interface SandboxState {
  sandboxId: string | null;
  previewUrl: string | null;
  status: SandboxStatus;
  uptime: number;
  error: string | null;
  files: string[];
}

const STATUS_CONFIG: Record<SandboxStatus, { label: string; color: string; icon: React.ElementType }> = {
  stopped: { label: "Stopped", color: "text-muted-foreground", icon: Square },
  starting: { label: "Starting...", color: "text-amber-500", icon: Loader2 },
  running: { label: "Running", color: "text-green-500", icon: CheckCircle },
  stopping: { label: "Stopping...", color: "text-amber-500", icon: Loader2 },
  unhealthy: { label: "Unhealthy", color: "text-red-500", icon: AlertTriangle },
  error: { label: "Error", color: "text-red-500", icon: XCircle },
};

export default function SandboxDemoPage() {
  const [state, setState] = useState<SandboxState>({
    sandboxId: null,
    previewUrl: null,
    status: "stopped",
    uptime: 0,
    error: null,
    files: [],
  });
  const [logs, setLogs] = useState<string[]>([]);

  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, status: "starting", error: null }));
    log("Creating sandbox with demo React app...");

    try {
      const res = await fetch("/api/sandbox/demo", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setState((s) => ({ ...s, status: "error", error: data.error ?? "Failed" }));
        log(`Error: ${data.error ?? "Unknown error"}`);
        return;
      }

      setState({
        sandboxId: data.sandboxId,
        previewUrl: data.previewUrl,
        status: data.status === "running" ? "running" : "starting",
        uptime: 0,
        error: null,
        files: data.files ?? [],
      });
      log(`Sandbox created: ${data.sandboxId}`);
      log(`Preview URL: ${data.previewUrl}`);
      log(`Status: ${data.status}`);
      log(`Files written: ${(data.files ?? []).join(", ")}`);
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : "Network error" }));
      log(`Network error: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }, [log]);

  const stop = useCallback(async () => {
    setState((s) => ({ ...s, status: "stopping" }));
    log("Stopping sandbox...");

    try {
      await fetch("/api/sandbox/demo", { method: "DELETE" });
      setState({ sandboxId: null, previewUrl: null, status: "stopped", uptime: 0, error: null, files: [] });
      log("Sandbox stopped.");
    } catch (err) {
      log(`Stop error: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }, [log]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/sandbox/demo");
      const data = await res.json();
      setState((s) => ({
        ...s,
        sandboxId: data.sandboxId,
        previewUrl: data.previewUrl,
        status: data.status ?? "stopped",
        uptime: data.uptime ?? 0,
      }));
    } catch { /* silent */ }
  }, []);

  const statusConfig = STATUS_CONFIG[state.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold mb-1">Sandbox Demo</h1>
        <p className="text-muted-foreground text-sm">
          Test the Vercel Sandbox with a pre-made React + Vite app. Start, preview, stop, and restart.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Sandbox Controls
            </CardTitle>
            <div className="flex items-center gap-2">
              <StatusIcon className={cn("h-4 w-4", statusConfig.color, state.status === "starting" || state.status === "stopping" ? "animate-spin" : "")} />
              <Badge variant="outline" className={statusConfig.color}>
                {statusConfig.label}
              </Badge>
              {state.uptime > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {state.uptime}s
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button
              onClick={start}
              disabled={state.status === "starting" || state.status === "stopping"}
              className="gap-2"
            >
              {state.status === "starting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : state.status === "running" ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {state.status === "running" ? "Restart" : state.status === "starting" ? "Starting..." : "Start Sandbox"}
            </Button>

            <Button
              onClick={stop}
              variant="outline"
              disabled={state.status === "stopped" || state.status === "stopping"}
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>

            <Button onClick={refresh} variant="ghost" size="sm" className="gap-1.5 text-xs">
              <RotateCcw className="h-3 w-3" />
              Refresh Status
            </Button>

            {state.previewUrl && (
              <Button asChild variant="outline" className="gap-2 ml-auto">
                <a href={state.previewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open Preview
                </a>
              </Button>
            )}
          </div>

          {state.error && (
            <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {state.sandboxId && (
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>ID: <code className="font-mono">{state.sandboxId}</code></span>
              {state.files.length > 0 && (
                <span>Files: {state.files.join(", ")}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview iframe */}
      {state.previewUrl && state.status === "running" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Live Preview</CardTitle>
              <a
                href={state.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {state.previewUrl} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t rounded-b-lg overflow-hidden">
              <iframe
                src={state.previewUrl}
                className="w-full h-[500px]"
                title="Sandbox Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Logs</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLogs([])}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted/30 border p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
            {logs.length === 0 ? (
              <span className="text-muted-foreground">Click "Start Sandbox" to begin...</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="text-muted-foreground">{line}</div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="rounded-lg border bg-card p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground text-sm">How this demo works</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Start</strong> — Creates a Vercel Sandbox microVM, writes 5 pre-made React files, runs `npm install`, starts `vite dev`</li>
          <li><strong>Preview</strong> — The iframe shows the live Vite dev server running inside the sandbox</li>
          <li><strong>Stop</strong> — Terminates the microVM and frees resources</li>
          <li><strong>Restart</strong> — Stops the old sandbox and creates a fresh one</li>
          <li><strong>Timeout</strong> — Sandbox auto-terminates after 10 minutes</li>
        </ul>
        <p>Stack: React 19 + Vite 6 on Node 24 runtime. Uses <code>@vercel/sandbox@1.9.0</code>.</p>
      </div>
    </div>
  );
}
