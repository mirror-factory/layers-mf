"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ExperiencePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params.token) {
      router.replace(`/portal/${params.token}`);
    }
  }, [params.token, router]);

  return null;
}
