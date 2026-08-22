"use client";

import React, { useState, useEffect } from "react";
import { useHospital } from "@/context/HospitalContext";
import { PatientTransfer, TransferResponse, HospitalInfo } from "@/types";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import { TransferBroadcastModal } from "@/components/TransferBroadcastModal";
import { SwytchcodeLogViewer } from "@/components/SwytchcodeLogViewer";
import {
  Send,
  Building,
  RefreshCw,
} from "lucide-react";

export default function DashboardPage() {
  const { hospitalId, hospitalName } = useHospital();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);
  const [openTransfers, setOpenTransfers] = useState<PatientTransfer[]>([]);
  const [myTransferId, setMyTransferId] = useState<string | null>(null);
  const [transferResponses, setTransferResponses] = useState<TransferResponse[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboardData = async () => {
    if (!hospitalId) return;
    setIsLoading(true);
    try {
      const [info, transfers] = await Promise.all([
        api.getHospitalInfo(hospitalId),
        api.getOpenTransfers(),
      ]);
      setHospitalInfo(info);
      setOpenTransfers(transfers || []);

      if (myTransferId) {
        const resps = await api.getResponsesForTransfer(myTransferId);
        setTransferResponses(resps || []);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [hospitalId, myTransferId]);

  useWebSocket("transfers", (event, data) => {
    if (event === "new_transfer" || event === "TRANSFER_BROADCAST") {
      setOpenTransfers((prev) => [data, ...prev]);
    } else if (event === "transfer_response" && myTransferId === data.patient_id) {
      setTransferResponses((prev) => [...prev, data]);
    } else if (event === "poll_sync") {
      loadDashboardData();
    }
  });

  const handleRespond = async (patientId: string, status: "accepted" | "rejected") => {
    if (!hospitalId) return;
    try {
      await api.respondTransfer(patientId, hospitalId, status);
      setOpenTransfers((prev) => prev.filter((t) => t.id !== patientId));
    } catch (err) {
      console.error("Failed to respond to transfer:", err);
    }
  };

  const handleConfirmTransfer = async (patientId: string, targetHospitalId: string) => {
    try {
      await api.selectTransferMatch(patientId, targetHospitalId);
      setSelectedMatch(targetHospitalId);
      loadDashboardData();
    } catch (err) {
      console.error("Failed to confirm match:", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Top Banner & Quick Stats */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--ink)]">
            PATIENT TRANSFER BROADCAST CENTER
          </h1>
          <p className="font-mono text-xs text-gray-700">
            Node: <strong>{hospitalName}</strong> ({hospitalId}) • Real-time Telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboardData}
            className="p-1.5 border-2 border-[var(--ink)] bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0_var(--ink)] cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[var(--accent)]" : ""}`} />
          </button>
          <NeobrutalistButton
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>BROADCAST TRANSFER</span>
          </NeobrutalistButton>
        </div>
      </div>

      {/* Facility Capacity Tiles */}
      {hospitalInfo && (
        <div className="grid grid-cols-4 gap-2 shrink-0">
          {hospitalInfo.capacities.map((cap) => {
            const occupancyPct = Math.round(((cap.total - cap.available) / cap.total) * 100);
            return (
              <div key={cap.department} className="neo-card p-2 bg-white flex items-center justify-between border-2">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-gray-500 block">
                    {cap.department}
                  </span>
                  <span className="font-display text-lg font-bold text-[var(--ink)]">
                    {cap.available} <span className="text-[10px] font-mono text-gray-500">/ {cap.total}</span>
                  </span>
                </div>
                <span
                  className={`neo-badge text-[9px] py-0 px-1 ${
                    occupancyPct > 85 ? "neo-badge-red" : "neo-badge-black"
                  }`}
                >
                  {occupancyPct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Main 2-Column Section */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        {/* Left Column (8 cols): Incoming Requests & Outgoing Broadcasts */}
        <div className="lg:col-span-8 flex flex-col gap-3 overflow-hidden min-h-0">
          {/* 1. Incoming Patient Transfer Broadcasts */}
          <div className="neo-card flex-1 flex flex-col p-3 overflow-hidden min-h-0 border-2">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
              <span className="font-display text-sm font-bold uppercase">
                REGIONAL TRANSFER BROADCASTS (INCOMING)
              </span>
              <span className="neo-badge neo-badge-black text-[9px] py-0">
                {openTransfers.length} OPEN
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {openTransfers.length === 0 ? (
                <div className="text-center py-6 font-mono text-xs text-gray-400 italic">
                  No active incoming broadcasts in your regional cluster.
                </div>
              ) : (
                openTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    className="p-2.5 border-2 border-[var(--ink)] bg-neutral-50 flex items-center justify-between gap-2 hover:bg-neutral-100 transition-colors"
                  >
                    <div className="space-y-0.5 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="text-[var(--ink)]">{transfer.id}</strong>
                        <span className="neo-badge neo-badge-red text-[8px] py-0">
                          {transfer.priority}
                        </span>
                        <span className="font-bold text-[var(--accent)] uppercase">
                          {transfer.department}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-3">
                        <span>Lat/Lng: {transfer.lat?.toFixed(2)}, {transfer.lng?.toFixed(2)}</span>
                        <span>{Math.round((Date.now() - (transfer.created_at || Date.now())) / 60000)}m ago</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <NeobrutalistButton
                        variant="red"
                        size="sm"
                        onClick={() => handleRespond(transfer.id, "accepted")}
                        className="text-xs py-0.5 px-2"
                      >
                        ACCEPT
                      </NeobrutalistButton>
                      <NeobrutalistButton
                        variant="white"
                        size="sm"
                        onClick={() => handleRespond(transfer.id, "rejected")}
                        className="text-xs py-0.5 px-2"
                      >
                        DECLINE
                      </NeobrutalistButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Outgoing Broadcast Responses */}
          <div className="neo-card flex-1 flex flex-col p-3 overflow-hidden min-h-0 border-2">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
              <span className="font-display text-sm font-bold uppercase">
                OUTGOING BROADCAST RESPONSES
              </span>
              <span className="neo-badge neo-badge-black text-[9px] py-0">
                ACTIVE: {myTransferId || "NONE"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {!myTransferId ? (
                <div className="p-4 border border-dashed border-[var(--ink)] text-center font-mono text-xs text-gray-400">
                  No active outgoing transfer. Click &quot;BROADCAST TRANSFER&quot; above to dispatch a patient.
                </div>
              ) : transferResponses.length === 0 ? (
                <div className="p-4 border border-dashed border-[var(--ink)] text-center font-mono text-xs text-gray-400">
                  Scanning regional mesh for available receiving facilities...
                </div>
              ) : (
                transferResponses.map((resp) => {
                  const isMatched = selectedMatch === resp.hospital_id;
                  return (
                    <div
                      key={resp.id}
                      className={`p-2.5 border-2 border-[var(--ink)] flex items-center justify-between gap-2 ${
                        isMatched
                          ? "bg-[var(--accent)] text-white"
                          : "bg-neutral-50"
                      }`}
                    >
                      <div className="space-y-0.5 font-mono text-xs">
                        <div className="flex items-center gap-2 font-bold uppercase">
                          <Building className="w-3.5 h-3.5" />
                          <span>{resp.hospital_name || resp.hospital_id}</span>
                          <span className="neo-badge neo-badge-black text-[8px] py-0 text-white">
                            READY
                          </span>
                        </div>
                        <p className="text-[10px] opacity-80">
                          Verified Available Bed in Neon PostgreSQL
                        </p>
                      </div>

                      <div>
                        {isMatched ? (
                          <span className="neo-badge neo-badge-white text-[10px] font-bold text-[var(--accent)]">
                            EN ROUTE ✓
                          </span>
                        ) : (
                          <NeobrutalistButton
                            variant="black"
                            size="sm"
                            onClick={() => handleConfirmTransfer(resp.patient_id, resp.hospital_id)}
                            className="text-xs py-0.5 px-2"
                          >
                            CONFIRM MATCH
                          </NeobrutalistButton>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Swytchcode Log Monitor */}
        <div className="lg:col-span-4 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden min-h-0">
            <SwytchcodeLogViewer />
          </div>
        </div>
      </div>

      {/* Broadcast Modal */}
      <TransferBroadcastModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onBroadcastSuccess={(newId) => {
          setMyTransferId(newId);
          setSelectedMatch(null);
          loadDashboardData();
        }}
      />
    </div>
  );
}
