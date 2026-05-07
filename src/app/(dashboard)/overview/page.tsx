import type { Metadata } from "next";
import { OverviewPage } from "@/components/overview-page";

export const metadata: Metadata = {
  title: "Overview — Layers",
};

export default function Page() {
  return <OverviewPage />;
}
