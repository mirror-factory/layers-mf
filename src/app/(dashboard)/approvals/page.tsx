import { ApprovalQueue } from "@/components/approval-queue";
import { EditProposalQueue } from "@/components/edit-proposal-queue";
import { PageExplainer } from "@/components/page-explainer";

export default function ApprovalsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Approval Queue</h1>
        <p className="text-muted-foreground text-sm">
          Review and approve actions proposed by Granger.
        </p>
      </div>
      <PageExplainer
        title="How Approvals Work"
        sections={[
          { title: "Why approvals exist", content: "All write actions (creating Linear issues, drafting emails, editing documents) go through the approval queue. Granger proposes, you decide." },
          { title: "How to approve", content: "Review each proposed action, then approve or reject. Approved actions are executed immediately. Rejected actions are discarded with optional feedback." },
          { title: "Edit proposals", content: "Team members can propose edits to context items. These require majority approval before changes are applied to the original document." },
        ]}
      />
      <ApprovalQueue />

      <div className="mt-12 mb-8">
        <h2 className="text-xl font-semibold mb-1">Document Edit Proposals</h2>
        <p className="text-muted-foreground text-sm">
          Review edits proposed by team members. Requires majority approval before changes are applied.
        </p>
      </div>
      <EditProposalQueue />
    </div>
  );
}
