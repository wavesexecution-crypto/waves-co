"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingEntry() {
  const router = useRouter();

  useEffect(() => {
    router.push("/acquisition/onboarding/step1");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
    </div>
  );
}