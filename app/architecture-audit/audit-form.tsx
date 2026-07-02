"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Lock, X } from "lucide-react";
import { Button } from "@/components/button";

declare global {
  interface CalFunction {
    (action: "init", options?: { origin?: string }): void;
    (action: "inline", options: {
      elementOrSelector: string | HTMLElement;
      calLink: string;
      config?: {
        layout?: string;
        name?: string;
        email?: string;
        [key: string]: unknown;
      };
    }): void;
    (action: "on", options: {
      action: string;
      callback: (event: any) => void;
    }): void;
    (action: "off", options: {
      action: string;
      callback: (event: any) => void;
    }): void;
    (action: "ui", options: Record<string, unknown>): void;
    q?: any[];
    loaded?: boolean;
    ns?: Record<string, any>;
  }

  interface Window {
    Cal?: CalFunction;
  }
}

const fields = [
  { id: "name", label: "Name", type: "text", required: true, placeholder: "Full name", autoComplete: "name" },
  { id: "email", label: "Email", type: "email", required: true, placeholder: "name@company.com", autoComplete: "email" },
  { id: "phone", label: "Phone", type: "tel", required: true, placeholder: "+1 (555) 000-0000", autoComplete: "tel" },
  { id: "website", label: "Company website", type: "url", required: true, placeholder: "company.com", autoComplete: "url" },
];

const companySizes = ["1 to 10", "11 to 25", "26 to 50", "51 to 100", "101 to 250", "250+"];
const revenueRanges = [
  "Under ₹50 Lakh",
  "₹50 Lakh to ₹1 Cr",
  "₹1 Cr to ₹5 Cr",
  "₹5 Cr to ₹20 Cr",
  "₹20 Cr to ₹100 Cr",
  "₹100 Cr+",
];

