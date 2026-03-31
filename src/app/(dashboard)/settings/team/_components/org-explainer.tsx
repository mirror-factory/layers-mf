"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrgExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 rounded-lg border bg-card">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
      >
        <span>How Your Organization Works</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground space-y-3 border-t pt-3">
          <div>
            <h4 className="font-medium text-foreground mb-1">Organization Structure</h4>
            <p>
              One owner creates the organization and invites members. All team members
              share a single workspace with shared context, conversations, and skills.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Roles</h4>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>Owner</strong> &mdash; Full control: billing, integrations, member management, and all settings</li>
              <li><strong>Admin</strong> &mdash; Manage members and org settings, but cannot change billing or transfer ownership</li>
              <li><strong>Member</strong> &mdash; Use all tools, view shared content, and contribute to the org</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Data Scoping</h4>
            <p>
              All context items, conversations, and skills are scoped to the organization.
              When you sync an integration (Google Drive, GitHub, Slack, etc.), the data
              belongs to the org, not to individual users.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Sharing</h4>
            <p>
              Everything in the organization is shared by default among all members.
              Context items, skills, and shared conversations are visible to the entire team.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Permissions</h4>
            <p>
              Per-service permissions (e.g., Linear read/write, Gmail read/write) are
              configured at the org level and apply to all members equally.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Coming Soon</h4>
            <p>
              Per-member file visibility, chat tagging, and direct messaging between
              team members are on the roadmap.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
