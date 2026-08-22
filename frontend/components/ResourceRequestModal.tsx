"use client";

import React, { useState } from "react";
import { useHospital } from "@/context/HospitalContext";
import { api } from "@/lib/api";
import { executeSwytchcodeAction } from "@/lib/swytchcode_client";
import { NeobrutalistButton } from "./NeobrutalistButton";
import { X, PackagePlus, ShieldAlert } from "lucide-react";

interface ResourceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: () => void;
}

export function ResourceRequestModal({
  isOpen,
  onClose,
  onRequestCreated,
}: ResourceRequestModalProps) {
  const { hospitalId } = useHospital();
  const [resourceType, setResourceType] = useState("Ventilators");
  const [quantity, setQuantity] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalId) return;
    setIsSubmitting(true);
    try {
      await api.createResourceRequest({
        requester_hospital_id: hospitalId,
        resource_type: resourceType,
        quantity,
      });

      // Dispatch Swytchcode notification to regional cluster
      await executeSwytchcodeAction("carematrix.resource_exchange.notify", {
        hospital_id: hospitalId,
        resource: resourceType,
        quantity,
        target: "regional-network",
      });

      onRequestCreated();
      onClose();
    } catch (err) {
      console.error("Failed to request resources:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="neo-card w-full max-w-md bg-[var(--paper)] p-6 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-[var(--ink)] pb-3 mb-5">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-[var(--accent-blue)]" />
            <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-[var(--ink)]">
              REQUEST SUPPLIES
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
          <div>
            <label className="block text-xs font-bold font-mono uppercase mb-1">
              Required Medical Asset
            </label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              className="w-full bg-white border-3 border-[var(--ink)] p-2.5 font-mono text-sm shadow-[3px_3px_0_var(--ink)] focus:outline-none"
            >
              <option value="Ventilators">Invasive Ventilators</option>
              <option value="Oxygen Cylinders (Type D)">Oxygen Cylinders (Type D)</option>
              <option value="O- Negative Blood Units">O- Negative Blood Units</option>
              <option value="ICU Dialysis Kits">ICU Continuous Dialysis Kits</option>
              <option value="PPE Emergency Packs">PPE Emergency Hazard Packs</option>
              <option value="Defibrillators">Automated External Defibrillators</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold font-mono uppercase mb-1">
              Required Units / Quantity
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full bg-white border-3 border-[var(--ink)] p-2.5 font-mono text-sm shadow-[3px_3px_0_var(--ink)] focus:outline-none"
              required
            />
          </div>

          <div className="p-3 bg-[var(--paper-alt)] border-2 border-[var(--ink)] text-xs font-mono space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
              <ShieldAlert className="w-4 h-4 text-[var(--accent)]" />
              <span>SWYTCHCODE DISPATCH ENABLED</span>
            </div>
            <p className="text-gray-700">
              Submitting triggers an automated real-time Swytchcode webhook to 8 partner hospitals in your cluster.
            </p>
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
              variant="blue"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "DISPATCHING..." : "DISPATCH REQUEST"}
            </NeobrutalistButton>
          </div>
        </form>
      </div>
    </div>
  );
}
