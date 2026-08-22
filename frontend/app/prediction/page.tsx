"use client";

import React, { useState, useEffect } from "react";
import { useHospital } from "@/context/HospitalContext";
import { MLPrediction } from "@/types";
import { api } from "@/lib/api";
import { executeSwytchcodeAction } from "@/lib/swytchcode_client";
import { NeobrutalistCard } from "@/components/NeobrutalistCard";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import { Calendar, Clock, BellRing } from "lucide-react";

export default function PredictionPage() {
  const { hospitalId, hospitalName } = useHospital();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [prediction, setPrediction] = useState<MLPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [alertDispatched, setAlertDispatched] = useState(false);

  const fetchPrediction = async (date: string) => {
    if (!hospitalId) return;
    setIsLoading(true);
    try {
      const data = await api.predictSurge(hospitalId, date);
      setPrediction(data);
    } catch (err) {
      console.error("Failed to load surge prediction:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction(selectedDate);
  }, [hospitalId, selectedDate]);

  const handleDispatchSurgeAlert = async () => {
    if (!prediction || !hospitalId) return;
    setAlertDispatched(true);
    try {
      await executeSwytchcodeAction("carematrix.surge_alert.dispatch", {
        hospital_id: hospitalId,
        occupancy_pct: prediction.bor_projected_pct,
        predicted_influx: prediction.predicted_influx,
        urgency: prediction.status,
      });
    } catch (err) {
      console.error("Failed to dispatch surge alert:", err);
    }
  };

  const stages = [
    { key: "transport", label: "TRANSIT", defaultMin: 15.0 },
    { key: "registration", label: "REGISTRATION", defaultMin: 15.1 },
    { key: "triage", label: "TRIAGE", defaultMin: 21.4 },
    { key: "consultation", label: "CONSULT", defaultMin: 36.3 },
    { key: "pharmacy", label: "PHARMACY", defaultMin: 17.7 },
    { key: "billing", label: "DISCHARGE", defaultMin: 14.3 },
  ];

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--ink)]">
            SURGE & QUEUE SIMULATION
          </h1>
          <p className="font-mono text-xs text-gray-700">
            Node: <strong>{hospitalName}</strong> • Influx Intelligence Engine
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border-2 border-[var(--ink)] px-2 py-1 shadow-[1.5px_1.5px_0_var(--ink)] font-mono text-xs">
            <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-xs"
            />
          </div>
          <NeobrutalistButton
            variant="black"
            size="sm"
            onClick={() => fetchPrediction(selectedDate)}
            disabled={isLoading}
            className="text-xs py-1 px-2.5"
          >
            {isLoading ? "COMPUTING..." : "RUN MODEL"}
          </NeobrutalistButton>
        </div>
      </div>

      {prediction && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
          {/* Top Key Metrics Row */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            {/* 1. BOR Gauge Meter */}
            <div className="neo-card p-3 bg-white border-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-gray-600">
                  BED OCCUPANCY (BOR)
                </span>
                <span className="neo-badge neo-badge-red text-[8px] py-0">
                  {prediction.status}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl font-bold text-[var(--ink)]">
                  {prediction.bor_projected_pct}%
                </span>
                <span className="text-[10px] font-mono text-gray-500">PROJECTED MAX</span>
              </div>
              <div className="w-full bg-gray-200 h-2 border border-black overflow-hidden">
                <div
                  className="bg-[var(--accent)] h-full"
                  style={{ width: `${prediction.bor_projected_pct}%` }}
                />
              </div>
              {prediction.status === "CRITICAL" && (
                <NeobrutalistButton
                  variant="primary"
                  size="sm"
                  onClick={handleDispatchSurgeAlert}
                  disabled={alertDispatched}
                  className="w-full text-[10px] py-1 mt-1 flex items-center justify-center gap-1"
                >
                  <BellRing className="w-3 h-3" />
                  <span>{alertDispatched ? "ALERT SENT ✓" : "DISPATCH SURGE ALERT"}</span>
                </NeobrutalistButton>
              )}
            </div>

            {/* 2. Projected Patient Influx */}
            <div className="neo-card p-3 bg-white border-2 space-y-1 font-mono">
              <span className="text-[10px] font-bold uppercase text-gray-600 block">
                PROJECTED 24H INTAKE
              </span>
              <span className="font-display text-3xl font-bold text-[var(--ink)] block">
                {prediction.predicted_influx}
              </span>
              <div className="p-1.5 bg-neutral-50 border border-[var(--ink)] text-[10px] flex justify-between">
                <span>Surge Delta:</span>
                <strong className="text-[var(--accent)]">+{prediction.predicted_influx - 95} pts</strong>
              </div>
            </div>

            {/* 3. Total Est. Wait Time */}
            <div className="neo-card p-3 bg-white border-2 space-y-1 font-mono">
              <span className="text-[10px] font-bold uppercase text-gray-600 block">
                EST. ADMISSION QUEUE
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold text-[var(--accent)]">
                  {Math.round(prediction.total_wait_time_minutes)}
                </span>
                <span className="text-xs font-bold text-gray-600">MINS</span>
              </div>
              <div className="p-1.5 bg-neutral-50 border border-[var(--ink)] text-[10px]">
                Bottleneck: <strong>PHYSICIAN CONSULT</strong> (~36m)
              </div>
            </div>
          </div>

          {/* 6-Stage Queue Simulator Timeline */}
          <div className="neo-card p-3 border-2 bg-white shrink-0">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1 mb-2">
              <span className="font-display text-xs font-bold uppercase">
                6-STAGE QUEUE PIPELINE SIMULATOR
              </span>
              <span className="neo-badge neo-badge-black text-[8px] py-0">
                DISCRETE EVENT
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {stages.map((st, i) => {
                const waitTime =
                  (prediction.simulated_wait_times_minutes as any)[st.key] ??
                  (prediction.simulated_wait_times_minutes as any)["t_" + st.key] ??
                  st.defaultMin;

                return (
                  <div
                    key={st.key}
                    className="p-2 border border-[var(--ink)] bg-neutral-50 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[9px] font-bold text-[var(--accent)]">
                      <span>0{i + 1}</span>
                      <Clock className="w-2.5 h-2.5 text-gray-400" />
                    </div>
                    <div className="text-[10px] font-display uppercase truncate text-[var(--ink)]">
                      {st.label}
                    </div>
                    <div className="font-display text-base font-bold text-[var(--ink)]">
                      {waitTime.toFixed(1)}<span className="text-[9px] font-mono text-gray-500 font-normal">m</span>
                    </div>
                    <div className="w-full bg-gray-200 h-1 border border-black overflow-hidden">
                      <div
                        className="bg-[var(--accent)] h-full"
                        style={{ width: `${Math.min((waitTime / 40) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Triage Breakdown Chart */}
          <div className="neo-card p-3 border-2 bg-white flex-1 overflow-y-auto min-h-0 space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1 mb-1">
              <span className="font-display text-xs font-bold uppercase">
                EMERGENCY TRIAGE BREAKDOWN
              </span>
              <span className="text-[10px] font-mono text-gray-500">
                142 TOTAL CASELOAD
              </span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              {Object.entries(prediction.ed_triage_breakdown).map(([tier, count]) => {
                const total = Object.values(prediction.ed_triage_breakdown).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / total) * 100);
                const formattedTier = tier.replace(/_/g, " ").toUpperCase();
                const barColor = tier.toLowerCase().includes("immediate")
                  ? "bg-[var(--accent)]"
                  : tier.toLowerCase().includes("very")
                  ? "bg-neutral-800"
                  : "bg-neutral-400";

                return (
                  <div key={tier} className="space-y-0.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>{formattedTier}</span>
                      <span>{count} PTS ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 border border-black overflow-hidden">
                      <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
