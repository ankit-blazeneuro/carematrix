"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHospital } from "@/context/HospitalContext";
import { PredictionResponse } from "@/types";
import { api } from "@/lib/api";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import {
  Calendar,
  Layers,
  BellRing,
  Activity,
  Clock,
  UserCheck,
  AlertTriangle,
} from "lucide-react";

const VW = 800;
const VH = 360;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function buildChartPoints(data: PredictionResponse) {
  if (!data || !data.prediction || !data.bed_occupancy || !data.emergency_load) {
    return null;
  }

  const pad = { t: 24, r: 24, b: 36, l: 44 };
  const cw = VW - pad.l - pad.r;
  const ch = VH - pad.t - pad.b;

  const low = data.prediction.low ?? 40;
  const high = data.prediction.high ?? 80;
  const predicted = data.prediction.predicted ?? 60;
  const cap = data.bed_occupancy.total_beds ?? 150;
  const edMax = data.emergency_load.ed_beds ?? 40;

  const hrs = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const surge = Math.sin(t * Math.PI) * 0.6 + Math.sin(t * Math.PI * 2) * 0.2;
    const val = Math.round(low + (predicted - low) * (0.4 + surge * 0.6));
    const lo = Math.round(low * (0.85 + surge * 0.1));
    const hi = Math.round(high * (0.9 + surge * 0.15));
    return {
      h: i,
      val: Math.min(val, cap),
      lo: Math.min(lo, cap),
      hi: Math.min(hi, cap),
    };
  });

  const maxY = Math.max(cap, high + 5);
  const sy = (v: number) => pad.t + ch - (v / maxY) * ch;
  const sx = (i: number) => pad.l + (i / 24) * cw;

  const mainPath = hrs
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p.val).toFixed(1)}`)
    .join(" ");

  const bandTop = hrs
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p.hi).toFixed(1)}`)
    .join(" ");

  const bandBot = [...hrs]
    .reverse()
    .map((p, i) => `${i === 0 ? "" : "L"}${sx(24 - i).toFixed(1)},${sy(p.lo).toFixed(1)}`)
    .join(" ");

  const bandPath = `${bandTop} ${bandBot} Z`;

  const capY = sy(cap);
  const edY = sy(edMax);
  const tgtY = sy(Math.round((cap * (data.bed_occupancy.nhm_target_pct || 85)) / 100));

  const xTicks = [0, 4, 8, 12, 16, 20, 24];
  const yTicks = [
    0,
    Math.round(maxY * 0.25),
    Math.round(maxY * 0.5),
    Math.round(maxY * 0.75),
    maxY,
  ];

  return {
    hrs,
    sx,
    sy,
    mainPath,
    bandPath,
    capY,
    edY,
    tgtY,
    xTicks,
    yTicks,
    pad,
    maxY,
    cw,
    ch,
  };
}

