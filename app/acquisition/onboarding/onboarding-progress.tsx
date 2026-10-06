"use client";

interface OnboardingProgressProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { number: 1, label: "Your business" },
  { number: 2, label: "Ideal customer" },
  { number: 3, label: "Confirm & start" },
];

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div className="mb-8 max-w-2xl mx-auto" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={3}>
      <div className="flex items-center gap-4">
        {STEPS.map((step, index) => {
          const isComplete = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          
          return (
            <>
              <div className="flex flex-col items-center flex-1 relative">
                {/* Progress line */}
                {index < STEPS.length - 1 && (
                  <div className="absolute top-3 left-1/2 w-full h-1 -translate-x-1/2 -translate-y-1/2 z-0">
                    <div className={`h-full rounded-full transition-colors ${
                      isComplete || isCurrent ? "bg-accent" : "bg-line"
                    }`} />
                  </div>
                )}
                
                {/* Step circle */}
                <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                  isComplete ? "bg-accent border-accent text-white" :
                  isCurrent ? "bg-white border-accent text-accent" :
                  "bg-white border-line text-muted"
                }`}>
                  {isComplete ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className={`font-mono text-[10px] font-bold ${isCurrent ? "text-accent" : "text-muted"}`}>
                      {step.number}
                    </span>
                  )}
                </div>
                
                {/* Step label */}
                <p className={`mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] ${
                  isComplete || isCurrent ? "text-navy" : "text-muted"
                }`}>
                  {step.label}
                </p>
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}