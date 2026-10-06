"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { OnboardingProgress } from "../onboarding-progress";

const companySizes = [
  { id: "1-10", label: "1-10 employees", description: "Startups, small teams" },
  { id: "11-50", label: "11-50 employees", description: "Growing companies" },
  { id: "51-200", label: "51-200 employees", description: "Mid-market" },
  { id: "201-500", label: "201-500 employees", description: "Established mid-market" },
  { id: "501-1000", label: "501-1000 employees", description: "Large companies" },
  { id: "1000+", label: "1000+ employees", description: "Enterprise" },
];

const roles = [
  "CEO / Founder",
  "CTO / VP Engineering",
  "VP Marketing / CMO",
  "VP Sales / CRO",
  "Head of Product",
  "Head of Operations",
  "VP Finance / CFO",
  "HR / People Ops",
];

interface IndustryOption {
  label: string;
  description?: string;
}

const industries: IndustryOption[] = [
  { label: "Technology / Software" },
  { label: "Financial Services" },
  { label: "Healthcare / Life Sciences" },
  { label: "Manufacturing / Industrial" },
  { label: "Retail / E-commerce", description: "Online and physical retail" },
  { label: "Professional Services" },
  { label: "Media / Entertainment" },
  { label: "Education" },
  { label: "Real Estate / Construction" },
  { label: "Other" },
];

export default function OnboardingStep2() {
  const router = useRouter();
  const [companySize, setCompanySize] = useState<string>("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [locations, setLocations] = useState<string>("");
  const [painPoints, setPainPoints] = useState<string>("");
  const [pending, setPending] = useState(false);

  const toggleRole = (role: string) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleIndustry = (industry: IndustryOption) => {
    const industryLabel = industry.label;
    setTargetIndustries((prev) =>
      prev.includes(industryLabel) ? prev.filter((i) => i !== industryLabel) : [...prev, industryLabel]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);

    if (!companySize || targetRoles.length === 0) {
      setPending(false);
      return;
    }

    localStorage.setItem("onboarding_companySize", companySize);
    localStorage.setItem("onboarding_targetRoles", JSON.stringify(targetRoles));
    localStorage.setItem("onboarding_targetIndustries", JSON.stringify(targetIndustries));
    localStorage.setItem("onboarding_locations", locations);
    localStorage.setItem("onboarding_painPoints", painPoints);

    router.push("/acquisition/onboarding/step3");
  };

  return (
    <Container className="py-12 sm:py-20">
      <OnboardingProgress currentStep={2} />
      
      <Reveal className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          Who is your ideal customer?
        </h1>
        <p className="mt-4 text-lg leading-[1.6] text-body">
          Help us find the right people at the right companies.
        </p>
      </Reveal>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
        <Reveal delay={0.05}>
          <label className="block text-sm font-medium text-navy mb-3">Company size</label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companySizes.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => setCompanySize(size.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  companySize === size.id
                    ? "border-accent bg-accent/5 text-navy"
                    : "border-line bg-white hover:border-accent hover:bg-white"
                }`}
              >
                <p className="font-medium text-navy">{size.label}</p>
                <p className="mt-1 text-sm text-muted">{size.description}</p>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <label className="block text-sm font-medium text-navy mb-3">Decision makers (select all that apply)</label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  targetRoles.includes(role)
                    ? "border-accent bg-accent/5 text-navy"
                    : "border-line bg-white hover:border-accent hover:bg-white"
                }`}
              >
                <p className="font-medium text-navy text-sm">{role}</p>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <label className="block text-sm font-medium text-navy mb-3">Industries (select all that apply)</label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map((industry) => (
                <button
                  key={industry.label}
                  type="button"
                  onClick={() => toggleIndustry(industry)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    targetIndustries.includes(industry.label)
                      ? "border-accent bg-accent/5 text-navy"
                      : "border-line bg-white hover:border-accent hover:bg-white"
                  }`}
                >
                  <p className="font-medium text-navy text-sm">{industry.label}</p>
                  {industry.description && <p className="mt-1 text-xs text-muted">{industry.description}</p>}
                </button>
              ))}
          </div>
        </Reveal>

        <Reveal delay={0.2} className="space-y-4">
          <div>
            <label htmlFor="locations" className="block text-sm font-medium text-navy mb-2">
              Locations (e.g., "US, UK, Canada" or "North America")
            </label>
            <input
              id="locations"
              type="text"
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              placeholder="US, UK, Canada"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>
          <div>
            <label htmlFor="painPoints" className="block text-sm font-medium text-navy mb-2">
              What problem do you solve for them? (optional)
            </label>
            <textarea
              id="painPoints"
              value={painPoints}
              onChange={(e) => setPainPoints(e.target.value)}
              rows={3}
              placeholder="e.g., They waste hours manually reconciling payments..."
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>
        </Reveal>

        <Reveal delay={0.25}>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="secondary" onClick={() => router.back()} className="w-full sm:w-auto">
              Back
            </Button>
            <Button type="submit" disabled={pending || !companySize || targetRoles.length === 0} className="w-full sm:w-auto flex-1" size="lg">
              {pending ? "Starting search…" : "Find customers"}
            </Button>
          </div>
        </Reveal>
      </form>
    </Container>
  );
}