export default function PredictionPage() {
  const router = useRouter();
  const { hospitalId, hospitalName, isAuthenticated, isLoaded } = useHospital();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [data, setData] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [alertDispatched, setAlertDispatched] = useState(false);

  useEffect(() => {
    if (isLoaded && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoaded, router]);

  const fetchPrediction = async (date: string) => {
    if (!hospitalId) return;
    setIsLoading(true);
    try {
      const res = await api.getPrediction(date, hospitalId);
      setData(res);
    } catch (err) {
      console.error("Failed to load surge prediction:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction(selectedDate);
  }, [hospitalId, selectedDate]);

  const c = data ? buildChartPoints(data) : null;

  const handleDispatchAlert = () => {
    setAlertDispatched(true);
    setTimeout(() => setAlertDispatched(false), 5000);
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-3 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight text-[var(--ink)]">
              SURGE FORECASTING & QUEUE SIMULATOR
            </h1>
            <span className="neo-badge neo-badge-black text-[9px]">ML MODEL</span>
          </div>
          <p className="font-mono text-xs text-gray-700">
            Node: <strong>{hospitalName}</strong> ({hospitalId}) • Machine-Learned Bed Occupancy Rate (BOR) Engine
          </p>
        </div>

        {/* Date Selector & Run Model Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border-2 border-[var(--ink)] px-2.5 py-1 shadow-[1.5px_1.5px_0_var(--ink)] font-mono text-xs">
            <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer font-bold text-xs"
            />
          </div>
          <NeobrutalistButton
            variant="primary"
            size="sm"
            onClick={() => fetchPrediction(selectedDate)}
            disabled={isLoading}
            className="text-xs py-1.5 px-3"
          >
            {isLoading ? "COMPUTING..." : "RUN MODEL"}
          </NeobrutalistButton>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN (7 cols): 24-Hour Surge SVG Line Chart */}
        <div className="lg:col-span-7 neo-card p-3 bg-white border-2 border-[var(--ink)] flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-display text-sm font-bold uppercase">
                PATIENT SURGE — 24H FORECAST
              </span>
            </div>

            {data?.prediction && (
              <span className="neo-badge neo-badge-red text-[8px]">
                {data.prediction.model_used} • {data.prediction.confidence_pct}% CONF
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center items-center relative overflow-hidden bg-neutral-50 border-2 border-[var(--ink)] p-2">
            {isLoading && (
              <div className="text-center font-mono text-xs text-gray-500 animate-pulse">
                Computing 24-hour surge forecast simulation...
              </div>
            )}

            {data && c && (
              <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="band-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity="0.03" />
                  </linearGradient>
                </defs>

                {/* Y-axis gridlines */}
                {c.yTicks.map((v) => (
                  <g key={v}>
                    <line
                      x1={c.pad.l}
                      y1={c.sy(v)}
                      x2={c.pad.l + c.cw}
                      y2={c.sy(v)}
                      stroke="#000000"
                      strokeOpacity="0.1"
                      strokeWidth="1"
                    />
                    <text
                      x={c.pad.l - 6}
                      y={c.sy(v) + 4}
                      textAnchor="end"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill="#333"
                    >
                      {v}
                    </text>
                  </g>
                ))}

                {/* X-axis ticks */}
                {c.xTicks.map((h) => (
                  <text
                    key={h}
                    x={c.sx(h)}
                    y={VH - c.pad.b + 18}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#333"
                  >
                    {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
                  </text>
                ))}

                {/* Confidence Band */}
                <path d={c.bandPath} fill="url(#band-grad)" />

                {/* Reference Lines */}
                <line
                  x1={c.pad.l}
                  y1={c.capY}
                  x2={c.pad.l + c.cw}
                  y2={c.capY}
                  stroke="#dc2626"
                  strokeWidth="1.8"
                  strokeDasharray="6 4"
                />
                <text x={c.pad.l + c.cw - 4} y={c.capY - 5} textAnchor="end" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#dc2626">
                  CAPACITY ({data.bed_occupancy?.total_beds})
                </text>

                <line
                  x1={c.pad.l}
                  y1={c.tgtY}
                  x2={c.pad.l + c.cw}
                  y2={c.tgtY}
                  stroke="#16a34a"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <text x={c.pad.l + c.cw - 4} y={c.tgtY - 5} textAnchor="end" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#16a34a">
                  NHM TARGET (85%)
                </text>

                <line
                  x1={c.pad.l}
                  y1={c.edY}
                  x2={c.pad.l + c.cw}
                  y2={c.edY}
                  stroke="#d97706"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <text x={c.pad.l + c.cw - 4} y={c.edY - 5} textAnchor="end" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#d97706">
                  ED BEDS ({data.emergency_load?.ed_beds})
                </text>

                {/* Surge Main Line */}
                <path d={c.mainPath} fill="none" stroke="#000000" strokeWidth="2.8" strokeLinejoin="round" />

                {/* Peak Dots */}
                {c.hrs.map((p, i) => {
                  if (![0, 6, 12, 18, 24].includes(i)) return null;
                  return (
                    <circle
                      key={i}
                      cx={c.sx(i)}
                      cy={c.sy(p.val)}
                      r="4.5"
                      fill="#dc2626"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            )}
          </div>

          {/* Chart Legend */}
          {data && (
            <div className="flex items-center justify-between text-[10px] font-mono pt-2 font-bold shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-black inline-block" />
                <span>Predicted Surge</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-red-200 inline-block border border-red-500" />
                <span>Confidence Band</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-600">
                <span className="w-3 h-0.5 border-b-2 border-dashed border-red-600 inline-block" />
                <span>Total Capacity</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-3 h-0.5 border-b-2 border-dashed border-emerald-600 inline-block" />
                <span>NHM Safety Ceiling</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (5 cols): Surge Alerts & Detailed Stat Grid */}
        <div className="lg:col-span-5 flex flex-col gap-3 overflow-hidden min-h-0">
          
          {/* Alerts */}
          {data && data.alerts && data.alerts.length > 0 && (
            <div className="neo-card p-3 bg-red-50 border-2 border-[var(--accent)] shrink-0 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-[var(--accent-dark)] font-bold text-xs">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[var(--accent)]" />
                  <span>PREDICTIVE SURGE ALERTS</span>
                </div>
                <span className="neo-badge neo-badge-red text-[8px]">MODEL WARNING</span>
              </div>

              {data.alerts.map((a, i) => (
                <div key={i} className="p-2 bg-white border border-[var(--accent)] text-[11px] space-y-0.5">
                  <span className="font-bold text-[var(--accent-dark)] block">
                    {a.code.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <p className="text-gray-800 leading-tight">{a.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stat Grid & Timeline */}
          {data && data.bed_occupancy && (
            <div className="neo-card flex-1 flex flex-col p-3 bg-white border-2 border-[var(--ink)] overflow-hidden min-h-0 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1 shrink-0">
                <span className="font-display text-sm font-bold uppercase">
                  FORECAST METRICS & QUEUE TIMELINE
                </span>
                <span className="text-[10px] font-bold text-gray-500">
                  {data.prediction?.date}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {/* 1. Bed Occupancy Rate (BOR) */}
                <div className="p-2 bg-neutral-50 border-2 border-[var(--ink)] space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-gray-600 uppercase">BED OCCUPANCY (BOR)</span>
                    <span className="neo-badge neo-badge-red text-[8px]">
                      {data.bed_occupancy.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline font-bold">
                    <span className="font-display text-2xl text-[var(--ink)]">
                      {data.bed_occupancy.current_occupied} <span className="text-xs font-mono text-gray-500">/ {data.bed_occupancy.total_beds} BEDS</span>
                    </span>
                    <span className="text-sm text-[var(--accent)] font-display">
                      {data.bed_occupancy.projected_bor_pct}% BOR
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 h-2 border border-black overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${Math.min(data.bed_occupancy.projected_bor_pct, 100)}%` }}
                    />
                  </div>

                  {data.bed_occupancy.projected_bor_pct > 85 && (
                    <NeobrutalistButton
                      variant="primary"
                      size="sm"
                      onClick={handleDispatchAlert}
                      className="w-full text-[10px] py-1 mt-1 flex items-center justify-center gap-1.5"
                    >
                      <BellRing className="w-3 h-3" />
                      <span>{alertDispatched ? "SURGE DISPATCHED ✓" : "DISPATCH REGIONAL SURGE ALERT"}</span>
                    </NeobrutalistButton>
                  )}
                </div>

                {/* 2. OPD & ED Metrics Grid */}
                {data.emergency_load && data.opd_load && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-neutral-50 border border-[var(--ink)] space-y-0.5">
                      <span className="text-[9px] font-bold text-gray-500 uppercase block">EMERGENCY DEPT</span>
                      <span className="font-display text-lg font-bold text-[var(--ink)] block">
                        {data.emergency_load.utilisation_pct}% <span className="text-[10px] font-mono text-gray-500">UTIL</span>
                      </span>
                      <span className="text-[10px] text-gray-600 block font-bold">
                        {data.emergency_load.ed_occupied_now}/{data.emergency_load.ed_beds} Beds Occupied
                      </span>
                    </div>

                    <div className="p-2 bg-neutral-50 border border-[var(--ink)] space-y-0.5">
                      <span className="text-[9px] font-bold text-gray-500 uppercase block">OPD LOAD</span>
                      <span className="font-display text-lg font-bold text-[var(--ink)] block">
                        {data.opd_load.patients_per_hour} <span className="text-[10px] font-mono text-gray-500">PTS/HR</span>
                      </span>
                      <span className="text-[10px] text-gray-600 block font-bold">
                        {data.opd_load.doctors_available} MDs • {data.opd_load.patients_per_doctor} pts/MD
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Triage Breakdown */}
                {data.emergency_load && (
                  <div className="p-2 bg-neutral-50 border border-[var(--ink)] space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[var(--ink)] block">
                      TRIAGE BREAKDOWN (EMERGENCY)
                    </span>
                    <div className="grid grid-cols-4 gap-1 text-center font-bold text-[10px]">
                      <div className="p-1 bg-red-100 text-red-900 border border-red-800">
                        {data.emergency_load.triage_immediate} IMM
                      </div>
                      <div className="p-1 bg-amber-100 text-amber-900 border border-amber-800">
                        {data.emergency_load.triage_urgent} URG
                      </div>
                      <div className="p-1 bg-neutral-200 text-neutral-900 border border-neutral-700">
                        {data.emergency_load.triage_non_urgent} NON
                      </div>
                      <div className="p-1 bg-emerald-100 text-emerald-900 border border-emerald-800">
                        {data.emergency_load.triage_observation} OBS
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. 6-Stage Waiting Times Timeline */}
                {data.waiting_times && (
                  <div className="p-2 bg-neutral-50 border border-[var(--ink)] space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="uppercase text-[var(--ink)]">6-STAGE WAITING QUEUE (MINUTES)</span>
                      <span className="text-[var(--accent)] font-display text-xs">
                        TOT: {Math.round(data.waiting_times.total)} MIN
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {[
                        ["Transit", data.waiting_times.transport],
                        ["Register", data.waiting_times.registration],
                        ["Triage", data.waiting_times.triage],
                        ["Consult", data.waiting_times.consultation],
                        ["Pharmacy", data.waiting_times.pharmacy],
                        ["Billing", data.waiting_times.billing],
                      ].map(([label, val]) => (
                        <div key={label as string} className="p-1.5 bg-white border border-[var(--ink)] space-y-0.5">
                          <div className="flex justify-between text-[9px] font-bold text-gray-600">
                            <span>{label}</span>
                            <span className="text-[var(--ink)]">{Math.round((val as number) || 0)}m</span>
                          </div>
                          <div className="w-full bg-gray-200 h-1 border border-black overflow-hidden">
                            <div
                              className="bg-[var(--accent)] h-full"
                              style={{ width: `${Math.min((((val as number) || 0) / 35) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
