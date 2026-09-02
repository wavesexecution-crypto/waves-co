"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LeadsTable } from "../../components/leads-table/LeadsTable";
import { EmptyState } from "../components/empty-state/EmptyState";
import { useBusinessContext } from "../business-context";

export default function LeadsPage() {
  const { business, isLoading } = useBusinessContext();
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Fetch leads when business changes
  }, [business]);

  if (isLoading || !business) {
    return <div className="h-96 flex items-center justify-center">Loading...</div>;
  }

  const filteredLeads = business.leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      (lead as any)?.service_needed?.toLowerCase().includes(search.toLowerCase()) ||
      (lead as any)?.budget?.toLowerCase().includes(search.toLowerCase()) ||
      lead.source.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Leads</h1>
        <button
          onClick={() => router.push("/prototype/new-lead")}
          className="btn btn-primary"
        >
          New Lead
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Stats cards */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="text-3xl font-bold text-navy">{business.leads.length}</div>
          <div className="text-sm text-muted mt-2">Total Leads</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="text-3xl font-bold text-green">{business.leads.filter((l) => l.status === "hot").length}</div>
          <div className="text-sm text-muted mt-2">hot</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="text-3xl font-bold text-orange">{business.leads.filter((l) => l.status === "warm").length}</div>
          <div className="text-sm text-muted mt-2">warm</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="text-3xl font-bold text-gray-600">{business.leads.filter((l) => l.status === "cold").length}</div>
          <div className="text-sm text-muted mt-2">cold</div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg p-6 shadow-sm border">
<div className="flex gap-2 mb-4">
          <select
            onChange={(e) => setSearch(e.target.value)}
            className="field-control"
          >
            <option value="">All Leads</option>
            <option value="hot">hot</option>
            <option value="warm">warm</option>
            <option value="cold">cold</option>
            <option value="new">New</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-control flex-1"
            placeholder="Search leads..."
          />
        </div>
        {filteredLeads.length === 0 ? (
          <EmptyState />
        ) : (
          <LeadsTable leads={filteredLeads as any} businessId={business.id} />
        )}
      </div>
    </div>
  );
}