"use client";

import { useState, useEffect, useCallback } from "react";
import { CreditCard, Loader2, Package, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CREDIT_PACKAGES = [
  { id: "credits_100", credits: 100, price: "$9.99", label: "100 credits" },
  { id: "credits_500", credits: 500, price: "$39.99", label: "500 credits" },
  {
    id: "credits_2000",
    credits: 2000,
    price: "$129.99",
    label: "2,000 credits",
  },
];

interface BillingData {
  credits: number;
  hasStripeCustomer: boolean;
  orgId: string;
}

export function BillingSettings({ isOwnerOrAdmin }: { isOwnerOrAdmin: boolean }) {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    const res = await fetch("/api/billing/credits");
    if (res.ok) {
      setBilling(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  async function handlePurchase(packageId: string) {
    setPurchasing(packageId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });

      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="billing-settings">
      {/* Credit Balance */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Coins className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Credit Balance</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">
            {billing?.credits?.toLocaleString() ?? 0}
          </span>
          <span className="text-muted-foreground text-sm">credits remaining</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Credits are used for AI operations: chat queries, extraction, embeddings, and inbox generation.
        </p>
      </Card>

      {/* Purchase Credits */}
      {isOwnerOrAdmin && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Purchase Credits</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <Card
                key={pkg.id}
                className="p-5 flex flex-col items-center text-center"
              >
                <Badge variant="secondary" className="mb-3">
                  {pkg.label}
                </Badge>
                <p className="text-2xl font-bold mb-1">{pkg.price}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {(
                    (parseFloat(pkg.price.replace("$", "")) / pkg.credits) *
                    100
                  ).toFixed(1)}
                  &cent; per credit
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={purchasing !== null}
                  onClick={() => handlePurchase(pkg.id)}
                >
                  {purchasing === pkg.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Buy
                    </>
                  )}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isOwnerOrAdmin && (
        <p className="text-sm text-muted-foreground">
          Contact your organization owner to purchase additional credits.
        </p>
      )}
    </div>
  );
}
