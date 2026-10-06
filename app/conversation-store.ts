import { create } from "zustand";
import { LeadStatus, calculateLeadScore, LeadScoring, LeadStatus as LeadStatusEnum } from "@/app/lead-store";

interface ConversationStep {
  id: string;
  title: string;
  question: string;
  skipCondition?: (data: any) => boolean;
}

const QualificationQuestions: ConversationStep[] = [
  {
    id: "1",
    title: "Service needed",
    question: "What specific interior service are you looking for? (e.g., 3BHK interior design, bedroom renovation, kitchen remodel)",
  },
  {
    id: "2",
    title: "Budget",
    question: "Do you have a budget in mind for this project?",
  },
  {
    id: "3",
    title: "Timeline",
    question: "When are you looking to start or complete the project?",
  },
  {
    id: "4",
    title: "Location",
    question: "What area or location is the property in?",
  },
];

interface ConversationState {
  leadId: string | null;
  messages: any[];
  step: "initial" | "qualifying" | "complete";
  currentQuestionIndex: number;
  extractedData: {
    service_needed?: string;
    budget?: string;
    timeline?: string;
    location?: string;
    intent?: "low" | "medium" | "high";
    lead_score?: number;
    classification?: string;
    reasons?: string[];
  };
  isAfterHours: boolean;

  addMessage: (role: "user" | "assistant", content: string) => void;
  advanceStep: () => void;
  updateAnswer: (answer: string, questionId: string) => void;
  reset: () => void;
  setAfterHours: (value: boolean) => void;
}

const _store = create<ConversationState>()((set, get) => ({
  leadId: null,
  messages: [],
  step: "initial",
  currentQuestionIndex: 0,
  extractedData: {},
  isAfterHours: false,

  addMessage: (role: "user" | "assistant", content: string) => {
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      role,
      content,
      timestamp: new Date(),
    };
    set((state) => ({
      messages: [...state.messages, msg],
    }));
    return msg;
  },

  advanceStep: () => {
    const state = get();
    const nextIndex = state.currentQuestionIndex + 1;

    if (nextIndex >= QualificationQuestions.length) {
      // All questions answered, calculate score
      const { score, classification, reasons } = calculateLeadScore(
        {
          budget: state.extractedData.budget,
          timeline: state.extractedData.timeline,
          service: state.extractedData.service_needed,
          location: state.extractedData.location,
          intent: "medium", // default
          requestedQuotation: true,
        },
        []
      );

      set({
        step: "complete",
        extractedData: {
          ...state.extractedData,
          lead_score: score,
          classification,
          reasons,
        },
      });

      // In a real system, we'd update the lead here
      // leadStore.updateLead(state.leadId!, { ...state.extractedData, lead_score: score });
    } else {
      set({ currentQuestionIndex: nextIndex });
    }
  },

  updateAnswer: (answer: string, questionId: string) => {
    set((state) => ({
      extractedData: {
        ...state.extractedData,
        [questionId]: answer,
      },
    }));
  },

  reset: () =>
    set({
leadId: null,
      messages: [],
      step: "initial",
      currentQuestionIndex: 0,
      extractedData: {},
      isAfterHours: false,
    }),
  
    setAfterHours: (value: boolean) =>
      set({ isAfterHours: value }),
  }));
  
export const useConversationStore = _store;

export { QualificationQuestions };