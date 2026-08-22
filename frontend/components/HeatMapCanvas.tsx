"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { HeatmapHospital } from "@/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Layers, Flame, X, MapPin } from "lucide-react";

// Dynamic import for Leaflet map component (SSR safe)
const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-100 font-mono text-xs text-gray-500 font-bold">
      Loading Leaflet NCR Hospital Radar Map...
    </div>
  ),
});

function zoneColor(demand: number): { fill: string; stroke: string; label: string } {
  if (demand >= 80) return { fill: "#dc2626", stroke: "#991b1b", label: "CRITICAL" };
  if (demand >= 65) return { fill: "#ea580c", stroke: "#c2410c", label: "HIGH" };
  if (demand >= 45) return { fill: "#eab308", stroke: "#ca8a04", label: "MODERATE" };
  return { fill: "#16a34a", stroke: "#15803d", label: "NORMAL" };
}

function statusLabel(demand: number): string {
  if (demand >= 80) return "Critical Surge";
  if (demand >= 65) return "High Demand";
  if (demand >= 45) return "Moderate Load";
  return "Stable";
}

function circleRadius(total: number): number {
  if (total >= 200) return 2200;
  if (total >= 150) return 1700;
  if (total >= 100) return 1300;
  return 900;
}

export function HeatMapCanvas() {
  const [hospitals, setHospitals] = useState<HeatmapHospital[]>([]);
  const [selected, setSelected] = useState<HeatmapHospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MODERATE" | "NORMAL">("ALL");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getHeatmap();
        setHospitals(data || []);
      } catch (err) {
        console.error("Failed to load heatmap:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);

  useWebSocket("heatmap", (event, data) => {
    if (event === "heatmap_update" && Array.isArray(data)) {
      setHospitals(data);
    }
  });

  const getDemand = (h: HeatmapHospital) => h.demand_pct ?? h.demand ?? 50;

  const visible = hospitals.filter((h) => {
    if (filter === "ALL") return true;
    return zoneColor(getDemand(h)).label === filter;
  });

  const criticalCount = hospitals.filter((h) => getDemand(h) >= 80).length;
  const highCount = hospitals.filter((h) => getDemand(h) >= 65 && getDemand(h) < 80).length;
  const modCount = hospitals.filter((h) => getDemand(h) >= 45 && getDemand(h) < 65).length;
  const normCount = hospitals.filter((h) => getDemand(h) < 45).length;

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-3 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight text-[var(--ink)] flex items-center gap-2">
              <Flame className="w-5 h-5 text-[var(--accent)]" />
              REGIONAL DEMAND HEATMAP — NCR MESH
            </h1>
            <span className="neo-badge neo-badge-black text-[9px]">10s REFRESH</span>
          </div>
          <p className="font-mono text-xs text-gray-700">
            Real-time Bed Occupancy Rate (BOR) geospatial telemetry across NCR healthcare facilities
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
          <button
            className={`neo-badge cursor-pointer transition-transform ${
              filter === "CRITICAL" ? "neo-badge-red scale-105 shadow-[2px_2px_0_var(--ink)]" : "neo-badge-white"
            }`}
            onClick={() => setFilter(filter === "CRITICAL" ? "ALL" : "CRITICAL")}
          >
            <span className="w-2 h-2 rounded-full bg-red-600 mr-1" />
            {criticalCount} Critical
          </button>

          <button
            className={`neo-badge cursor-pointer transition-transform ${
              filter === "HIGH" ? "neo-badge-black text-white bg-orange-600 scale-105 shadow-[2px_2px_0_var(--ink)]" : "neo-badge-white"
            }`}
            onClick={() => setFilter(filter === "HIGH" ? "ALL" : "HIGH")}
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 mr-1" />
            {highCount} High
          </button>

          <button
            className={`neo-badge cursor-pointer transition-transform ${
              filter === "MODERATE" ? "neo-badge-white bg-yellow-400 text-black scale-105 shadow-[2px_2px_0_var(--ink)]" : "neo-badge-white"
            }`}
            onClick={() => setFilter(filter === "MODERATE" ? "ALL" : "MODERATE")}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1" />
            {modCount} Moderate
          </button>

          <button
            className={`neo-badge cursor-pointer transition-transform ${
              filter === "NORMAL" ? "neo-badge-white bg-emerald-600 text-white scale-105 shadow-[2px_2px_0_var(--ink)]" : "neo-badge-white"
            }`}
            onClick={() => setFilter(filter === "NORMAL" ? "ALL" : "NORMAL")}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1" />
            {normCount} Normal
          </button>
        </div>
      </div>

      {/* Main 2-Column Split Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        
        {/* Left Column (8 cols): Leaflet Interactive Radar Map */}
        <div className="lg:col-span-8 neo-card p-0 bg-neutral-900 border-2 border-[var(--ink)] overflow-hidden flex flex-col relative min-h-0">
          <div className="p-2 bg-[var(--ink)] text-white border-b border-white/20 flex items-center justify-between shrink-0 font-mono text-xs">
            <span className="font-display text-xs tracking-wider uppercase text-[var(--accent)] font-bold">
              GEOSPATIAL CLUSTER RADAR (NCR SECTOR-4)
            </span>
            <span className="text-[10px] text-white/60">
              BOUNDS: 28.43°N - 28.63°N, 76.98°E - 77.36°E
            </span>
          </div>

          <div className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
            <MapInner
              hospitals={visible}
              selected={selected}
              onSelect={setSelected}
              zoneColor={zoneColor}
              circleRadius={circleRadius}
            />
          </div>

          <div className="p-2 bg-[var(--ink)] text-white/80 text-[10px] font-mono border-t border-white/20 flex items-center justify-between shrink-0">
            <span>NETWORK RADAR: {hospitals.length} HOSPITALS CONNECTED</span>
            <span className="text-[var(--accent)] font-bold">REAL-TIME TELEMETRY ACTIVE</span>
          </div>
        </div>

        {/* Right Column (4 cols): Hospital List & Inspector Card */}
        <div className="lg:col-span-4 flex flex-col gap-3 overflow-hidden min-h-0">
          
          {/* Hospital List */}
          <div className="neo-card flex-1 flex flex-col p-3 bg-white border-2 border-[var(--ink)] overflow-hidden min-h-0">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
              <span className="font-display text-sm font-bold uppercase">
                NCR HOSPITAL NODES
              </span>
              <span className="neo-badge neo-badge-black text-[8px]">
                {visible.length} NODES
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
              {visible
                .sort((a, b) => getDemand(b) - getDemand(a))
                .map((h) => {
                  const dPct = getDemand(h);
                  const { fill } = zoneColor(dPct);
                  const isSelected = selected?.id === h.id;

                  return (
                    <div
                      key={h.id}
                      onClick={() => setSelected(isSelected ? null : h)}
                      className={`p-2 border-2 border-[var(--ink)] flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? "bg-neutral-900 text-white shadow-[2px_2px_0_var(--accent)] scale-[1.01]"
                          : "bg-white hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: fill }} />
                        <span className="font-bold truncate">{h.name}</span>
                      </div>
                      <span className="font-bold shrink-0 ml-2" style={{ color: isSelected ? "#ffffff" : fill }}>
                        {dPct}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Detailed Inspector Side-Card */}
          {selected && (() => {
            const dPct = getDemand(selected);
            const totalBeds = selected.total_beds ?? selected.total ?? 100;
            const availBeds = selected.available_beds ?? selected.available ?? 20;
            const occupiedBeds = totalBeds - availBeds;
            const { fill, stroke, label } = zoneColor(dPct);

            return (
              <div className="neo-card p-3 bg-white border-3 border-[var(--ink)] shrink-0 space-y-2.5 font-mono text-xs shadow-[4px_4px_0_var(--ink)]">
                <div className="flex justify-between items-start border-b-2 border-[var(--ink)] pb-1.5">
                  <div>
                    <span className="text-[9px] font-bold text-gray-500 uppercase block">NODE INSPECTOR</span>
                    <h3 className="font-display text-base font-bold uppercase text-[var(--ink)]">
                      {selected.name}
                    </h3>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 hover:bg-neutral-100 border border-[var(--ink)]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-gray-600 font-bold text-[11px]">UTILISATION RATE:</span>
                  <span className="font-display text-2xl font-bold" style={{ color: fill }}>
                    {dPct}% ({label})
                  </span>
                </div>

                <div className="w-full bg-gray-200 h-2 border border-black overflow-hidden">
                  <div className="h-full" style={{ width: `${dPct}%`, background: fill }} />
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center pt-1 font-bold text-[10px]">
                  <div className="p-1.5 bg-neutral-50 border border-[var(--ink)]">
                    <span className="text-[8px] text-gray-500 uppercase block">TOTAL BEDS</span>
                    <span className="font-display text-sm text-[var(--ink)]">{totalBeds}</span>
                  </div>

                  <div className="p-1.5 bg-emerald-50 border border-emerald-900">
                    <span className="text-[8px] text-emerald-800 uppercase block">FREE BEDS</span>
                    <span className="font-display text-sm text-emerald-700">{availBeds}</span>
                  </div>

                  <div className="p-1.5 bg-red-50 border border-red-900">
                    <span className="text-[8px] text-red-800 uppercase block">OCCUPIED</span>
                    <span className="font-display text-sm text-red-700">{occupiedBeds}</span>
                  </div>
                </div>

                <div className="text-[10px] text-gray-600 flex items-center justify-between border-t border-gray-200 pt-1.5">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[var(--accent)]" />
                    {selected.lat.toFixed(3)}°N, {selected.lng.toFixed(3)}°E
                  </span>
                  <span className="font-bold text-[var(--ink)]">{statusLabel(dPct)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
