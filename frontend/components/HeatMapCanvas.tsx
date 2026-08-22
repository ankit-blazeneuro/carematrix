"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { HeatmapHospital } from "@/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Layers, MapPin, Building2, Radio } from "lucide-react";

// Dynamically import OpenStreetMap without SSR
const OpenStreetMapComponent = dynamic(
  () => import("@/components/OpenStreetMapComponent"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100 font-mono text-xs text-neutral-600 gap-2">
        <Radio className="w-6 h-6 text-[var(--accent)] animate-spin" />
        <span>INITIALIZING OPENSTREETMAP GEOSPATIAL TILES...</span>
      </div>
    ),
  }
);

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

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Map Control Header */}
      <div className="flex items-center justify-between border-b-2 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--ink)] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--accent)]" />
            OPENSTREETMAP REGIONAL CAPACITY HEATMAP
          </h1>
          <p className="text-xs font-mono text-gray-700">
            Geospatial Bed Occupancy Rate (BOR) telemetry plotted live via OpenStreetMap
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 font-mono">
          <span className="neo-badge neo-badge-white text-[9px] py-0 border-2 border-black">&lt; 70% OPTIMAL</span>
          <span className="neo-badge neo-badge-black text-[9px] py-0">70-84% HEAVY</span>
          <span className="neo-badge neo-badge-red text-[9px] py-0">&gt; 85% CRITICAL</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        {/* Interactive OpenStreetMap Canvas (8 cols) */}
        <div className="lg:col-span-8 neo-card p-0 bg-white border-3 border-[var(--ink)] overflow-hidden flex flex-col relative min-h-0 shadow-[5px_5px_0_var(--ink)]">
          <div className="p-2.5 bg-white text-[var(--ink)] border-b-2 border-[var(--ink)] flex items-center justify-between shrink-0 z-10">
            <span className="font-display text-xs tracking-wider uppercase text-[var(--accent)] font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              LIVE OPENSTREETMAP TELEMETRY
            </span>
            <span className="text-[10px] font-mono font-bold text-gray-600">
              CLUSTER: NCR SECTOR-4 (28.44°N, 77.01°E)
            </span>
          </div>

          {/* Map View */}
          <div className="flex-1 w-full h-full min-h-[300px] relative overflow-hidden">
            <OpenStreetMapComponent
              hospitals={hospitals}
              selectedHospital={selectedHospital}
              onSelectHospital={(hosp) => setSelectedHospital(hosp)}
            />
          </div>

          <div className="p-2 bg-white text-gray-700 text-[10px] font-mono border-t-2 border-[var(--ink)] flex items-center justify-between shrink-0 font-bold z-10">
            <span>NETWORK NODES: {hospitals.length} HOSPITALS PLOTTED</span>
            <span className="text-[var(--accent)] font-bold">CLICK MARKER TO INSPECT</span>
          </div>
        </div>

        {/* Selected Facility Inspector & Quick List (4 cols) */}
        <div className="lg:col-span-4 neo-card p-3 border-3 border-[var(--ink)] bg-white flex flex-col justify-between overflow-y-auto min-h-0 space-y-3 shadow-[5px_5px_0_var(--ink)]">
          <div className="space-y-3">
            <div className="border-b-2 border-[var(--ink)] pb-2">
              <span className="neo-badge neo-badge-black text-[8px] py-0 mb-1">
                FACILITY INSPECTOR
              </span>
              <h3 className="font-display text-xl font-bold uppercase text-[var(--ink)] truncate">
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
                    <span className="text-[9px] text-gray-600 font-bold uppercase block">TOTAL BEDS</span>
                    <span className="font-display text-xl font-bold text-[var(--ink)]">
                      {selectedHospital.total_beds}
                    </span>
                  </div>
                  <div className="p-2 bg-neutral-50 border-2 border-[var(--ink)]">
                    <span className="text-[9px] text-gray-600 font-bold uppercase block">AVAILABLE</span>
                    <span className="font-display text-xl font-bold text-[var(--accent)]">
                      {selectedHospital.available_beds}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 border-2 border-[var(--ink)] bg-neutral-50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[var(--ink)]">OCCUPANCY (BOR)</span>
                    <span className={`neo-badge text-[8px] py-0 ${selectedHospital.demand_pct >= 85 ? 'neo-badge-red' : 'neo-badge-black'}`}>
                      {selectedHospital.demand_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-1.5 border border-black overflow-hidden mt-1">
                    <div
                      className={`h-full ${selectedHospital.demand_pct >= 85 ? 'bg-[var(--accent)]' : 'bg-black'}`}
                      style={{ width: `${selectedHospital.demand_pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-700 leading-tight pt-1">
                    {selectedHospital.demand_pct >= 85
                      ? "Critical triage capacity threshold exceeded. Real-time patient diversion active."
                      : "Operating within normal regional load parameters."}
                  </p>
                </div>

                <div className="pt-1 text-[10px] text-gray-600 font-bold space-y-0.5 border-t border-gray-200">
                  <div>• Latitude: {selectedHospital.lat}° N</div>
                  <div>• Longitude: {selectedHospital.lng}° E</div>
                  <div>• Map Tile Source: OpenStreetMap (OSM)</div>
                </div>
              </div>
            )}

            {/* Quick Switch List */}
            <div className="border-t-2 border-[var(--ink)] pt-2 space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-gray-600 block">
                FACILITIES ON MAP
              </span>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {hospitals.map((hosp) => (
                  <button
                    key={hosp.id}
                    onClick={() => setSelectedHospital(hosp)}
                    className={`w-full text-left p-1.5 border text-[11px] font-mono flex items-center justify-between cursor-pointer ${
                      selectedHospital?.id === hosp.id
                        ? "border-2 border-[var(--accent)] bg-red-50 font-bold text-[var(--accent)]"
                        : "border-[var(--ink)] bg-neutral-50 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="truncate flex items-center gap-1">
                      <Building2 className="w-3 h-3 shrink-0" />
                      {hosp.name}
                    </span>
                    <span className="shrink-0">{hosp.demand_pct}%</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
