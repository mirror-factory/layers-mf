"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Share2, Copy, Check, Loader2, Link2Off } from "lucide-react";

interface ShareLinkButtonProps {
  resourceType: "artifact" | "context_item" | "skill";
  resourceId: string;
  resourceTitle?: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "icon" | "default";
  className?: string;
}

export function ShareLinkButton({
  resourceType,
  resourceId,
  resourceTitle,
  variant = "outline",
  size = "sm",
  className,
}: ShareLinkButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [deactivating, setDeactivating] = useState(false);

  const createShareLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/share-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId,
          allow_public_view: isPublic,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const fullUrl = `${window.location.origin}${data.url}`;
        setShareUrl(fullUrl);
        setShareToken(data.token);
      }
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId, isPublic]);

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && !shareUrl) {
        createShareLink();
      }
    },
    [shareUrl, createShareLink],
  );

  const handleCopy = useCallback(() => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const handleDeactivate = useCallback(async () => {
    if (!shareToken) return;
    setDeactivating(true);
    try {
      await fetch("/api/share-link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: shareToken }),
      });
      setShareUrl(null);
      setShareToken(null);
      setOpen(false);
    } finally {
      setDeactivating(false);
    }
  }, [shareToken]);

  const handlePublicToggle = useCallback(
    async (checked: boolean) => {
      setIsPublic(checked);
      // If link exists, recreate with new visibility
      if (shareUrl) {
        setLoading(true);
        try {
          const res = await fetch("/api/share-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource_type: resourceType,
              resource_id: resourceId,
              allow_public_view: checked,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const fullUrl = `${window.location.origin}${data.url}`;
            setShareUrl(fullUrl);
            setShareToken(data.token);
          }
        } finally {
          setLoading(false);
        }
      }
    },
    [shareUrl, resourceType, resourceId],
  );

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
        >
          <Share2 className="h-3.5 w-3.5" />
          {size !== "icon" && <span className="ml-1.5">Share link</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 space-y-3" align="start">
        <div>
          <h4 className="text-sm font-medium mb-0.5">
            Public share link
          </h4>
          <p className="text-xs text-muted-foreground">
            {resourceTitle
              ? `Anyone with the link can view "${resourceTitle}".`
              : "Anyone with the link can view this content."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : shareUrl ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="text-xs h-8 font-mono"
                onFocus={(e) => e.target.select()}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground" htmlFor="public-toggle">
                Public (no login required)
              </label>
              <Switch
                id="public-toggle"
                checked={isPublic}
                onCheckedChange={handlePublicToggle}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-destructive hover:text-destructive gap-1.5"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Link2Off className="h-3 w-3" />
              )}
              Deactivate link
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            Failed to create share link. Try again.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
