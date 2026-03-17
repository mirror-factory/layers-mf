"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          An unexpected error occurred. Please try again, or contact support if
          the problem persists.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <pre className="mt-4 max-w-lg overflow-x-auto rounded-md bg-muted p-3 text-left text-xs">
            {error.message}
          </pre>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default" size="sm">
          Try again
        </Button>
        <Button
          onClick={() => (window.location.href = "/")}
          variant="outline"
          size="sm"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