export function AuditForm() {
  const [modalOpen, setModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [prefill, setPrefill] = useState({ name: "", email: "" });
  const calContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock background page scroll on mobile/desktop when modal is open
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  // Close modal on Escape key press
  useEffect(() => {
    if (!modalOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalOpen]);

  // Trap focus inside modal when open
  useEffect(() => {
    if (!modalOpen) return;
    const modalElement = modalRef.current;
    if (!modalElement) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // Focus the first focusable element (usually the close button)
    const focusableElements = modalElement.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const element = modalRef.current;
      if (!element) return;

      const focusable = element.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }

    window.addEventListener("keydown", handleTab);
    return () => {
      window.removeEventListener("keydown", handleTab);
    };
  }, [modalOpen]);

  // Initialize Cal.com loader on client-side mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    (function (C: any, A: string, L: string) {
      const p = function (a: any, ar: any) { a.q.push(ar); };
      const d = C.document;
      C.Cal = C.Cal || function (this: any) {
        const cal = C.Cal as any;
        const ar = arguments;
        if (!cal) return;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          const script = d.createElement("script");
          script.src = A;
          d.head.appendChild(script);
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api: any = function (this: any) {
            p(api, arguments);
          };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ["initNamespace", namespace]);
          } else {
            p(cal, ar);
          }
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");
  }, []);

  // Handle embedding and listeners when modal is open
  useEffect(() => {
    if (!modalOpen || success || typeof window === "undefined") {
      return;
    }

    const cal = window.Cal;
    if (!cal) {
      return;
    }

    const container = calContainerRef.current;
    if (!container) {
      return;
    }

    // Clear container to avoid duplicate nested widgets
    container.innerHTML = "";

    // Initialize and embed
    cal("init", { origin: "https://cal.com" });
    cal("inline", {
      elementOrSelector: container,
      calLink: "wavesco.in/review",
      config: {
        layout: "month_view",
        name: prefill.name || undefined,
        email: prefill.email || undefined,
      },
    });

    const handleBookingSuccess = () => {
      setSuccess(true);
    };

    cal("on", {
      action: "bookingSuccessfulV2",
      callback: handleBookingSuccess,
    });

    cal("on", {
      action: "bookingSuccessful",
      callback: handleBookingSuccess,
    });

    return () => {
      cal("off", {
        action: "bookingSuccessfulV2",
        callback: handleBookingSuccess,
      });
      cal("off", {
        action: "bookingSuccessful",
        callback: handleBookingSuccess,
      });
    };
  }, [modalOpen, prefill.email, prefill.name, success]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setPrefill({
      name: (form.elements.namedItem("name") as HTMLInputElement | null)?.value ?? "",
      email: (form.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "",
    });
    setSuccess(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSuccess(false);
  }

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setPrefill((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return (
    <>

      <form
        onSubmit={onSubmit}
        className="relative rounded-sm border border-line/80 bg-white p-8 shadow-precise sm:p-10"
      >
        {/* Secure marker */}
        <div className="absolute right-6 top-6 flex select-none items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          <Lock size={10} />
          Secure intake
        </div>

        <div className="grid gap-6 pt-6 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.id} className="grid gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-navy">
                {field.label}
              </span>
              <input
                id={field.id}
                name={field.id}
                required={field.required}
                type={field.type}
                autoComplete={field.autoComplete}
                className="field-control focus-ring px-4 text-sm placeholder:text-muted/65"
                placeholder={field.placeholder}
                onChange={handleFieldChange}
              />
            </label>
          ))}

          <label className="grid gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-navy">
              Team size
            </span>
            <select
              required
              name="companySize"
              className="field-control focus-ring cursor-pointer px-4 text-sm"
              defaultValue=""
              onChange={handleFieldChange}
            >
              <option value="" disabled>
                Select team size
              </option>
              {companySizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-navy">
              Annual revenue
            </span>
            <select
              required
              name="revenueRange"
              className="field-control focus-ring cursor-pointer px-4 text-sm"
              defaultValue=""
              onChange={handleFieldChange}
            >
              <option value="" disabled>
                Select revenue range
              </option>
              {revenueRanges.map((range) => (
                <option key={range} value={range}>{range}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 sm:col-span-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-navy">
              What still depends on you?
            </span>
            <textarea
              required
              name="biggestBottleneck"
              rows={4}
              className="field-control focus-ring px-4 py-4 text-sm leading-6 placeholder:text-muted/65"
              placeholder="Where does work slow down when you are not involved?"
              onChange={handleFieldChange}
            />
          </label>
        </div>

        <div className="mt-8 flex flex-col justify-between gap-4 border-t border-line/45 pt-6 sm:flex-row sm:items-center">
          <p className="max-w-sm font-mono text-[10px] uppercase leading-5 tracking-wider text-muted">
            We review every request before confirming a call.
          </p>
          <div className="flex justify-end">
            <Button type="submit">Book Architecture Review</Button>
          </div>
        </div>
      </form>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center md:grid md:place-items-center bg-navy-dark/65 p-0 md:p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              ref={modalRef}
              className="w-full max-w-4xl rounded-none md:rounded-sm border-x-0 border-b-0 border-t md:border border-line bg-white shadow-precise h-[100dvh] md:h-auto max-h-[100dvh] md:max-h-none flex flex-col overflow-hidden"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnimatePresence mode="wait">
                {!success ? (
                  <motion.div
                    key="calendar-view"
                    className="flex flex-col flex-1 min-h-0 h-full md:h-auto"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex items-center justify-between border-b border-line bg-paper p-6 flex-none pt-[calc(1.5rem+env(safe-area-inset-top))] md:pt-6">
                      <div className="flex items-center gap-4">
                        <CalendarDays className="text-navy" size={20} strokeWidth={1.8} />
                        <h2 id="calendar-title" className="font-heading text-xl font-semibold text-navy">
                          Choose a review time
                        </h2>
                      </div>
                      <button
                        className="focus-ring rounded-sm p-2 text-body transition-colors duration-200 hover:bg-white"
                        onClick={closeModal}
                        aria-label="Close calendar"
                        type="button"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto -webkit-overflow-scrolling: touch flex flex-col min-h-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                      <p className="max-w-2xl text-sm leading-6 text-body flex-none">
                        Choose a time for the architecture review. The booking experience stays on the Waves site and will confirm the appointment directly here.
                      </p>
                      <div className="mt-6 rounded-sm border border-line/70 bg-paper/40 overflow-visible md:overflow-hidden flex-1 flex flex-col min-h-[580px] md:min-h-[560px]">
                        <div ref={calContainerRef} id="architecture-audit-cal" className="flex-1 min-h-0 h-full w-full" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success-view"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white p-10 text-center flex flex-col justify-center items-center flex-1 h-full md:h-auto pb-[calc(2.5rem+env(safe-area-inset-bottom))]"
                  >
                    <CheckCircle2 className="mx-auto text-success" size={48} strokeWidth={1.8} />
                    <h2 className="mt-6 font-heading text-[28px] font-semibold leading-tight text-navy">
                      Review request received.
                    </h2>
                    <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-body">
                      We have your intake and booking. If the review is a fit, you will receive the invite and agenda shortly.
                    </p>
                    <div className="mt-8">
                      <Button href="/">Return Home</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
