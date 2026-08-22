"use client";

import React, { useState, useEffect } from "react";
import { useHospital } from "@/context/HospitalContext";
import { ResourceRequest } from "@/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import { ResourceRequestModal } from "@/components/ResourceRequestModal";
import {
  PackagePlus,
  RefreshCw,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface LocalInventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  criticalThreshold: number;
  unit: string;
}

const DEFAULT_RESOURCE_CATEGORIES: Record<string, { category: string; threshold: number; unit: string }> = {
  "Ventilators": { category: "Critical Care", threshold: 4, unit: "units" },
  "Oxygen Cylinders": { category: "Respiratory", threshold: 15, unit: "cylinders" },
  "Blood Units (O-)": { category: "Blood Bank", threshold: 8, unit: "pints" },
  "ICU Dialysis Kits": { category: "Renal", threshold: 5, unit: "kits" },
  "PPE Emergency Packs": { category: "Safety", threshold: 50, unit: "packs" },
};

export default function InventoryPage() {
  const { hospitalId, hospitalName } = useHospital();
  const [inventory, setInventory] = useState<LocalInventoryItem[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInventoryAndRequests = async () => {
    if (!hospitalId) return;
    setIsLoading(true);
    try {
      const [resData, reqData] = await Promise.all([
        api.getHospitalResources(hospitalId),
        api.getResourceRequests(),
      ]);

      if (resData && resData.length > 0) {
        const items: LocalInventoryItem[] = resData.map((r, i) => {
          const meta = DEFAULT_RESOURCE_CATEGORIES[r.resource_type] || {
            category: "General",
            threshold: 5,
            unit: "units",
          };
          return {
            id: `res_${i}`,
            name: r.resource_type,
            category: meta.category,
            stock: r.available,
            criticalThreshold: meta.threshold,
            unit: meta.unit,
          };
        });
        setInventory(items);
      } else {
        // Fallback default set if empty
        const initial = Object.entries(DEFAULT_RESOURCE_CATEGORIES).map(([name, meta], i) => ({
          id: `res_${i}`,
          name,
          category: meta.category,
          stock: 10,
          criticalThreshold: meta.threshold,
          unit: meta.unit,
        }));
        setInventory(initial);
      }

      setRequests(reqData || []);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryAndRequests();
  }, [hospitalId]);

  useWebSocket("resources", (event, data) => {
    if (event === "resource_request") {
      setRequests((prev) => [data, ...prev]);
    } else if (event === "resource_fulfilled") {
      setRequests((prev) =>
        prev.map((r) => (r.id === data.request_id ? { ...r, status: "fulfilled" } : r))
      );
    } else if (event === "RESOURCE_UPDATE" && data.hospital_id === hospitalId) {
      setInventory((prev) =>
        prev.map((item) =>
          item.name === data.resource_type ? { ...item, stock: data.available } : item
        )
      );
    } else if (event === "poll_sync") {
      fetchInventoryAndRequests();
    }
  });

  const updateStock = async (name: string, delta: number) => {
    if (!hospitalId) return;
    try {
      // Optimistic update
      setInventory((prev) =>
        prev.map((item) =>
          item.name === name ? { ...item, stock: Math.max(0, item.stock + delta) } : item
        )
      );
      // Persist to Neon PostgreSQL
      await api.updateHospitalResource({
        hospital_id: hospitalId,
        resource_type: name,
        delta,
      });
    } catch (err) {
      console.error("Failed to update resource:", err);
      fetchInventoryAndRequests();
    }
  };

  const handleFulfill = async (requestId: string) => {
    try {
      await api.fulfillResourceRequest(requestId);
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "fulfilled" } : r))
      );
    } catch (err) {
      console.error("Failed to fulfill request:", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--ink)]">
            MEDICAL INVENTORY & RESOURCE EXCHANGE
          </h1>
          <p className="font-mono text-xs text-gray-700">
            Node: <strong>{hospitalName}</strong> • Real-time Neon Database Sync
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInventoryAndRequests}
            className="p-1.5 border-2 border-[var(--ink)] bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0_var(--ink)] cursor-pointer"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[var(--accent)]" : ""}`} />
          </button>
          <NeobrutalistButton
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>REQUEST ASSET</span>
          </NeobrutalistButton>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        {/* Left Column (7 cols): On-site Hospital Stock Manager */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden min-h-0">
          <div className="neo-card flex-1 flex flex-col p-3 overflow-hidden min-h-0 border-2">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
              <span className="font-display text-sm font-bold uppercase">
                LOCAL ASSET INVENTORY (NEON POSTGRESQL)
              </span>
              <span className="neo-badge neo-badge-black text-[9px] py-0">
                LIVE STOCK
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {inventory.map((item) => {
                const isCritical = item.stock <= item.criticalThreshold;
                return (
                  <div
                    key={item.name}
                    className={`p-2.5 border-2 border-[var(--ink)] flex items-center justify-between gap-3 ${
                      isCritical
                        ? "bg-red-50 border-red-900 shadow-[2px_2px_0_var(--accent)]"
                        : "bg-neutral-50"
                    }`}
                  >
                    <div className="space-y-0.5 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="text-[var(--ink)]">{item.name}</strong>
                        {isCritical && (
                          <span className="neo-badge neo-badge-red text-[8px] py-0">
                            LOW STOCK
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 block">
                        {item.category} • Threshold: {item.criticalThreshold} {item.unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono">
                        <span className="font-display text-xl font-bold text-[var(--ink)] block">
                          {item.stock}
                        </span>
                        <span className="text-[9px] text-gray-500 uppercase">
                          {item.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateStock(item.name, 1)}
                          className="w-6 h-6 bg-white border border-[var(--ink)] flex items-center justify-center hover:bg-neutral-100 cursor-pointer text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          onClick={() => updateStock(item.name, -1)}
                          className="w-6 h-6 bg-white border border-[var(--ink)] flex items-center justify-center hover:bg-neutral-100 cursor-pointer text-xs font-bold"
                        >
                          -
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Regional Resource Exchange Feed */}
        <div className="lg:col-span-5 flex flex-col overflow-hidden min-h-0 gap-3">
          <div className="neo-card flex-1 flex flex-col p-3 overflow-hidden min-h-0 border-2">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
              <span className="font-display text-sm font-bold uppercase">
                REGIONAL SUPPLY REQUESTS
              </span>
              <span className="neo-badge neo-badge-black text-[9px] py-0">
                {requests.filter((r) => r.status === "open").length} OPEN
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {requests.length === 0 ? (
                <div className="text-center py-6 font-mono text-xs text-gray-400 italic">
                  No active regional supply requests.
                </div>
              ) : (
                requests.map((req) => {
                  const isOpen = req.status === "open";
                  return (
                    <div
                      key={req.id}
                      className={`p-2.5 border border-[var(--ink)] space-y-1.5 font-mono text-xs ${
                        isOpen ? "bg-neutral-50" : "bg-gray-100 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs uppercase text-[var(--ink)]">
                          {req.resource_type}
                        </span>
                        <span
                          className={`neo-badge text-[8px] py-0 ${
                            isOpen ? "neo-badge-red" : "neo-badge-black text-white"
                          }`}
                        >
                          {isOpen ? "OPEN" : "FULFILLED"}
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px] text-gray-600">
                        <span>Facility: <strong>{req.requester_hospital_name || req.requester_hospital_id}</strong></span>
                        <span className="font-bold text-[var(--accent)]">
                          QTY: {req.quantity}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                        <span className="text-[9px] text-gray-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {Math.round((Date.now() - req.timestamp) / 60000)}m ago
                        </span>

                        {isOpen && req.requester_hospital_id !== hospitalId && (
                          <NeobrutalistButton
                            variant="black"
                            size="sm"
                            onClick={() => handleFulfill(req.id)}
                            className="text-[10px] py-0.5 px-2"
                          >
                            FULFILL ASSET
                          </NeobrutalistButton>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick info note */}
          <div className="p-2 bg-neutral-100 border border-[var(--ink)] text-[10px] font-mono shrink-0 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <span>Swytchcode inter-facility manifests are signed automatically upon dispatch.</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ResourceRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRequestCreated={fetchInventoryAndRequests}
      />
    </div>
  );
}
