export const metadata = { title: "AI Costs" };

import { CostsDashboard } from "./_components/costs-dashboard";

export default function CostsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">AI Costs</h1>
        <p className="text-muted-foreground text-sm">
          Gateway spend, token usage, and cost breakdowns by model and user.
        </p>
      </div>
      <CostsDashboard />
    </div>
  );
}
