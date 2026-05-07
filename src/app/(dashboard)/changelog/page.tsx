import type { Metadata } from "next";
import { ChangelogPage } from "@/components/changelog-page";

export const metadata: Metadata = {
  title: "Changelog -- Layers",
  description: "See what's new in Layers. Feature releases, bug fixes, and documentation updates.",
};

export default function Page() {
  return <ChangelogPage />;
}
