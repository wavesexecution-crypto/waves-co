"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { CheckCircle2, Search, Sparkles } from "lucide-react";

interface OnboardingData {
  businessType: string;
  companyName: string;
  website: string;
  companySize: string;
  targetRoles: string[];
  targetIndustries: string[];
  locations: string;
  painPoints: string;
}

export default function OnboardingStep3() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const businessType = localStorage.getItem("onboarding_businessType");
    const companyName = localStorage.getItem("onboarding_companyName");
    const website = localStorage.getItem("onboarding_website");
    const companySize = localStorage.getItem("onboarding_companySize");
    const targetRoles = localStorage.getItem("onboarding_targetRoles");
    const targetIndustries = localStorage.getItem("onboarding_targetIndustries");
    const locations = localStorage.getItem("onboarding_locations");
    const painPoints = localStorage.getItem("onboarding_painPoints");

    if (!businessType || !companyName || !companySize || !targetRoles) {
      router.push("/acquisition/onboarding/step1");
      return;
    }

    setData({
      businessType,
      companyName,
      website: website || "",
      companySize,
      targetRoles: JSON.parse(targetRoles),
      targetIndustries: JSON.parse(targetIndustries || "[]"),
      locations: locations || "",
      painPoints: painPoints || "",
    });
  }, [router]);

  const clearLocal = () => {
    for (const k of [
      "onboarding_businessType", "onboarding_companyName", "onboarding_website",
      "onboarding_companySize", "onboarding_targetRoles", "onboarding_targetIndustries",
      "onboarding_locations", "onboarding_painPoints",
    ]) localStorage.removeItem(k);
  };

  const handleStartSearch = async () => {
    if (!data || starting) return;
    setStarting(true);
    setError(null);
    try {
      // 1) Start the 2-day proof (409 = already used/active → continue anyway).
      setProgress(10);
      const trial = await fetch("/api/billing/trial/start", { method: "POST" });
      if (!trial.ok && trial.status !== 409) {
        const j = await trial.json().catch(() => ({}));
        if (trial.status === 401) {
          router.push("/login?callbackUrl=/acquisition/onboarding/step3");
          return;
        }
        throw new Error((j as any)?.error ?? "Could not start your 2-day proof.");
      }

      // 2) Persist the business context (upsert — safe to retry).
      setProgress(55);
      const res = await fetch("/api/acquisition/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.companyName,
          website: data.website || undefined,
          industry: data.businessType,
          icp: {
            companySize: data.companySize || undefined,
            roles: data.targetRoles,
            industries: data.targetIndustries,
            locations: data.locations || undefined,
            painPoints: data.painPoints || undefined,
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const first = Array.isArray((j as any)?.issues) && (j as any).issues.length > 0
          ? String((j as any).issues[0].message)
          : "Could not save your business context.";
        throw new Error(res.status === 401 ? "Please sign in to continue." : first);
      }

      // 3) Done — server holds the state now; local copy can go.
      setProgress(100);
      clearLocal();
      router.push("/acquisition/leads");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please retry.");
      setStarting(false);
    }
  };

  if (!data) {
    return (
      <Container className="py-12 sm:py-20">
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
        </div>
      </Container>
    );
  }

  const formatRoles = (roles: string[]) => {
    if (roles.length <= 3) return roles.join(", ");
    return `${roles.slice(0, 3).join(", ")} +${roles.length - 3} more`;
  };

  const formatIndustries = (industries: string[]) => {
    if (industries.length === 0) return "Any industry";
    if (industries.length <= 3) return industries.join(", ");
    return `${industries.slice(0, 3).join(", ")} +${industries.length - 3} more`;
  };

  return (
    <Container className="py-12 sm:py-20">
      <Reveal className="max-w-2xl mx-auto text-center mb-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
          <Sparkles size={32} className="text-accent" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Step 3 of 3</p>
        <h1 className="mt-4 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          Ready to find customers
        </h1>
        <p className="mt-4 text-lg leading-[1.6] text-body">
          We&apos;ll search for companies matching your criteria and score them against your ideal customer profile.
        </p>
      </Reveal>

      <Reveal delay={0.05} className="max-w-2xl mx-auto space-y-6 mb-10">
        <SummaryCard label="Business" value={`${data.companyName} (${data.businessType})`} icon={<BuildingIcon />} />
        <SummaryCard label="Target size" value={data.companySize} icon={<UsersIcon />} />
        <SummaryCard label="Decision makers" value={formatRoles(data.targetRoles)} icon={<BriefcaseIcon />} />
        <SummaryCard label="Industries" value={formatIndustries(data.targetIndustries)} icon={<FactoryIcon />} />
        {data.locations && (
          <SummaryCard label="Locations" value={data.locations} icon={<GlobeIcon />} />
        )}
        {data.painPoints && (
          <SummaryCard label="Problem you solve" value={data.painPoints} icon={<LightbulbIcon />} />
        )}
      </Reveal>

      <Reveal delay={0.1}>
        {starting ? (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-lg border border-line bg-white p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <Search size={24} className="text-accent animate-spin" />
              </div>
              <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
                Searching for customers…
              </h3>
              <p className="mt-2 text-sm text-body">
                This usually takes 1-2 minutes. We&apos;ll find and score companies that match your ideal customer.
              </p>
              <div className="mt-6 h-2 bg-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 font-mono text-sm text-muted">{progress}%</p>
              {error && (
                <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className="mb-4 text-center text-sm text-red-600">{error}</p>
            )}
          <Button onClick={handleStartSearch} className="w-full" size="lg">
            <CheckCircle2 size={18} className="mr-2" />
            Start finding customers
          </Button>
          </>
        )}
      </Reveal>

      <Reveal delay={0.15} className="mt-8 max-w-2xl mx-auto text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Your 2-day proof starts now. No charge.
        </p>
      </Reveal>
    </Container>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 text-muted">{icon}</div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
          <p className="mt-1 text-sm font-medium text-navy">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Icons
function BuildingIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect x="2" y="6" width="20" height="8" rx="1" />
    </svg>
  );
}

function FactoryIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
      <path d="M7 17v-5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2a6 6 0 0 0-6 6v2a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6z" />
      <path d="M12 14v8" />
      <path d="M8 22h8" />
    </svg>
  );
}