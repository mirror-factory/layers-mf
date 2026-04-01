import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/landing-page";
import MarketingLayout from "@/components/marketing-layout";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  return (
    <MarketingLayout>
      <LandingPage />
    </MarketingLayout>
  );
}
