"use client";

import { create } from "zustand";
import { createSupaClient, initializeSupaClient, type BusinessConfig, type Lead, type LeadMessage, type Conversation, type Followup, type Event } from "./supabase/client";

// ============================
// Initialize Supabase service
// ============================
const supaService = initializeSupaClient();

// ============================
// Business Config
// ============================

// BusinessConfig is imported from ./supabase/client

// ============================
// Lead Status Enum
// ============================
export const LeadStatus = {
  NEW: "new",
  AFTER_HOURS: "after-hours",
  QUALIFYING: "qualifying",
  QUALIFIED: "qualified",
  HOT: "hot",
  WARM: "warm",
  COLD: "cold",
  CONVERTED: "converted",
  CLOSED: "closed",
} as const;

export type LeadStatus = typeof LeadStatus[keyof typeof LeadStatus];

// ============================
// Lead Scoring
// ============================
export const LeadScoring = {
  BUDGET_PROVIDED: 20,
  TIMELINE_PROVIDED: 20,
  SERVICE_IDENTIFIED: 20,
  LOCATION_PROVIDED: 10,
  STRONG_PURCHASE_INTENT: 20,
  REQUESTED_QUOTATION: 10,
  MAX_SCORE: 100,
} as const;

// ============================
// Scoring Function
// ============================
export function calculateLeadScore(
  data: {
    budget?: string;
    timeline?: string;
    service?: string;
    location?: string;
    intent?: "low" | "medium" | "high";
    requestedQuotation?: boolean;
  },
  reasons: string[]
): { score: number; classification: string; reasons: string[] } {
  let score = 0;

  if (data.budget) {
    score += LeadScoring.BUDGET_PROVIDED;
    reasons.push("Budget provided");
  }
  if (data.timeline) {
    score += LeadScoring.TIMELINE_PROVIDED;
    reasons.push("Timeline provided");
  }
  if (data.service) {
    score += LeadScoring.SERVICE_IDENTIFIED;
    reasons.push("Service identified");
  }
  if (data.location) {
    score += LeadScoring.LOCATION_PROVIDED;
    reasons.push("Location provided");
  }
  if (data.intent === "high") {
    score += LeadScoring.STRONG_PURCHASE_INTENT;
    reasons.push("Strong purchase intent");
  }
  if (data.requestedQuotation) {
    score += LeadScoring.REQUESTED_QUOTATION;
    reasons.push("Requested quotation");
  }

  let classification: string;
  if (score >= 80) {
    classification = "HOT";
  } else if (score >= 50) {
    classification = "WARM";
  } else {
    classification = "COLD";
  }

  return { score, classification, reasons };
}

// ============================
// In-memory fallback store
// ============================
const leads: Map<string, Lead> = new Map();
const businesses: Map<string, Business> = new Map();

// Initialize with a demo business
const demoConfig: BusinessConfig = {
  id: "supabase-demo-id",
  business_id: "demo-1",
  business_name: "Example Interiors",
  timezone: "Asia/Kolkata",
  business_hours: {
    monday: { open: "09:00", close: "18:00" },
    tuesday: { open: "09:00", close: "18:00" },
    wednesday: { open: "09:00", close: "18:00" },
    thursday: { open: "09:00", close: "18:00" },
    friday: { open: "09:00", close: "18:00" },
    saturday: { open: "10:00", close: "16:00" },
    sunday: { open: "10:00", close: "16:00" },
  },
  qualification_fields: ["service_needed", "budget", "timeline", "location"],
  notification_channels: ["sms", "email"],
  created_at: new Date(),
  updated_at: new Date(),
};

businesses.set("demo-1", {
  id: "demo-1",
  name: "Example Interiors",
  config: demoConfig,
  leads: [],
});

// ============================
// Business Functions
// ============================

export function createBusiness(
  id: string,
  name: string,
  config: BusinessConfig
): Business {
  const business: Business = {
    id,
    name,
    config,
    leads: [],
  };
  businesses.set(id, business);
  return business;
}

export function getBusiness(id: string): Business | undefined {
  return businesses.get(id);
}

export function getAllBusinesses(): Business[] {
  return Array.from(businesses.values());
}

// ============================
// Lead CRUD Functions (Supabase-backed)
// ============================

