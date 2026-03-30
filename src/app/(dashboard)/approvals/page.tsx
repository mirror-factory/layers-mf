import { ApprovalQueue } from "@/components/approval-queue";

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
    </div>
  );
}
