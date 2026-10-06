"use client";

import { useState, useEffect } from "react";

interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  timestamp: Date;
  status: string;
  extractedData?: {
    service_needed?: string;
    budget?: string;
    timeline?: string;
    location?: string;
    lead_score?: number;
    classification?: string;
    reasons?: string[];
  };
  rawConversation?: string;
}

type LeadsTableProps = {
  leads: Lead[];
  businessId: string;
};

export type { LeadsTableProps };

export function LeadsTable({ leads, businessId }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const statusClasses: Record<string, string> = {
    HOT: "bg-red-100 text-red-800",
    WARM: "bg-amber-100 text-orange-800",
    COLD: "bg-gray-100 text-gray-800",
    new: "bg-gray-100 text-gray-800",
    qualifying: "bg-yellow-100 text-orange-800",
    hot: "bg-red-100 text-red-800",
    warm: "bg-amber-100 text-orange-800",
    cold: "bg-gray-100 text-gray-800",
    converted: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
  };

  function getStatusClass(status: string): string {
    return statusClasses[status] || "bg-gray-100 text-gray-800";
  }

  function getLeadDetailClass(classification: string): string {
    if (!classification) return "bg-white border-gray-200 text-gray-800";
    if (classification === "HOT") return "bg-red-100 border-red-200 text-red-800";
    if (classification === "WARM") return "bg-amber-100 border-amber-200 text-orange-800";
    return "bg-gray-100 border-gray-200 text-gray-800";
  }

  function statusBadgeClass(status: string): string {
    switch (status) {
      case "HOT":
      case "hot":
        return "bg-red-100 text-red-800";
      case "WARM":
      case "warm":
        return "bg-amber-100 text-orange-800";
      case "COLD":
      case "cold":
      case "new":
        return "bg-gray-100 text-gray-800";
      case "qualifying":
        return "bg-yellow-100 text-orange-800";
      case "converted":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-table mb-4">
        <thead>
          <tr className="border-b border-line">
            <th className="px-4 py-3 text-left text-xs font-medium text-fg-2 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-fg-2 uppercase tracking-wider">
              Source
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-fg-2 uppercase tracking-wider">
              Time Received
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-fg-2 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-fg-2 uppercase tracking-wider">
              Score
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-fg-2 uppercase tracking-wider">
              Service
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-fg-2 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="hover:bg-panel-2 transition-colors"
              onClick={() => setSelectedLead(lead)}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-fg">{lead.name}</div>
                <div className="text-xs text-fg-3">{lead.source}</div>
              </td>
              <td className="px-4 py-3">
                <div className="text-xs text-fg-3">{lead.timestamp.toLocaleString()}</div>
              </td>
              <td className="px-4 py-3">
                <span className={statusBadgeClass(lead.status)}>
                  {lead.status}
                </span>
              </td>
              <td className="px-4 py-3">
                {lead.extractedData?.lead_score !== undefined
                  ? lead.extractedData.lead_score
                  : "—"}
              </td>
              <td className="px-4 py-3">
                {lead.extractedData?.service_needed || "—"}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLead(lead);
                  }}
                  className="text-sm text-accent hover:underline"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Selected lead detail sidebar */}
      {selectedLead && (
        <div className="mt-8 bg-white rounded-lg p-6 shadow-sm border max-h-[calc(100vh-200px)] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Lead Detail</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-fg-3 mb-2">Name</p>
              <p className="font-medium text-fg">{selectedLead.name}</p>
            </div>
            <div>
              <p className="text-sm text-fg-3 mb-2">Phone</p>
              <p className="font-medium text-fg">{selectedLead.phone}</p>
            </div>
            <div>
              <p className="text-sm text-fg-3 mb-2">Source</p>
              <p className="font-medium text-fg">{selectedLead.source}</p>
            </div>
            <div>
              <p className="text-sm text-fg-3 mb-2">Received</p>
              <p className="font-medium text-fg">{selectedLead.timestamp.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-fg-3 mb-2">Status</p>
              <p>
                <span className={statusBadgeClass(selectedLead.status)}>
                  {selectedLead.status}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-fg-3 mb-2">Service</p>
              <p className="font-medium text-fg">
                {selectedLead.extractedData?.service_needed || "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-sm text-fg-3 mb-2">Budget</p>
              <p className="font-medium text-fg">
                {selectedLead.extractedData?.budget || "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-sm text-fg-3 mb-2">Timeline</p>
              <p className="font-medium text-fg">
                {selectedLead.extractedData?.timeline || "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-sm text-fg-3 mb-2">Location</p>
              <p className="font-medium text-fg">
                {selectedLead.extractedData?.location || "Not specified"}
              </p>
            </div>
          </div>

          {selectedLead.extractedData?.lead_score !== undefined && (
            <div className={getLeadDetailClass(selectedLead.extractedData.classification || "")}>
              <p className="text-semibold mb-2">
                Lead Score: {selectedLead.extractedData.lead_score}
              </p>
              <p className="text-sm text-fg-3">
                Classification: {selectedLead.extractedData.classification}
              </p>
              {(() => {
                const extractedData = selectedLead.extractedData;
                const reasons = extractedData?.reasons;
                if (!reasons || reasons.length === 0) return null;
                return (
                  <div className="mt-2 text-xs">
                    <strong>Why:</strong>
                    {reasons.map((reason, i) => (
                      <div key={i} className="mb-1">
                        • {reason}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={() => setSelectedLead(null)}
              className="btn btn-ghost w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}