export async function createLead(
  lead: Omit<Lead, "id"> & { 
    configId: string;
    extractedData?: {
      service_needed?: string;
      budget?: string;
      timeline?: string;
      location?: string;
      intent?: "low" | "medium" | "high";
      lead_score?: number;
      classification?: "cold" | "warm" | "hot";
      score_reasons?: string[];
    };
  }
): Promise<Lead> {
  // Try Supabase first
  try {
    const newLead: Lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: lead.name,
      phone: lead.phone,
      source: lead.source,
      received_at: new Date(),
      status: lead.status ?? "new",
      business_id: (lead as any).configId || "",
      lead_score: 0,
      classification: "cold",
      score_reasons: [],
    };
    leads.set(newLead.id, newLead);

    // Add to business
    const business = getBusiness(lead.configId);
    if (business) {
      business.leads.push(newLead);
    }

    // Also persist to Supabase
    await supaService.createLead({
      business_id: lead.configId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      service_needed: lead.extractedData?.service_needed,
      budget: lead.extractedData?.budget,
      timeline: lead.extractedData?.timeline,
      location: lead.extractedData?.location,
      intent: lead.extractedData?.intent,
      lead_score: lead.extractedData?.lead_score ?? 0,
      classification: lead.classification ?? "cold",
      score_reasons: lead.extractedData?.score_reasons ?? [],
      status: lead.status ?? "new",
    });

    return newLead;
  } catch (err) {
    // Fallback to in-memory only
    console.warn("Supabase lead creation failed, using in-memory:", err);

    const newLead: Lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: lead.name,
      phone: lead.phone,
      source: lead.source,
      received_at: new Date(),
      status: lead.status ?? "new",
      business_id: (lead as any).configId || "",
      lead_score: 0,
      classification: "cold",
      score_reasons: [],
    };
    leads.set(newLead.id, newLead);

    const business = getBusiness(lead.configId);
    if (business) {
      business.leads.push(newLead);
    }

    return newLead;
  }
}

export async function getLead(id: string): Promise<Lead | undefined> {
  // Try Supabase first
  try {
    const result = await supaService.getLeadById(id, "demo-1");
    if (result) return result;
  } catch (err) {
    console.warn("Supabase getLead failed, falling back:", err);
  }

  // Fallback to in-memory
  return leads.get(id);
}

export async function getLeadsByStatus(
  status: LeadStatus,
  configId?: string
): Promise<Lead[]> {
  // Try Supabase first
  try {
    const businessId = configId ?? "demo-1";
    const result = await supaService.getLeadsByBusiness(businessId);
    const filtered = result.filter((l: any) => l.status === status);
    return filtered;
  } catch (err) {
    console.warn("Supabase getLeadsByStatus failed, falling back:", err);
  }

  // Fallback to in-memory
  if (configId) {
    const business = getBusiness(configId);
    if (business) {
      return business.leads.filter((l) => l.status === status);
    }
  }
  return Array.from(leads.values()).filter((l) => l.status === status);
}

// ============================
// Conversation Store (Client-side)
// ============================

interface ConversationState {
  leadId: string | null;
  messages: LeadMessage[];
  step: "initial" | "qualifying" | "complete";
  extractedData: Partial<{
    service_needed: string;
    budget: string;
    timeline: string;
    location: string;
  }>;
  isAfterHours: boolean;

  addMessage: (role: "user" | "assistant", content: string) => LeadMessage;
  setLeadId: (id: string | null) => void;
  advanceStep: (step: "initial" | "qualifying" | "complete") => void;
  updateExtractedData: (
    data: Partial<{
      service_needed: string;
      budget: string;
      timeline: string;
      location: string;
    }>
  ) => void;
  setIsAfterHours: (value: boolean) => void;
  reset: () => void;
}

// ============================
// Persist messages to Supabase (separate from store action)
// ============================

export async function persistMessagesToSupabase(
  leadId: string,
  messages: LeadMessage[]
): Promise<void> {
  if (!leadId) return;

  for (const msg of messages) {
    try {
      await supaService.createMessage({
        business_id: "demo-1",
        conversation_id: leadId,
        direction: "outbound",
        sender_type: "assistant",
        message_content: (msg as any).message_content ?? (msg as any).content,
        timestamp: (msg as any).timestamp ?? new Date(),
        provider_message_id: msg.id,
        read_by_lead: (msg as any).read_by_lead ?? false,
      });
    } catch (err) {
      console.warn("Failed to persist message to Supabase:", err);
    }
  }
}

// ============================
// Conversation Store (Client-side, persists to Supabase separately)
// ============================

