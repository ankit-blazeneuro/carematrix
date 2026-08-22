"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useHospital, KNOWN_HOSPITALS } from "@/context/HospitalContext";
import { PatientTransfer, RegisteredPatient, AdmittedRecord, SurgeAlert } from "@/types";
import { api } from "@/lib/api";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import {
  UserPlus,
  RefreshCw,
  AlertTriangle,
  Building,
  Activity,
  Layers,
  Flame,
  Radio,
  Building2,
  CheckCircle2,
} from "lucide-react";

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { hospitalId, hospitalName, location, isAuthenticated, isLoaded } = useHospital();

  const [transfers, setTransfers] = useState<PatientTransfer[]>([]);
  const [admitted, setAdmitted] = useState<AdmittedRecord[]>([]);
  const [registered, setRegistered] = useState<RegisteredPatient[]>([]);
  const [surgeAlerts, setSurgeAlerts] = useState<SurgeAlert[]>([]);
  const [deniedNotifs, setDeniedNotifs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const seenIds = useRef<Set<string>>(new Set());
  const ownPatientIds = useRef<Set<string>>(new Set());
  const registeredRef = useRef<RegisteredPatient[]>([]);
  registeredRef.current = registered;

  const pendingTransfersRef = useRef<PatientTransfer[]>([]);
  pendingTransfersRef.current = transfers.filter((t) => t.status === "ACCEPTED_PENDING");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    contact: "",
    bloodGroup: "O+",
    priority: "High",
    condition: "",
    department: "Emergency",
  });

  // Redirect if unauthenticated
  useEffect(() => {
    if (isLoaded && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoaded, router]);

  // Load surge alerts
  useEffect(() => {
    if (!hospitalId) return;
    const loadAlerts = () => {
      api.getSurgeAlerts(hospitalId)
        .then(setSurgeAlerts)
        .catch(() => {});
    };
    loadAlerts();
    const iv = setInterval(loadAlerts, 15000);
    return () => clearInterval(iv);
  }, [hospitalId]);

  // Poll open incoming requests (Hospital B view - exclude own broadcasts)
  const pollOpenRequests = async () => {
    if (!hospitalId) return;
    setIsLoading(true);
    try {
      const open = await api.getOpenRequests(undefined, hospitalId);
      const openIds = new Set(open.map((r) => r.id));

      setTransfers((prev) =>
        prev.filter((t) => {
          if (ownPatientIds.current.has(t.id)) return false;
          if (t.status === "ACCEPTED_PENDING" || t.status === "CONFIRMED" || t.status === "DENIED") return true;
          if (t.status !== "PENDING" && t.status !== "open") return false;
          return openIds.has(t.id);
        })
      );

      // Exclude own patient IDs and requests originating from current hospital
      const fresh = open.filter(
        (r) =>
          !seenIds.current.has(r.id) &&
          !ownPatientIds.current.has(r.id) &&
          (r as any).requester_hospital_id !== hospitalId &&
          (r as any).hospital_id !== hospitalId
      );

      if (fresh.length > 0) {
        fresh.forEach((r) => seenIds.current.add(r.id));
        setTransfers((prev) => [
          ...fresh.map((r) => {
            const hId = (r as any).requester_hospital_id || (r as any).hospital_id || "hospital321";
            const hName =
              (r as any).requester_hospital_name ||
              (r as any).hospital_name ||
              KNOWN_HOSPITALS[hId]?.name ||
              "Global Care Medical Centre";

            return {
              id: r.id,
              department: r.department,
              priority: r.priority as any,
              requester_hospital_id: hId,
              requester_hospital_name: hName,
              hospital_name: hName,
              status: "PENDING" as const,
              receivedAt: nowTime(),
            };
          }),
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("Failed polling open requests:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    pollOpenRequests();
    const iv = setInterval(pollOpenRequests, 3000);
    return () => clearInterval(iv);
  }, [hospitalId]);

  // Poll acceptance-status for ACCEPTED_PENDING transfers
  useEffect(() => {
    if (!hospitalId) return;
    const pollAcceptance = async () => {
      const pending = pendingTransfersRef.current;
      if (pending.length === 0) return;

      for (const t of pending) {
        const res = await api.getAcceptanceStatus(t.id, hospitalId).catch(() => null);
        if (!res) continue;

        if (res.status === "confirmed") {
          setAdmitted((prev) => {
            if (prev.some((a) => a.id === t.id.slice(0, 8))) return prev;
            return [
              {
                id: t.id.slice(0, 8),
                department: t.department,
                priority: t.priority,
                admittedAt: nowTime(),
              },
              ...prev,
            ];
          });
          setTransfers((prev) =>
            prev.map((r) => (r.id === t.id ? { ...r, status: "CONFIRMED" as const } : r))
          );
          setTimeout(() => {
            setTransfers((prev) => prev.filter((r) => r.id !== t.id));
          }, 3500);
        } else if (res.status === "denied_by_source") {
          setDeniedNotifs((prev) => [
            `Transfer denied by source — ${t.department} (${t.priority})`,
            ...prev,
          ]);
          setTransfers((prev) =>
            prev.map((r) => (r.id === t.id ? { ...r, status: "DENIED" as const } : r))
          );
          setTimeout(() => {
            setTransfers((prev) => prev.filter((r) => r.id !== t.id));
          }, 4000);
        }
      }
    };
    const iv = setInterval(pollAcceptance, 3000);
    return () => clearInterval(iv);
  }, [hospitalId]);

  // Poll responses for outgoing registered patients (Hospital A view)
  useEffect(() => {
    const pollResponses = async () => {
      for (const p of registeredRef.current) {
        if (p.confirmed) continue;
        const responses = await api.getPatientResponses(p.patientId).catch(() => []);
        if (responses.length === 0) continue;
        setRegistered((prev) =>
          prev.map((x) => {
            if (x.patientId !== p.patientId) return x;
            const existingIds = new Set(x.matches.map((m) => m.hospital_id));
            const newMatches = responses
              .filter((r) => !existingIds.has(r.hospital_id))
              .map((r) => ({
                hospital_id: r.hospital_id,
                name: r.hospital_name || r.name || KNOWN_HOSPITALS[r.hospital_id]?.name || r.hospital_id,
                decided: false,
              }));
            return { ...x, matches: [...x.matches, ...newMatches] };
          })
        );
      }
    };
    const iv = setInterval(pollResponses, 3500);
    return () => clearInterval(iv);
  }, []);

  // Handle Form Input Change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Step 0: Register New Outgoing Patient Request with Hospital Name (Hospital A)
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.age || !formData.contact) {
      alert("Please fill in patient name, age, and contact number.");
      return;
    }

    try {
      const res = await api.createPatientRequest(
        formData.department,
        formData.priority,
        hospitalId || "hospital123",
        hospitalName || "Sarvodaya General Hospital"
      );

      if (res && res.patient_id) {
        ownPatientIds.current.add(res.patient_id);
        seenIds.current.add(res.patient_id);

        setRegistered((prev) => [
          {
            patientId: res.patient_id,
            name: formData.name,
            department: formData.department,
            priority: formData.priority,
            matches: [],
            confirmed: null,
          },
          ...prev,
        ]);

        setFormData({
          name: "",
          age: "",
          contact: "",
          bloodGroup: "O+",
          priority: "High",
          condition: "",
          department: "Emergency",
        });
      }
    } catch (err) {
      console.error("Failed to register patient transfer:", err);
    }
  };

  // Step 1 of Two-Way Confirmation (Hospital B): Accept incoming transfer request
  const handleDecision = async (
    transfer: PatientTransfer,
    decision: "ACCEPTED_PENDING" | "DECLINED"
  ) => {
    if (!hospitalId) return;

    if (decision === "ACCEPTED_PENDING") {
      await api.respondToPatient(transfer.id, hospitalId, "accepted").catch(() => {});
      setTransfers((prev) =>
        prev.map((r) => (r.id === transfer.id ? { ...r, status: "ACCEPTED_PENDING" } : r))
      );
      void pollOpenRequests();
    } else {
      await api.respondToPatient(transfer.id, hospitalId, "rejected").catch(() => {});
      setTransfers((prev) =>
        prev.map((r) => (r.id === transfer.id ? { ...r, status: "DECLINED" } : r))
      );
      void pollOpenRequests();
      setTimeout(() => {
        setTransfers((prev) => prev.filter((r) => r.id !== transfer.id));
      }, 1500);
    }
  };

  // Step 2 of Two-Way Confirmation (Hospital A): Confirm match with receiving hospital
  const handleConfirmMatch = async (patientId: string, hId: string, hName: string) => {
    const res = await api.selectHospital(patientId, hId).catch(() => null);
    if (res?.status === "assigned" || res?.status === "already_assigned") {
      setRegistered((prev) =>
        prev.map((p) =>
          p.patientId === patientId
            ? {
                ...p,
                confirmed: hId,
                matches: p.matches.map((m) => ({ ...m, decided: true })),
              }
            : p
        )
      );
    } else {
      alert(`Match failed or ${hName} has no capacity left. Select another node.`);
    }
  };

  // Step 2 Alternative: Deny receiving hospital response
  const handleDenyMatch = async (patientId: string, hId: string) => {
    await api.denyResponse(patientId, hId).catch(() => {});
    setRegistered((prev) =>
      prev.map((p) =>
        p.patientId === patientId
          ? {
              ...p,
              matches: p.matches.map((m) => (m.hospital_id === hId ? { ...m, decided: true } : m)),
            }
          : p
      )
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden h-[calc(100vh-76px)]">
      {/* Top Identity & Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-3 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight text-[var(--ink)]">
              {hospitalName || "CLINICAL COMMAND DASHBOARD"}
            </h1>
            <span className="neo-badge neo-badge-red text-[9px] py-0">LIVE WEBSOCKET NODE: {hospitalId}</span>
          </div>
          <p className="font-mono text-xs text-gray-700">
            {location || "NCR Healthcare Mesh Network"} • Real-Time WebSockets Two-Way Patient Handshake Mesh
          </p>
        </div>

        {/* Quick Navigation Shortcuts */}
        <div className="flex items-center gap-1.5 flex-wrap font-mono">
          <button
            onClick={() => router.push("/inventory")}
            className="font-display text-xs px-2.5 py-1 bg-white border-2 border-[var(--ink)] uppercase hover:bg-neutral-100 shadow-[1.5px_1.5px_0_var(--ink)] flex items-center gap-1 cursor-pointer"
          >
            <Building className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>INVENTORY</span>
          </button>

          <button
            onClick={() => router.push("/heatmap")}
            className="font-display text-xs px-2.5 py-1 bg-white border-2 border-[var(--ink)] uppercase hover:bg-neutral-100 shadow-[1.5px_1.5px_0_var(--ink)] flex items-center gap-1 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>HEATMAP</span>
          </button>

          <button
            onClick={() => router.push("/prediction")}
            className="font-display text-xs px-2.5 py-1 bg-white border-2 border-[var(--ink)] uppercase hover:bg-neutral-100 shadow-[1.5px_1.5px_0_var(--ink)] flex items-center gap-1 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>SURGE PREDICTION</span>
          </button>

          <button
            onClick={pollOpenRequests}
            className="p-1 bg-white border-2 border-[var(--ink)] shadow-[1.5px_1.5px_0_var(--ink)] cursor-pointer"
            title="Refresh Requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[var(--accent)]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Full-Viewport 2-Column Split Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN (6 cols): Quick Register & Incoming Transfers */}
        <div className="lg:col-span-6 flex flex-col gap-3 overflow-hidden min-h-0">
          
          {/* 1. Quick Patient Intake Form */}
          <div className="neo-card p-3 bg-white border-2 border-[var(--ink)] shrink-0 space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-display text-sm font-bold uppercase">
                  REGISTER OUTGOING PATIENT TRANSFER
                </span>
              </div>
              <span className="neo-badge neo-badge-black text-[8px]">FACILITY: {hospitalName?.slice(0, 18)}</span>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-2 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Patient Full Name *"
                  required
                  className="bg-neutral-50 border border-[var(--ink)] p-1.5 font-bold shadow-[1px_1px_0_var(--ink)] focus:outline-none focus:bg-white"
                />
                <input
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  placeholder="Age *"
                  required
                  className="bg-neutral-50 border border-[var(--ink)] p-1.5 font-bold shadow-[1px_1px_0_var(--ink)] focus:outline-none focus:bg-white"
                />
                <input
                  name="contact"
                  value={formData.contact}
                  onChange={handleInputChange}
                  placeholder="Contact No. *"
                  required
                  className="bg-neutral-50 border border-[var(--ink)] p-1.5 font-bold shadow-[1px_1px_0_var(--ink)] focus:outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleInputChange}
                  className="bg-neutral-50 border border-[var(--ink)] p-1.5 font-bold shadow-[1px_1px_0_var(--ink)] focus:outline-none"
                >
                  <option>O+</option>
                  <option>O-</option>
                  <option>A+</option>
                  <option>A-</option>
                  <option>B+</option>
                  <option>AB+</option>
                </select>

                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="bg-neutral-50 border border-[var(--ink)] p-1.5 font-bold shadow-[1px_1px_0_var(--ink)] focus:outline-none"
                >
                  <option>Critical</option>
                  <option>High</option>
                  <option>Moderate</option>
                  <option>Low</option>
                </select>

                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="bg-neutral-50 border border-[var(--ink)] p-1.5 font-bold shadow-[1px_1px_0_var(--ink)] focus:outline-none"
                >
                  <option>Emergency</option>
                  <option>ICU</option>
                  <option>Surgery</option>
                  <option>Radiology</option>
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  name="condition"
                  value={formData.condition}
                  onChange={handleInputChange}
                  placeholder="Clinical Diagnosis / Notes (e.g. Acute Respiratory Distress)"
                  className="flex-1 bg-neutral-50 border border-[var(--ink)] p-1.5 font-bold shadow-[1px_1px_0_var(--ink)] focus:outline-none"
                />
                <NeobrutalistButton type="submit" variant="primary" size="sm" className="text-xs py-1 px-4">
                  BROADCAST
                </NeobrutalistButton>
              </div>
            </form>
          </div>

          {/* 2. Incoming Patient Transfers List (Hospital B view - Real-time WebSocket broadcasts with source hospital name) */}
          <div className="neo-card flex-1 flex flex-col p-3 bg-white border-2 border-[var(--ink)] overflow-hidden min-h-0">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-display text-sm font-bold uppercase">
                  INCOMING REGIONAL BROADCASTS (LIVE WEBSOCKETS)
                </span>
              </div>
              <span className="neo-badge neo-badge-black text-[8px]">
                {transfers.length} OPEN
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {transfers.length === 0 ? (
                <div className="text-center py-8 font-mono text-xs text-gray-500 italic">
                  No active incoming transfer broadcasts from other regional hospital nodes.
                </div>
              ) : (
                transfers.map((r) => {
                  const isAcceptedPending = r.status === "ACCEPTED_PENDING";
                  const isConfirmed = r.status === "CONFIRMED";
                  const isDenied = r.status === "DENIED";
                  const isDeclined = r.status === "DECLINED";

                  return (
                    <div
                      key={r.id}
                      className={`p-2.5 border-2 border-[var(--ink)] flex items-center justify-between gap-2 transition-colors ${
                        isConfirmed
                          ? "bg-emerald-50 border-emerald-900"
                          : isDenied || isDeclined
                          ? "bg-red-50 border-red-900"
                          : isAcceptedPending
                          ? "bg-amber-50 border-amber-900"
                          : "bg-neutral-50"
                      }`}
                    >
                      <div className="space-y-1 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <strong className="text-[var(--ink)] font-bold">{r.department}</strong>
                          <span
                            className={`neo-badge text-[8px] py-0 ${
                              r.priority === "Critical"
                                ? "neo-badge-red"
                                : "neo-badge-black"
                            }`}
                          >
                            {r.priority}
                          </span>
                          <span className="text-[10px] text-gray-500">ID: {r.id.slice(0, 8)}…</span>
                        </div>

                        {/* Origin Hospital Name */}
                        <div className="text-[11px] text-[var(--ink)] font-bold flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                          <span>FROM: {r.requester_hospital_name || r.hospital_name || "Regional Hospital Node"}</span>
                        </div>

                        <div className="text-[10px] text-gray-600">
                          <span>Received: {r.receivedAt}</span>
                        </div>

                        {/* Two-way Handshake Status Indications */}
                        {isAcceptedPending && (
                          <p className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 border border-amber-600 inline-block">
                            ⏳ STEP 1 COMPLETE: Awaiting source hospital final match confirmation…
                          </p>
                        )}
                        {isConfirmed && (
                          <p className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 border border-emerald-600 inline-block">
                            ✓ HANDSHAKE CONFIRMED — Patient en route to facility
                          </p>
                        )}
                        {isDenied && (
                          <p className="text-[10px] font-bold text-red-800 bg-red-100 px-1.5 py-0.5 border border-red-600 inline-block">
                            ✕ Transfer assigned to another hospital node by source
                          </p>
                        )}
                        {isDeclined && (
                          <p className="text-[10px] font-bold text-red-800 bg-red-100 px-1.5 py-0.5 border border-red-600 inline-block">
                            ✕ Transfer Declined by your node
                          </p>
                        )}
                      </div>

                      {r.status === "PENDING" && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <NeobrutalistButton
                            variant="red"
                            size="sm"
                            onClick={() => handleDecision(r, "ACCEPTED_PENDING")}
                            className="text-xs py-0.5 px-2.5"
                          >
                            ACCEPT (STEP 1)
                          </NeobrutalistButton>
                          <NeobrutalistButton
                            variant="white"
                            size="sm"
                            onClick={() => handleDecision(r, "DECLINED")}
                            className="text-xs py-0.5 px-2.5"
                          >
                            DECLINE
                          </NeobrutalistButton>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (6 cols): Surge Intelligence & Patient Status */}
        <div className="lg:col-span-6 flex flex-col gap-3 overflow-hidden min-h-0">
          
          {/* 1. Surge Intelligence Alerts */}
          {surgeAlerts.length > 0 && (
            <div className="neo-card p-3 bg-red-50 border-2 border-[var(--accent)] shrink-0 space-y-2">
              <div className="flex items-center justify-between border-b border-[var(--accent)] pb-1">
                <div className="flex items-center gap-1.5 text-[var(--accent-dark)] font-bold text-xs font-mono">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  <span>SURGE INTELLIGENCE ALERTS</span>
                </div>
                <span className="neo-badge neo-badge-red text-[8px]">HIGH ALERT</span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                {surgeAlerts.map((alert) => (
                  <div key={alert.id} className="p-2 bg-white border border-[var(--accent)] text-xs space-y-0.5">
                    <div className="flex justify-between font-bold text-[var(--accent-dark)]">
                      <span>{alert.code.replace(/_/g, " ")}</span>
                      <span className="neo-badge neo-badge-red text-[8px]">{alert.level}</span>
                    </div>
                    <p className="text-[11px] text-gray-800">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Denied Notifications */}
          {deniedNotifs.length > 0 && (
            <div className="neo-card p-3 bg-neutral-900 text-white border-2 border-[var(--ink)] shrink-0 space-y-1 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-white/20 pb-1">
                <span className="font-bold text-red-400">TRANSFER DENIED BY SOURCE</span>
                <button
                  onClick={() => setDeniedNotifs([])}
                  className="text-[10px] text-white/70 hover:text-white underline cursor-pointer"
                >
                  DISMISS ALL
                </button>
              </div>
              {deniedNotifs.map((msg, i) => (
                <div key={i} className="text-[11px] py-1 border-b border-white/10 flex justify-between items-center">
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* 3. Patient Transfer Tracking & Receiving Matches (Hospital A view - displays two-way confirmation controls!) */}
          <div className="neo-card flex-1 flex flex-col p-3 bg-white border-2 border-[var(--ink)] overflow-hidden min-h-0">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-display text-sm font-bold uppercase">
                  OUTGOING TRANSFERS & TWO-WAY HANDSHAKE (THIS NODE)
                </span>
              </div>
              <span className="neo-badge neo-badge-black text-[8px]">
                {registered.length + admitted.length} PENDING / ACTIVE
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {/* Admitted Records */}
              {admitted.map((a) => (
                <div
                  key={a.id}
                  className="p-2.5 bg-emerald-50 border-2 border-emerald-900 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-emerald-950 font-bold">{a.department}</strong>
                      <span className="neo-badge neo-badge-black text-[8px] py-0">
                        {a.priority}
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-800">
                      ID: {a.id} • Admitted at {a.admittedAt}
                    </p>
                  </div>
                  <span className="neo-badge neo-badge-black text-[9px] bg-emerald-700 text-white">
                    ✓ ADMITTED
                  </span>
                </div>
              ))}

              {/* Registered Outgoing Patients */}
              {registered.map((p) => {
                const undecided = p.matches.filter((m) => !m.decided);
                return (
                  <div key={p.patientId} className="p-2.5 bg-neutral-50 border-2 border-[var(--ink)] space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
                          <span>{p.name}</span>
                          <span
                            className={`neo-badge text-[8px] py-0 ${
                              p.priority === "Critical" ? "neo-badge-red" : "neo-badge-black"
                            }`}
                          >
                            {p.priority}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-600 block">
                          Dept: {p.department} • Ref: {p.patientId.slice(0, 8)}…
                        </span>
                      </div>

                      {p.confirmed ? (
                        <span className="neo-badge neo-badge-black text-[9px] bg-emerald-700 text-white">
                          HANDSHAKE CONFIRMED ✓
                        </span>
                      ) : (
                        <span className="neo-badge neo-badge-red text-[8px] animate-pulse">
                          PENDING RECEIVING MATCH
                        </span>
                      )}
                    </div>

                    {/* Responding Hospitals List for Two-Way Confirmation */}
                    {!p.confirmed && (
                      <div className="space-y-1.5 pt-1 border-t border-gray-200">
                        {undecided.length === 0 ? (
                          <p className="text-[10px] text-gray-500 italic">
                            {p.matches.length === 0
                              ? "Broadcasting over regional WebSocket mesh... Status: PENDING receiving node responses."
                              : "All hospital responses handled."}
                          </p>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold uppercase text-[var(--accent)] block">
                              Accepting Receiving Facilities (Step 1 Accepted):
                            </span>
                            {undecided.map((m) => (
                              <div
                                key={m.hospital_id}
                                className="p-2 bg-white border border-[var(--ink)] flex items-center justify-between gap-2"
                              >
                                <div className="space-y-0.5">
                                  <span className="font-bold text-xs text-[var(--ink)] block">
                                    {m.name}
                                  </span>
                                  <span className="text-[9px] text-emerald-700 font-bold block">
                                    ✓ Accepted transfer — awaiting your final confirmation
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <NeobrutalistButton
                                    variant="red"
                                    size="sm"
                                    onClick={() => handleConfirmMatch(p.patientId, m.hospital_id, m.name)}
                                    className="text-[10px] py-0.5 px-2"
                                  >
                                    CONFIRM MATCH (STEP 2)
                                  </NeobrutalistButton>
                                  <NeobrutalistButton
                                    variant="white"
                                    size="sm"
                                    onClick={() => handleDenyMatch(p.patientId, m.hospital_id)}
                                    className="text-[10px] py-0.5 px-2"
                                  >
                                    DENY
                                  </NeobrutalistButton>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {admitted.length === 0 && registered.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400 italic">
                  No active patient transfers or admissions recorded for this facility node.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
