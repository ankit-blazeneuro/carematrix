"use client";

import React, { useEffect, useState } from "react";
import { HeatmapHospital } from "@/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Layers } from "lucide-react";

export function HeatMapCanvas() {
  const [hospitals, setHospitals] = useState<HeatmapHospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HeatmapHospital | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.getHeatmap();
        setHospitals(data || []);
        if (data && data.length > 0) setSelectedHospital(data[0]);
      } catch (err) {
        console.error("Failed to load heatmap data:", err);
      }
    };
    loadData();
  }, []);

  useWebSocket("heatmap", (event, data) => {
    if (event === "heatmap_update" && Array.isArray(data)) {
      setHospitals(data);
    }
  });

  const getDemandColor = (pct: number) => {
    if (pct >= 85) return { bg: "bg-[var(--accent)]", text: "text-white", label: "CRITICAL LOAD" };
    if (pct >= 70) return { bg: "bg-neutral-800", text: "text-white", label: "HEAVY INFLUX" };
    return { bg: "bg-neutral-300", text: "text-black", label: "OPTIMAL" };
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Map Control Header */}
      <div className="flex items-center justify-between border-b-2 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--ink)] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--accent)]" />
            REGIONAL CAPACITY HEATMAP RADAR
          </h1>
          <p className="text-xs font-mono text-gray-700">
            Geospatial Bed Occupancy Rate (BOR) telemetry across NCR Cluster-4
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5">
          <span className="neo-badge neo-badge-black text-[9px] py-0">&lt; 70% OPTIMAL</span>
          <span className="neo-badge neo-badge-red text-[9px] py-0">&gt; 85% CRITICAL</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        {/* Interactive Cluster Grid & Visual Map (8 cols) */}
        <div className="lg:col-span-8 neo-card p-0 bg-neutral-100 border-3 border-[var(--ink)] overflow-hidden flex flex-col relative min-h-0 shadow-[5px_5px_0_var(--ink)]">
          <div className="p-2.5 bg-white text-[var(--ink)] border-b-2 border-[var(--ink)] flex items-center justify-between shrink-0">
            <span className="font-display text-xs tracking-wider uppercase text-[var(--accent)] font-bold">
              GEOSPATIAL CLUSTER RADAR (NCR SECTOR-4)
            </span>
            <span className="text-[10px] font-mono font-bold text-gray-600">
              COORDINATES: 28.44°N, 77.01°E
            </span>
          </div>

          {/* Grid Canvas */}
          <div className="flex-1 p-4 flex items-center justify-center relative bg-[radial-gradient(#bbb_1px,transparent_1px)] [background-size:14px_14px] overflow-y-auto">
            <div className="grid grid-cols-3 gap-3 w-full z-10">
              {hospitals.map((hosp) => {
                const badge = getDemandColor(hosp.demand_pct);
                const isSelected = selectedHospital?.id === hosp.id;
                return (
                  <div
                    key={hosp.id}
                    onClick={() => setSelectedHospital(hosp)}
                    className={`neo-card p-3 cursor-pointer transition-all border-2 ${
                      isSelected
                        ? "bg-white border-3 border-[var(--accent)] shadow-[4px_4px_0_var(--accent)]"
                        : "bg-white hover:bg-neutral-50 border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-display text-sm font-bold uppercase truncate text-[var(--ink)]">
                        {hosp.name}
                      </span>
                      <span className={`w-2.5 h-2.5 rounded-full ${badge.bg}`} />
                    </div>

                    <div className="space-y-1 font-mono text-[11px] text-[var(--ink)]">
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold">BOR Load:</span>
                        <strong>{hosp.demand_pct}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold">Free Beds:</span>
                        <strong className="text-[var(--accent)]">{hosp.available_beds} / {hosp.total_beds}</strong>
                      </div>

                      <div className="w-full bg-gray-200 h-1.5 border border-black overflow-hidden mt-1">
                        <div className={`h-full ${badge.bg}`} style={{ width: `${hosp.demand_pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-2 bg-white text-gray-700 text-[10px] font-mono border-t-2 border-[var(--ink)] flex items-center justify-between shrink-0 font-bold">
            <span>NETWORK TELEMETRY: {hospitals.length} HOSPITALS CONNECTED</span>
            <span className="text-[var(--accent)] font-bold">AUTOMATED RE-ROUTING ACTIVE</span>
          </div>
        </div>

        {/* Selected Facility Inspector (4 cols) */}
        <div className="lg:col-span-4 neo-card p-3 border-3 border-[var(--ink)] bg-white flex flex-col justify-between overflow-y-auto min-h-0 space-y-3 shadow-[5px_5px_0_var(--ink)]">
          <div className="space-y-3">
            <div className="border-b-2 border-[var(--ink)] pb-2">
              <span className="neo-badge neo-badge-black text-[8px] py-0 mb-1">
                FACILITY INSPECTOR
              </span>
              <h3 className="font-display text-xl font-bold uppercase text-[var(--ink)]">
                {selectedHospital ? selectedHospital.name : "SELECT NODE"}
              </h3>
              <p className="text-[10px] font-mono font-bold text-gray-600">
                Identifier: {selectedHospital?.id}
              </p>
            </div>

            {selectedHospital && (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-neutral-50 border-2 border-[var(--ink)]">
                    <span className="text-[9px] text-gray-600 font-bold uppercase block">TOTAL CAPACITY</span>
                    <span className="font-display text-xl font-bold text-[var(--ink)]">
                      {selectedHospital.total_beds}
                    </span>
                  </div>
                  <div className="p-2 bg-neutral-50 border-2 border-[var(--ink)]">
                    <span className="text-[9px] text-gray-600 font-bold uppercase block">AVAILABLE BEDS</span>
                    <span className="font-display text-xl font-bold text-[var(--accent)]">
                      {selectedHospital.available_beds}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 border-2 border-[var(--ink)] bg-neutral-50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[var(--ink)]">OCCUPANCY (BOR)</span>
                    <span className="neo-badge neo-badge-red text-[8px] py-0">
                      {selectedHospital.demand_pct}%
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-700 leading-tight">
                    {selectedHospital.demand_pct > 85
                      ? "Critical triage capacity threshold exceeded. Real-time patient diversion active."
                      : "Operating within normal regional load parameters."}
                  </p>
                </div>

                <div className="pt-1 text-[10px] text-gray-600 font-bold space-y-0.5 border-t border-gray-200">
                  <div>• Latitude: {selectedHospital.lat}° N</div>
                  <div>• Longitude: {selectedHospital.lng}° E</div>
                  <div>• Real-time WebSocket Protocol Active</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