export const useConversationStore = create<ConversationState>((set, get) => ({
  leadId: null,
  messages: [],
  step: "initial",
  extractedData: {},
  isAfterHours: false,

  addMessage: (role: "user" | "assistant", content: string) => {
    const leadId = get().leadId || "unknown";
    const msg: LeadMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      business_id: "demo-1",
      conversation_id: leadId,
      direction: role === "user" ? "inbound" : "outbound",
      sender_type: role === "user" ? "lead" : "assistant",
      message_content: content,
      timestamp: new Date(),
      provider_message_id: undefined,
      read_by_lead: false,
    };
    set((state) => ({
      messages: [...state.messages, msg],
    }));
    // Persist to Supabase in background (non-blocking)
    if (leadId !== "unknown") {
      // Fire-and-forget: don't await, just schedule
      persistMessagesToSupabase(leadId, [msg]).catch(() => {});
    }
    return msg;
  },

  setLeadId: (id: string | null) => set({ leadId: id }),

  advanceStep: (step: "initial" | "qualifying" | "complete") =>
    set({ step }),

  updateExtractedData: (data: Partial<{
    service_needed: string;
    budget: string;
    timeline: string;
    location: string;
  }>) =>
    set((state) => ({ extractedData: { ...state.extractedData, ...data } })),

  setIsAfterHours: (value: boolean) => set({ isAfterHours: value }),

  reset: () =>
    set({
      leadId: null,
      messages: [],
      step: "initial",
      extractedData: {},
      isAfterHours: false,
    }),
}));

// ============================
// Follow-up Functions
// ============================

export async function createFollowup(
  leadId: string,
  scheduledAt: Date,
  sequenceNumber: number,
  status: "pending" | "sent" | "cancelled",
  content: string,
  businessId: string = "demo-1"
): Promise<Followup> {
  try {
    const result = await supaService.createFollowup({
      business_id: businessId,
      lead_id: leadId,
      scheduled_at: scheduledAt,
      sequence_number: sequenceNumber,
      status,
      content,
    });

    // Also add to in-memory
    const followup: Followup = {
      id: result.id,
      business_id: result.business_id,
      lead_id: result.lead_id,
      scheduled_at: result.scheduled_at,
      sequence_number: result.sequence_number,
      status: result.status,
      sent_at: result.sent_at,
      cancellation_reason: result.cancellation_reason,
      content: result.content ?? content,
      created_at: new Date(),
    };

    return followup;
  } catch (err) {
    console.warn("Supabase followup creation failed, falling back:", err);

    const followup: Followup = {
      id: `followup-${Date.now()}`,
      business_id: businessId,
      lead_id: leadId,
      scheduled_at: scheduledAt,
      sequence_number: sequenceNumber,
      status,
      sent_at: null,
      cancellation_reason: null,
      content,
      created_at: new Date(),
    };

    return followup;
  }
}

export async function getFollowupsByLead(
  leadId: string,
  businessId: string = "demo-1"
): Promise<Followup[]> {
  try {
    const result = await supaService.getFollowupsByLead(leadId, businessId);

    // Also return from in-memory (Lead has no followups array, so just return Supabase result)
    const memoryFollowups: Followup[] = [];

    return [...result, ...memoryFollowups];
  } catch (err) {
    console.warn("Supabase followups failed, falling back:", err);
    return [];
  }
}

// ============================
// Event Logging
// ============================

export async function logEvent(
  businessId: string,
  leadId: string,
  eventType: "lead_received" | "after_hours_detected" | "ai_response" | "qualification_completed" | "lead_scored" | "human_escalation" | "follow_up_sent" | "lead_converted" | "lead_lost",
  payload: Record<string, unknown> = {}
): Promise<Event> {
  try {
    const result = await supaService.logEvent({
      business_id: businessId,
      lead_id: leadId,
      event_type: eventType,
      event_payload: payload,
    });

    return {
      id: result.id,
      business_id: result.business_id,
      lead_id: result.lead_id,
      event_type: result.event_type,
      event_payload: result.event_payload,
      occurred_at: result.occurred_at,
    };
  } catch (err) {
    console.warn("Supabase event logging failed, falling back:", err);
    // Return a minimal event
    return {
      id: `event-${Date.now()}`,
      business_id: businessId,
      lead_id: leadId,
      event_type: eventType,
      event_payload: payload,
      occurred_at: new Date(),
    };
  }
}

// Export the Supabase service for direct use
export { supaService };

// Export types
export type { BusinessConfig, Lead, LeadMessage, Conversation, Followup, Event };

// Legacy compatibility exports
export function useLeadStore() {
  return { business: null, isLoading: false, setBusiness: () => {} };
}

// Re-export Business type as alias for compatibility
// Old interface: { id, name, config, leads }
// New structure uses BusinessConfig for config; Business combines them
export interface Business {
  id: string;
  name: string;
  config: BusinessConfig;
  leads: Lead[];
}