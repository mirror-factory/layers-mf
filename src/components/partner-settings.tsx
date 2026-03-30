"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Credential {
  provider: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  settings: {
    discord_user_id?: string | null;
    ai_gateway_key_encrypted?: string | null;
    default_model?: string | null;
  } | null;
  credentials: Credential[];
}

const INTEGRATIONS = [
  {
    provider: "granola",
    label: "Granola",
    description: "Meeting transcripts and notes",
    placeholder: "grn_your_api_key",
  },
  {
    provider: "linear",
    label: "Linear",
    description: "Issues, projects, and cycles",
    placeholder: "lin_your_api_key",
  },
  {
    provider: "notion",
    label: "Notion",
    description: "Pages and databases",
    placeholder: "secret_your_integration_token",
  },
] as const;

export function PartnerSettings({ settings, credentials }: Props) {
  const [discordId, setDiscordId] = useState(
    settings?.discord_user_id ?? "",
  );
  const [gatewayKey, setGatewayKey] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const isConnected = (provider: string) =>
    credentials.some((c) => c.provider === provider);

  const credentialInfo = (provider: string) =>
    credentials.find((c) => c.provider === provider);

  async function saveDiscordId() {
    setSaving("discord");
    try {
      const res = await fetch("/api/settings/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_user_id: discordId }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Discord ID saved");
    } catch {
      toast.error("Failed to save Discord ID");
    } finally {
      setSaving(null);
    }
  }

  async function saveGatewayKey() {
    setSaving("gateway");
    try {
      const res = await fetch("/api/settings/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_gateway_key: gatewayKey }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Gateway key saved");
      setGatewayKey("");
    } catch {
      toast.error("Failed to save gateway key");
    } finally {
      setSaving(null);
    }
  }

  async function saveCredential(provider: string, token: string) {
    setSaving(provider);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(`${provider} connected`);
      window.location.reload();
    } catch {
      toast.error(`Failed to connect ${provider}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Discord */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Discord</CardTitle>
          <CardDescription>
            Link your Discord account for DMs and digest mentions
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="Your Discord User ID (e.g., 123456789012345678)"
          />
          <Button
            onClick={saveDiscordId}
            disabled={saving === "discord"}
          >
            {saving === "discord" ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      {/* AI Gateway Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Gateway Key</CardTitle>
          <CardDescription>
            Optional personal key. Falls back to shared team key if not set.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            type="password"
            value={gatewayKey}
            onChange={(e) => setGatewayKey(e.target.value)}
            placeholder={
              settings?.ai_gateway_key_encrypted
                ? "••••••••• (key set)"
                : "vck_your_key"
            }
          />
          <Button
            onClick={saveGatewayKey}
            disabled={saving === "gateway" || !gatewayKey}
          >
            {saving === "gateway" ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      {/* API Key Integrations */}
      {INTEGRATIONS.map((integration) => (
        <IntegrationCard
          key={integration.provider}
          provider={integration.provider}
          label={integration.label}
          description={integration.description}
          placeholder={integration.placeholder}
          connected={isConnected(integration.provider)}
          credential={credentialInfo(integration.provider)}
          saving={saving === integration.provider}
          onSave={(token) => saveCredential(integration.provider, token)}
        />
      ))}

      {/* Google (Gmail + Drive) — OAuth */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Gmail & Google Drive</CardTitle>
              <CardDescription>
                Read emails and documents via Google OAuth
              </CardDescription>
            </div>
            {isConnected("gmail") ? (
              <Badge variant="default" className="bg-green-600">
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">Not connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isConnected("gmail") && credentialInfo("gmail")?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Last updated{" "}
              {new Date(
                credentialInfo("gmail")!.updated_at,
              ).toLocaleDateString()}
            </p>
          )}
          <Button asChild>
            <a href="/api/auth/google/start">
              {isConnected("gmail")
                ? "Reconnect Google"
                : "Connect Google Account"}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationCard({
  provider,
  label,
  description,
  placeholder,
  connected,
  credential,
  saving,
  onSave,
}: {
  provider: string;
  label: string;
  description: string;
  placeholder: string;
  connected: boolean;
  credential: Credential | undefined;
  saving: boolean;
  onSave: (token: string) => void;
}) {
  const [token, setToken] = useState("");

  function handleSave() {
    onSave(token);
    setToken("");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{label}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {connected ? (
            <Badge variant="default" className="bg-green-600">
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {connected && credential?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Last updated{" "}
            {new Date(credential.updated_at).toLocaleDateString()}
          </p>
        )}
        <div className="flex gap-2">
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={connected ? "••••••••• (key set)" : placeholder}
          />
          <Button
            onClick={handleSave}
            disabled={saving || !token}
          >
            {saving ? "Saving..." : connected ? "Update" : "Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
