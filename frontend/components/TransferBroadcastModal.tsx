"use client";

import React, { useState } from "react";
import { useHospital } from "@/context/HospitalContext";
import { api } from "@/lib/api";
import { NeobrutalistButton } from "./NeobrutalistButton";
import { X, Send, AlertTriangle } from "lucide-react";

interface TransferBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBroadcastSuccess: (transferId: string) => void;
}

export function TransferBroadcastModal({
  isOpen,
  onClose,
  onBroadcastSuccess,
}: TransferBroadcastModalProps) {
  const { lat, lng } = useHospital();
  const [department, setDepartment] = useState("Emergency");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("High");
  const [customLat, setCustomLat] = useState(lat.toString());
  const [customLng, setCustomLng] = useState(lng.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.createTransfer({
        department,
        priority,
        lat: parseFloat(customLat) || lat,
        lng: parseFloat(customLng) || lng,
      });
      onBroadcastSuccess(res.id);
      onClose();
    } catch (err) {
      console.error("Failed to broadcast transfer:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="neo-card w-full max-w-lg bg-[var(--paper)] p-6 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-[var(--ink)] pb-3 mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-[var(--ink)]">
              BROADCAST TRANSFER
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 border-2 border-[var(--ink)] bg-white hover:bg-[var(--accent)] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Department Selection */}
          <div>
            <label className="block text-xs font-bold font-mono uppercase mb-1">
              Required Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-white border-3 border-[var(--ink)] p-2.5 font-mono text-sm shadow-[3px_3px_0_var(--ink)] focus:outline-none"
            >
              <option value="Emergency">Emergency</option>
              <option value="ICU">Intensive Care Unit (ICU)</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Trauma">Trauma & Ortho</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="OPD">General Outpatient (OPD)</option>
            </select>
          </div>

          {/* Priority Level */}
          <div>
            <label className="block text-xs font-bold font-mono uppercase mb-1">
              Triage Priority Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["High", "Medium", "Low"] as const).map((p) => {
                const isSelected = priority === p;
                const colors = {
                  High: "bg-[var(--accent)] text-white",
                  Medium: "bg-[var(--accent-yellow)] text-[var(--ink)]",
                  Low: "bg-[var(--accent-green)] text-white",
                }[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2 text-center font-display uppercase tracking-wider border-2 border-[var(--ink)] cursor-pointer transition-all ${
                      isSelected
                        ? `${colors} shadow-[3px_3px_0_var(--ink)] scale-102`
                        : "bg-white text-[var(--ink)] opacity-70 hover:opacity-100"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold font-mono uppercase mb-1">
                Patient Lat
              </label>
              <input
                type="number"
                step="0.0001"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-full bg-white border-2 border-[var(--ink)] p-2 font-mono text-sm shadow-[2px_2px_0_var(--ink)] focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold font-mono uppercase mb-1">
                Patient Lng
              </label>
              <input
                type="number"
                step="0.0001"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                className="w-full bg-white border-2 border-[var(--ink)] p-2 font-mono text-sm shadow-[2px_2px_0_var(--ink)] focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t-2 border-[var(--ink)] flex justify-end gap-3">
            <NeobrutalistButton
              type="button"
              variant="white"
              onClick={onClose}
              size="sm"
            >
              CANCEL
            </NeobrutalistButton>
            <NeobrutalistButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? "BROADCASTING..." : "DISPATCH BROADCAST"}</span>
            </NeobrutalistButton>
          </div>
        </form>
      </div>
    </div>
  );
}
