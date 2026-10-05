"use client";

import { createServerClient } from "@supabase/ssr";

// Create the server client
export function createSupaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Supabase env missing - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required in production");
    }
    console.warn("Supabase env missing - createSupaClient returning mock for build");
    return null as any;
  }
  const cookieStore = typeof document !== "undefined" ? document.cookie : "";
  return createServerClient(
    url,
    key,
    {
      cookies: {
        get(name: string) {
          if (typeof document === "undefined") return undefined;
          return document.cookie.replace(/(?:(?:^|.*;)\s*encodeURIComponent(name)\s*=\s*(.*?)(?:\s*;|$))/i, "$1") || undefined;
        },
        set(name: string, value: string, options: any) {
          if (typeof document === "undefined") return;
          document.cookie = `${name}=${value};path=/;max-age=${options.maxAge || 3600};SameSite=Lax${options.expires ? `;expires=${options.expires.toUTCString()}` : ''}`;
        },
        remove(name: string, options: any) {
          if (typeof document === "undefined") return;
          document.cookie = `${name}=;path=/;max-age=0;SameSite=Lax`;
        },
      },
    }
  );
}

// ============================================================================
// Database Types (matching Supabase schema)
// ============================================================================

export type BusinessId = string;

export interface BusinessConfig {
  id: string;
  business_id: string;
  business_name: string;
  timezone: string;
  business_hours: {
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
  };
  qualification_fields: string[];
  notification_channels: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Lead {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string;
  source: "website" | "whatsapp" | "instagram" | "sms" | "form";
  service_needed?: string;
  budget?: string;
  timeline?: string;
  location?: string;
  intent?: "low" | "medium" | "high";
  lead_score: number;
  classification: "cold" | "warm" | "hot";
  score_reasons: string[];
  status: "new" | "after-hours" | "qualifying" | "qualified" | "hot" | "warm" | "cold" | "converted" | "closed";
  received_at: Date;
  last_contacted_at?: Date;
  converted_at?: Date;
  rawConversation?: string;
}

export interface LeadMessage {
  id: string;
  business_id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  sender_type: "lead" | "assistant" | "system";
  message_content: string;
  timestamp?: Date;
  provider_message_id?: string;
  read_by_lead?: boolean;
}

export interface Conversation {
  id: string;
  business_id: string;
  lead_id: string;
  channel: "webchat";
  status: "active" | "completed" | "archived";
  started_at?: Date;
  ended_at?: Date;
}

export interface Followup {
  id: string;
  business_id: string;
  lead_id: string;
  scheduled_at: Date;
  sequence_number: number;
  status: "pending" | "sent" | "cancelled";
  sent_at?: Date | null;
  cancellation_reason?: string | null;
  content: string;
  created_at?: Date;
}

export interface Event {
  id: string;
  business_id: string;
  lead_id: string;
  event_type:
    | "lead_received"
    | "after_hours_detected"
    | "ai_response"
    | "qualification_completed"
    | "lead_scored"
    | "human_escalation"
    | "follow_up_sent"
    | "lead_converted"
    | "lead_lost";
  event_payload: Record<string, unknown>;
  occurred_at?: Date;
}

// ============================================================================
// Supabase CRUD Operations
// ============================================================================

export class SupabaseService {
  private supa: ReturnType<typeof createServerClient>;

  constructor(supa: ReturnType<typeof createServerClient>) {
    this.supa = supa;
  }

  // ===================== Business Config =====================

