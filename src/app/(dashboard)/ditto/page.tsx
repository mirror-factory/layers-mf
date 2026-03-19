export const metadata = { title: "Ditto" };

import { DittoProfileView } from "@/components/ditto-profile";

export default function DittoPage() {
  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Ditto</h1>
        <p className="text-muted-foreground text-sm">
          Your AI-learned profile. Ditto learns how you work and personalizes your experience.
        </p>
      </div>
      <DittoProfileView />
    </div>
  );
}
