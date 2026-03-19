"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Loader2,
  Package,
  Coins,
  Crown,
  CalendarDays,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

const PLAN_DISPLAY = {
  free: { label: "Free", variant: "secondary" as const, color: "text-muted-foreground" },
  starter: { label: "Starter", variant: "default" as const, color: "text-blue-600" },
  pro: { label: "Pro", variant: "default" as const, color: "text-purple-600" },
};

interface BillingData {
  credits: number;
  hasStripeCustomer: boolean;
  orgId: string;
}

interface SubscriptionData {
  plan: "free" | "starter" | "pro";
  status: string;
  credits_per_month: number;
  credits_remaining: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export function BillingSettings({ isOwnerOrAdmin }: { isOwnerOrAdmin: boolean }) {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [billingRes, subRes] = await Promise.all([
      fetch("/api/billing/credits"),
      fetch("/api/billing/subscription"),
    ]);

    if (billingRes.ok) setBilling(await billingRes.json());
    if (subRes.ok) setSubscription(await subRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  async function handleUpgrade(plan: "starter" | "pro") {
    setUpgrading(plan);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } finally {
      setUpgrading(null);
    }
  }

  async function handleCancel() {
    setCanceling(true);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchData();
      }
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plan = subscription?.plan ?? "free";
  const planDisplay = PLAN_DISPLAY[plan];

  return (
    <div className="space-y-8" data-testid="billing-settings">
      {/* Current Plan */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Current Plan</h3>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <Badge variant={planDisplay.variant} className="text-sm px-3 py-1">
            {planDisplay.label}
          </Badge>
          {subscription?.cancel_at_period_end && (
            <Badge variant="destructive" className="text-xs">
              Cancels at period end
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {subscription?.credits_per_month.toLocaleString() ?? 50} credits per month
        </p>

        {subscription?.current_period_end && (
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>
              Next billing date:{" "}
              {new Date(subscription.current_period_end).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Upgrade / Cancel actions */}
        {isOwnerOrAdmin && (
          <div className="flex gap-3 mt-4">
            {plan === "free" && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleUpgrade("starter")}
                  disabled={upgrading !== null}
                >
                  {upgrading === "starter" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Upgrade to Starter"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpgrade("pro")}
                  disabled={upgrading !== null}
                >
                  {upgrading === "pro" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Upgrade to Pro"
                  )}
                </Button>
              </>
            )}
            {plan === "starter" && (
              <Button
                size="sm"
                onClick={() => handleUpgrade("pro")}
                disabled={upgrading !== null}
              >
                {upgrading === "pro" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Upgrade to Pro"
                )}
              </Button>
            )}
            {plan !== "free" && !subscription?.cancel_at_period_end && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={canceling}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your subscription will remain active until the end of the
                      current billing period. After that, your plan will revert
                      to Free ({PLAN_DISPLAY.free.label}) with 50 credits per month.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel}>
                      {canceling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Confirm Cancellation"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </Card>

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
          <span className="text-muted-foreground text-sm">
            / {subscription?.credits_per_month.toLocaleString() ?? 50} monthly
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Credits are used for AI operations: chat queries, extraction,
          embeddings, and inbox generation.
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
          Contact your organization owner to manage your subscription or
          purchase additional credits.
        </p>
      )}
    </div>
  );
}
