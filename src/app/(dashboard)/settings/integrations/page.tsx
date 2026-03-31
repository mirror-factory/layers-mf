"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  MessageSquare,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChatSdkExplainer } from "@/components/chat-sdk-explainer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionStatus = "connected" | "disconnected" | "testing";

interface PlatformState {
  status: ConnectionStatus;
  error?: string;
  success?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/10">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    );
  }
  if (status === "testing") {
    return (
      <Badge variant="secondary">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Testing...
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <XCircle className="h-3 w-3 mr-1" />
      Not connected
    </Badge>
  );
}

function StepItem({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
        {number}
      </span>
      <div className="text-sm text-muted-foreground pt-0.5">{children}</div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      <Copy className="h-3 w-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function PasswordField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border bg-background px-3 py-2 pr-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discord Section
// ---------------------------------------------------------------------------

function DiscordSection() {
  const [state, setState] = useState<PlatformState>({ status: "disconnected" });
  const [botToken, setBotToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [channelId, setChannelId] = useState("");

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/discord/interactions`
    : "/api/discord/interactions";

  const handleTest = async () => {
    if (!botToken.trim()) {
      setState({ status: "disconnected", error: "Bot token is required" });
      return;
    }
    setState({ status: "testing" });
    try {
      const res = await fetch("/api/chat-sdk/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test",
          platform: "discord",
          config: { botToken, publicKey, applicationId, channelId },
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState({ status: "connected", success: "Connection verified" });
      } else {
        setState({ status: "disconnected", error: data.error || "Connection failed" });
      }
    } catch (err) {
      setState({
        status: "disconnected",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Discord Bot</h3>
          <p className="text-sm text-muted-foreground">
            Use Granger directly in your Discord server
          </p>
        </div>
        <StatusBadge status={state.status} />
      </div>

      {/* Setup guide */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Setup Guide
        </p>
        <div className="space-y-3">
          <StepItem number={1}>
            Go to the{" "}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Discord Developer Portal
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            and create a new application
          </StepItem>
          <StepItem number={2}>
            Under <strong>Bot</strong>, create a bot and copy the token
          </StepItem>
          <StepItem number={3}>
            Under <strong>General Information</strong>, copy the Application ID and Public Key
          </StepItem>
          <StepItem number={4}>
            <span>
              Set the <strong>Interactions Endpoint URL</strong> to:
            </span>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs font-mono break-all">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} />
            </div>
          </StepItem>
          <StepItem number={5}>
            Under <strong>OAuth2 &gt; URL Generator</strong>, select scopes{" "}
            <code className="bg-muted px-1 rounded text-xs">bot</code> and{" "}
            <code className="bg-muted px-1 rounded text-xs">applications.commands</code>,
            then invite the bot to your server
          </StepItem>
        </div>
      </div>

      {/* Config fields */}
      <div className="rounded-lg border p-4 space-y-4">
        <p className="text-sm font-medium">Configuration</p>

        <div className="grid gap-3">
          <div>
            <label htmlFor="discord-app-id" className="text-xs font-medium text-muted-foreground block mb-1">
              Application ID
            </label>
            <input
              id="discord-app-id"
              type="text"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              placeholder="e.g. 123456789012345678"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="discord-public-key" className="text-xs font-medium text-muted-foreground block mb-1">
              Public Key
            </label>
            <input
              id="discord-public-key"
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="Hex string from General Information"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="discord-bot-token" className="text-xs font-medium text-muted-foreground block mb-1">
              Bot Token
            </label>
            <PasswordField
              id="discord-bot-token"
              value={botToken}
              onChange={setBotToken}
              placeholder="Bot token from the Bot section"
            />
          </div>

          <div>
            <label htmlFor="discord-channel" className="text-xs font-medium text-muted-foreground block mb-1">
              Default Channel ID <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="discord-channel"
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Right-click channel > Copy Channel ID"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {state.error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{state.error}</p>
          </div>
        )}

        {state.success && (
          <div className="flex items-start gap-2 rounded-md bg-green-500/10 border border-green-500/20 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400">{state.success}</p>
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={state.status === "testing" || !botToken.trim()}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.status === "testing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Test Connection
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slack Section
// ---------------------------------------------------------------------------

function SlackSection() {
  const [state, setState] = useState<PlatformState>({ status: "disconnected" });
  const [botToken, setBotToken] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [channelId, setChannelId] = useState("");

  const eventUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/chat-sdk/webhook`
    : "/api/chat-sdk/webhook";

  const handleTest = async () => {
    if (!botToken.trim()) {
      setState({ status: "disconnected", error: "Bot token is required" });
      return;
    }
    setState({ status: "testing" });
    try {
      const res = await fetch("/api/chat-sdk/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test",
          platform: "slack",
          config: { botToken, signingSecret, channelId },
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState({ status: "connected", success: "Connection verified" });
      } else {
        setState({ status: "disconnected", error: data.error || "Connection failed" });
      }
    } catch (err) {
      setState({
        status: "disconnected",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Slack App</h3>
          <p className="text-sm text-muted-foreground">
            Use Granger in your Slack workspace
          </p>
        </div>
        <StatusBadge status={state.status} />
      </div>

      {/* Setup guide */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Setup Guide
        </p>
        <div className="space-y-3">
          <StepItem number={1}>
            Go to{" "}
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Slack API: Your Apps
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            and create a new app <strong>From scratch</strong>
          </StepItem>
          <StepItem number={2}>
            Under <strong>Basic Information</strong>, copy the <strong>Signing Secret</strong>
          </StepItem>
          <StepItem number={3}>
            Under <strong>OAuth &amp; Permissions</strong>, add these Bot Token Scopes:{" "}
            <code className="bg-muted px-1 rounded text-xs">app_mentions:read</code>,{" "}
            <code className="bg-muted px-1 rounded text-xs">chat:write</code>,{" "}
            <code className="bg-muted px-1 rounded text-xs">im:history</code>,{" "}
            <code className="bg-muted px-1 rounded text-xs">im:read</code>,{" "}
            <code className="bg-muted px-1 rounded text-xs">im:write</code>
          </StepItem>
          <StepItem number={4}>
            Install the app to your workspace and copy the <strong>Bot User OAuth Token</strong>
          </StepItem>
          <StepItem number={5}>
            <span>
              Under <strong>Event Subscriptions</strong>, set the Request URL to:
            </span>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs font-mono break-all">
                {eventUrl}
              </code>
              <CopyButton text={eventUrl} />
            </div>
          </StepItem>
          <StepItem number={6}>
            Subscribe to bot events:{" "}
            <code className="bg-muted px-1 rounded text-xs">app_mention</code>,{" "}
            <code className="bg-muted px-1 rounded text-xs">message.im</code>
          </StepItem>
        </div>
      </div>

      {/* Config fields */}
      <div className="rounded-lg border p-4 space-y-4">
        <p className="text-sm font-medium">Configuration</p>

        <div className="grid gap-3">
          <div>
            <label htmlFor="slack-bot-token" className="text-xs font-medium text-muted-foreground block mb-1">
              Bot User OAuth Token
            </label>
            <PasswordField
              id="slack-bot-token"
              value={botToken}
              onChange={setBotToken}
              placeholder="xoxb-..."
            />
          </div>

          <div>
            <label htmlFor="slack-signing" className="text-xs font-medium text-muted-foreground block mb-1">
              Signing Secret
            </label>
            <PasswordField
              id="slack-signing"
              value={signingSecret}
              onChange={setSigningSecret}
              placeholder="From Basic Information"
            />
          </div>

          <div>
            <label htmlFor="slack-channel" className="text-xs font-medium text-muted-foreground block mb-1">
              Default Channel ID <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="slack-channel"
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="e.g. C0123456789"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {state.error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{state.error}</p>
          </div>
        )}

        {state.success && (
          <div className="flex items-start gap-2 rounded-md bg-green-500/10 border border-green-500/20 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400">{state.success}</p>
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={state.status === "testing" || !botToken.trim()}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.status === "testing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Test Connection
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Webhook Section
// ---------------------------------------------------------------------------

function WebhookSection() {
  const [state, setState] = useState<PlatformState>({ status: "disconnected" });
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const inboundUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/chat-sdk/webhook`
    : "/api/chat-sdk/webhook";

  const handleTest = async () => {
    if (!webhookSecret.trim()) {
      setState({ status: "disconnected", error: "Webhook secret is required" });
      return;
    }
    setState({ status: "testing" });
    try {
      const res = await fetch("/api/chat-sdk/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": webhookSecret,
        },
        body: JSON.stringify({
          type: "test",
          platform: "webhook",
          config: { webhookUrl, webhookSecret },
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState({ status: "connected", success: "Webhook endpoint reachable" });
      } else {
        setState({ status: "disconnected", error: data.error || "Connection failed" });
      }
    } catch (err) {
      setState({
        status: "disconnected",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Custom Webhook</h3>
          <p className="text-sm text-muted-foreground">
            Connect any platform via webhook
          </p>
        </div>
        <StatusBadge status={state.status} />
      </div>

      {/* Setup guide */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Setup Guide
        </p>
        <div className="space-y-3">
          <StepItem number={1}>
            Generate a webhook secret (any random string) and save it below
          </StepItem>
          <StepItem number={2}>
            <span>
              Configure your platform to POST messages to:
            </span>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs font-mono break-all">
                {inboundUrl}
              </code>
              <CopyButton text={inboundUrl} />
            </div>
          </StepItem>
          <StepItem number={3}>
            Include the header{" "}
            <code className="bg-muted px-1 rounded text-xs">X-Webhook-Secret: your-secret</code>{" "}
            with every request
          </StepItem>
          <StepItem number={4}>
            Send a JSON body with{" "}
            <code className="bg-muted px-1 rounded text-xs">
              {`{ "message": "your text", "userId": "optional-id" }`}
            </code>
          </StepItem>
          <StepItem number={5}>
            Optionally set a callback URL below to receive responses asynchronously
          </StepItem>
        </div>
      </div>

      {/* Config fields */}
      <div className="rounded-lg border p-4 space-y-4">
        <p className="text-sm font-medium">Configuration</p>

        <div className="grid gap-3">
          <div>
            <label htmlFor="webhook-secret" className="text-xs font-medium text-muted-foreground block mb-1">
              Webhook Secret
            </label>
            <PasswordField
              id="webhook-secret"
              value={webhookSecret}
              onChange={setWebhookSecret}
              placeholder="A shared secret for authenticating requests"
            />
          </div>

          <div>
            <label htmlFor="webhook-callback" className="text-xs font-medium text-muted-foreground block mb-1">
              Callback URL <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="webhook-callback"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-app.com/granger-response"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {state.error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{state.error}</p>
          </div>
        )}

        {state.success && (
          <div className="flex items-start gap-2 rounded-md bg-green-500/10 border border-green-500/20 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400">{state.success}</p>
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={state.status === "testing" || !webhookSecret.trim()}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.status === "testing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Test Connection
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function IntegrationsSettingsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold">
            Chat SDK Integrations
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Connect Granger to external platforms so your team can use the full AI
          experience from Discord, Slack, or any webhook-compatible tool.
        </p>
      </div>

      {/* Explainer */}
      <div className="mb-8">
        <ChatSdkExplainer />
      </div>

      {/* Platform tabs */}
      <Tabs defaultValue="discord">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="discord">Discord</TabsTrigger>
          <TabsTrigger value="slack">Slack</TabsTrigger>
          <TabsTrigger value="webhook">Custom Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="discord" className="mt-6">
          <DiscordSection />
        </TabsContent>

        <TabsContent value="slack" className="mt-6">
          <SlackSection />
        </TabsContent>

        <TabsContent value="webhook" className="mt-6">
          <WebhookSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
