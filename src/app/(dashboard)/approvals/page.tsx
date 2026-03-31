import { ApprovalQueue } from "@/components/approval-queue";
import { EditProposalQueue } from "@/components/edit-proposal-queue";

export default function ApprovalsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Approval Queue</h1>
        <p className="text-muted-foreground text-sm">
          Review and approve actions proposed by Granger.
        </p>
      </div>
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