  async getBusinessConfig(businessId: string): Promise<BusinessConfig | null> {
    const { data, error } = await this.supa
      .from("prototype_business_config")
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (error) {
      console.error("Error fetching business config:", error);
      return null;
    }

    return {
      id: data.id,
      business_id: data.business_id,
      business_name: data.business_name,
      timezone: data.timezone,
      business_hours: data.business_hours,
      qualification_fields: data.qualification_fields,
      notification_channels: data.notification_channels,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async upsertBusinessConfig(config: Omit<BusinessConfig, "id" | "created_at" | "updated_at">): Promise<BusinessConfig> {
    const { data, error } = await this.supa
      .from("prototype_business_config")
      .upsert({
        business_id: config.business_id,
        business_name: config.business_name,
        timezone: config.timezone,
        business_hours: config.business_hours,
        qualification_fields: config.qualification_fields,
        notification_channels: config.notification_channels,
      })
      .single();

    if (error) {
      console.error("Error upserting business config:", error);
      throw error;
    }

    return {
      id: data.id,
      business_id: data.business_id,
      business_name: data.business_name,
      timezone: data.timezone,
      business_hours: data.business_hours,
      qualification_fields: data.qualification_fields,
      notification_channels: data.notification_channels,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  // ===================== Leads =====================

  async createLead(lead: Omit<Lead, "id" | "received_at">): Promise<Lead> {
    const { data, error } = await this.supa
      .from("prototype_leads")
      .insert({
        business_id: lead.business_id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        service_needed: lead.service_needed,
        budget: lead.budget,
        timeline: lead.timeline,
        location: lead.location,
        intent: lead.intent,
        lead_score: lead.lead_score,
        classification: lead.classification,
        score_reasons: lead.score_reasons,
        status: lead.status,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating lead:", error);
      throw error;
    }

    return {
      id: data.id,
      business_id: data.business_id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      source: data.source,
      service_needed: data.service_needed,
      budget: data.budget,
      timeline: data.timeline,
      location: data.location,
      intent: data.intent,
      lead_score: data.lead_score,
      classification: data.classification,
      score_reasons: data.score_reasons,
      status: data.status,
      received_at: data.received_at,
      last_contacted_at: data.last_contacted_at,
      converted_at: data.converted_at,
      rawConversation: data.raw_conversation,
    };
  }

  async getLeadsByBusiness(businessId: string): Promise<Lead[]> {
    const { data, error } = await this.supa
      .from("prototype_leads")
      .select("*")
      .eq("business_id", businessId)
      .order("received_at", { ascending: false });

    if (error) {
      console.error("Error fetching leads:", error);
      return [];
    }

    return data.map((lead: any) => ({
      id: lead.id,
      business_id: lead.business_id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      service_needed: lead.service_needed,
      budget: lead.budget,
      timeline: lead.timeline,
      location: lead.location,
      intent: lead.intent,
      lead_score: lead.lead_score,
      classification: lead.classification,
      score_reasons: lead.score_reasons,
      status: lead.status,
      received_at: lead.received_at,
      last_contacted_at: lead.last_contacted_at,
      converted_at: lead.converted_at,
      rawConversation: lead.raw_conversation,
    }));
  }

  async getLeadById(leadId: string, businessId: string): Promise<Lead | null> {
    const { data, error } = await this.supa
      .from("prototype_leads")
      .select("*")
      .eq("id", leadId)
      .eq("business_id", businessId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      business_id: data.business_id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      source: data.source,
      service_needed: data.service_needed,
      budget: data.budget,
      timeline: data.timeline,
      location: data.location,
      intent: data.intent,
      lead_score: data.lead_score,
      classification: data.classification,
      score_reasons: data.score_reasons,
      status: data.status,
      received_at: data.received_at,
      last_contacted_at: data.last_contacted_at,
      converted_at: data.converted_at,
      rawConversation: data.raw_conversation,
    };
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
    const { data, error } = await this.supa
      .from("prototype_leads")
      .update({
        name: updates.name,
        phone: updates.phone,
        email: updates.email,
        service_needed: updates.service_needed,
        budget: updates.budget,
        timeline: updates.timeline,
        location: updates.location,
        intent: updates.intent,
        lead_score: updates.lead_score,
        classification: updates.classification,
        score_reasons: updates.score_reasons,
        status: updates.status,
        last_contacted_at: updates.last_contacted_at,
        converted_at: updates.converted_at,
      })
      .eq("id", id)
      .eq("business_id", updates.business_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating lead:", error);
      return null;
    }

    return {
      id: data.id,
      business_id: data.business_id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      source: data.source,
      service_needed: data.service_needed,
      budget: data.budget,
      timeline: data.timeline,
      location: data.location,
      intent: data.intent,
      lead_score: data.lead_score,
      classification: data.classification,
      score_reasons: data.score_reasons,
      status: data.status,
      received_at: data.received_at,
      last_contacted_at: data.last_contacted_at,
      converted_at: data.converted_at,
      rawConversation: data.raw_conversation,
    };
  }

  // ===================== Conversations =====================

  async createConversation(conversation: Omit<Conversation, "id">): Promise<Conversation> {
    const { data, error } = await this.supa
      .from("prototype_conversations")
      .insert({
        business_id: conversation.business_id,
        lead_id: conversation.lead_id,
        channel: conversation.channel,
        status: conversation.status,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }

    return {
      id: data.id,
      business_id: data.business_id,
      lead_id: data.lead_id,
      channel: data.channel,
      status: data.status,
      started_at: data.started_at,
      ended_at: data.ended_at,
    };
  }

  async getConversationsByLead(leadId: string, businessId: string): Promise<Conversation[]> {
    const { data, error } = await this.supa
      .from("prototype_conversations")
      .select("*")
      .eq("lead_id", leadId)
      .eq("business_id", businessId)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }

    return data.map((conv: any) => ({
      id: conv.id,
      business_id: conv.business_id,
      lead_id: conv.lead_id,
      channel: conv.channel,
      status: conv.status,
      started_at: conv.started_at,
      ended_at: conv.ended_at,
    }));
  }

  // ===================== Messages =====================

  async createMessage(message: Omit<LeadMessage, "id">): Promise<LeadMessage> {
    const { data, error } = await this.supa
      .from("prototype_messages")
      .insert({
        business_id: message.business_id,
        conversation_id: message.conversation_id,
        direction: message.direction,
        sender_type: message.sender_type,
        message_content: message.message_content,
        provider_message_id: message.provider_message_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating message:", error);
      throw error;
    }

    return {
      id: data.id,
      business_id: data.business_id,
      conversation_id: data.conversation_id,
      direction: data.direction,
      sender_type: data.sender_type,
      message_content: data.message_content,
      timestamp: data.timestamp,
      provider_message_id: data.provider_message_id,
      read_by_lead: data.read_by_lead,
    };
  }

  async getMessagesByConversation(conversationId: string, businessId: string): Promise<LeadMessage[]> {
    const { data, error } = await this.supa
      .from("prototype_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("business_id", businessId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return [];
    }

    return data.map((msg: any) => ({
      id: msg.id,
      business_id: msg.business_id,
      conversation_id: msg.conversation_id,
      direction: msg.direction,
      sender_type: msg.sender_type,
      message_content: msg.message_content,
      timestamp: msg.timestamp,
      provider_message_id: msg.provider_message_id,
      read_by_lead: msg.read_by_lead,
    }));
  }

  // ===================== Follow-ups =====================

  async createFollowup(followup: Omit<Followup, "id">): Promise<Followup> {
    const { data, error } = await this.supa
      .from("prototype_followups")
      .insert({
        business_id: followup.business_id,
        lead_id: followup.lead_id,
        scheduled_at: followup.scheduled_at,
        sequence_number: followup.sequence_number,
        status: followup.status,
        content: followup.content,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating followup:", error);
      throw error;
    }

    return {
      id: data.id,
      business_id: data.business_id,
      lead_id: data.lead_id,
      scheduled_at: data.scheduled_at,
      sequence_number: data.sequence_number,
      status: data.status,
      sent_at: data.sent_at,
      cancellation_reason: data.cancellation_reason,
      content: data.content,
      created_at: data.created_at,
    };
  }

  async getFollowupsByLead(leadId: string, businessId: string): Promise<Followup[]> {
    const { data, error } = await this.supa
      .from("prototype_followups")
      .select("*")
      .eq("lead_id", leadId)
      .eq("business_id", businessId)
      .order("sequence_number", { ascending: true });

    if (error) {
      console.error("Error fetching followups:", error);
      return [];
    }

    return data.map((fu: any) => ({
      id: fu.id,
      business_id: fu.business_id,
      lead_id: fu.lead_id,
      scheduled_at: fu.scheduled_at,
      sequence_number: fu.sequence_number,
      status: fu.status,
      sent_at: fu.sent_at,
      cancellation_reason: fu.cancellation_reason,
      content: fu.content,
      created_at: fu.created_at,
    }));
  }

  // ===================== Events =====================

  async logEvent(event: Omit<Event, "id">): Promise<Event> {
    const { data, error } = await this.supa
      .from("prototype_events")
      .insert({
        business_id: event.business_id,
        lead_id: event.lead_id,
        event_type: event.event_type,
        event_payload: event.event_payload,
      })
      .select()
      .single();

    if (error) {
      console.error("Error logging event:", error);
      throw error;
    }

    return {
      id: data.id,
      business_id: data.business_id,
      lead_id: data.lead_id,
      event_type: data.event_type,
      event_payload: data.event_payload,
      occurred_at: data.occurred_at,
    };
  }

  async getEventsByLead(leadId: string, businessId: string): Promise<Event[]> {
    const { data, error } = await this.supa
      .from("prototype_events")
      .select("*")
      .eq("lead_id", leadId)
      .eq("business_id", businessId)
      .order("occurred_at", { ascending: false });

    if (error) {
      console.error("Error fetching events:", error);
      return [];
    }

    return data.map((ev: any) => ({
      id: ev.id,
      business_id: ev.business_id,
      lead_id: ev.lead_id,
      event_type: ev.event_type,
      event_payload: ev.event_payload,
      occurred_at: ev.occurred_at,
    }));
  }
}

// ============================================================================
// Initialize Supabase client from existing Next.js setup
// ============================================================================

export function initializeSupaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Supabase env missing - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required in production");
    }
    console.warn("Supabase env missing - initializeSupaClient returning mock for build");
    const mockSupa: any = {
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), order: () => ({ eq: async () => ({ data: [], error: null }) }), limit: async () => ({ data: [], error: null }) }), single: async () => ({ data: null, error: null }), order: async () => ({ data: [], error: null }), limit: async () => ({ data: [], error: null }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: `mock-${Date.now()}`, business_id: "demo-1", lead_id: "mock", conversation_id: "mock", direction: "inbound", sender_type: "lead", message_content: "", timestamp: new Date(), read_by_lead: false, business_name: "Mock", timezone: "Asia/Kolkata", business_hours: {}, qualification_fields: [], notification_channels: [], created_at: new Date(), updated_at: new Date(), name: "Mock", phone: "000", source: "website", lead_score: 0, classification: "cold", score_reasons: [], status: "new", received_at: new Date(), channel: "webchat", started_at: new Date(), scheduled_at: new Date(), sequence_number: 1, content: "", sent_at: null, cancellation_reason: null, event_type: "lead_received", event_payload: {}, occurred_at: new Date() }, error: null }) }) }),
        update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }) }),
        upsert: () => ({ single: async () => ({ data: { id: "mock", business_id: "demo-1", business_name: "Mock", timezone: "Asia/Kolkata", business_hours: {}, qualification_fields: [], notification_channels: [], created_at: new Date(), updated_at: new Date() }, error: null }) }),
      }),
    };
    return new SupabaseService(mockSupa);
  }
  const supa = createServerClient(
    url,
    key,
    {
      cookies: {
        get(name: string) {
          if (typeof document === "undefined") return undefined;
          const value = document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="));
          return value ? value.split("=")[1] : undefined;
        },
        set(name: string, value: string, options: any) {
          if (typeof document === "undefined") return;
          document.cookie = `${name}=${value};path=/;max-age=${options.maxAge || 3600};SameSite=Lax${options.expires ? `;expires=${options.expires.toUTCString()}` : ''}`;
        },
        remove(name: string, options: any) {
          if (typeof document === "undefined") return;
          document.cookie = `${name}=;path=/;max-age=0;SameSite=Lax`;
        },
      },
    }
  );

  return new SupabaseService(supa);
}