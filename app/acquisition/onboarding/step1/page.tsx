"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { OnboardingProgress } from "../onboarding-progress";

const businessTypes = [
  { id: "saas", label: "SaaS / Software", description: "Subscriptions, B2B software, developer tools" },
  { id: "agency", label: "Agency / Services", description: "Design, marketing, consulting, development" },
  { id: "ecommerce", label: "E-commerce / Products", description: "Physical goods, DTC brands, marketplaces" },
  { id: "marketplace", label: "Marketplace / Platform", description: "Two-sided platforms, job boards, directories" },
  { id: "fintech", label: "Fintech / Payments", description: "Banking, lending, payments, insurance" },
  { id: "healthtech", label: "Health / Bio", description: "Medtech, digital health, biotech, pharma" },
  { id: "edtech", label: "Education / Training", description: "Courses, bootcamps, corporate training" },
  { id: "other", label: "Other", description: "Anything else - we'll figure it out" },
];

export default function OnboardingStep1() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customType, setCustomType] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);

    const businessType = selectedType === "other" ? customType : selectedType;
    
    if (!businessType || !companyName) {
      setPending(false);
      return;
    }

    // Store in localStorage for the next step
    localStorage.setItem("onboarding_businessType", businessType);
    localStorage.setItem("onboarding_companyName", companyName);
    localStorage.setItem("onboarding_website", website);

    router.push("/acquisition/onboarding/step2");
  };

  return (
    <Container className="py-12 sm:py-20">
      <OnboardingProgress currentStep={1} />
      
      <Reveal className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          What do you sell?
        </h1>
        <p className="mt-4 text-lg leading-[1.6] text-body">
          Tell us about your business so we can find the right customers.
        </p>
      </Reveal>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <Reveal delay={0.05} className="mb-8">
          <label className="block text-sm font-medium text-navy mb-3">Business type</label>
          <div className="grid gap-3 sm:grid-cols-2">
            {businessTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setSelectedType(type.id);
                  setCustomType("");
                }}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedType === type.id
                    ? "border-accent bg-accent/5 text-navy"
                    : "border-line bg-white hover:border-accent hover:bg-white"
                }`}
              >
                <p className="font-medium text-navy">{type.label}</p>
                <p className="mt-1 text-sm text-muted">{type.description}</p>
              </button>
            ))}
          </div>
          {selectedType === "other" && (
            <div className="mt-3">
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Describe your business type"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
              />
            </div>
          )}
        </Reveal>

        <Reveal delay={0.1} className="space-y-4 mb-8">
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-navy mb-2">
              Company name
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
              required
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-navy mb-2">
              Website (optional)
            </label>
            <input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acme.com"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <Button type="submit" disabled={pending || !selectedType || !companyName} className="w-full" size="lg">
            {pending ? "Continuing…" : "Continue"}
          </Button>
        </Reveal>
      </form>
    </Container>
  );
}