"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHospital } from "@/context/HospitalContext";
import { api } from "@/lib/api";
import { NeobrutalistCard } from "@/components/NeobrutalistCard";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import { Building2, ArrowRight } from "lucide-react";

interface HospitalItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  total_beds?: number;
  available_beds?: number;
  status: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useHospital();
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedId, setSelectedId] = useState("hospital123");
  const [customId, setCustomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadHospitals = async () => {
      setIsLoading(true);
      try {
        const data = await api.getHospitals();
        if (data && data.length > 0) {
          setHospitals(data);
          setSelectedId(data[0].id);
        } else {
          // Fallback if empty database
          setHospitals([
            { id: "hospital123", name: "Sarvodaya General Hospital", lat: 28.445, lng: 76.997, total_beds: 150, available_beds: 36, status: "online" },
            { id: "hospital456", name: "City Care Emergency Center", lat: 28.46, lng: 77.02, total_beds: 115, available_beds: 51, status: "online" },
            { id: "hospital789", name: "Apex Health Institute", lat: 28.43, lng: 76.98, total_beds: 190, available_beds: 19, status: "online" },
          ]);
        }
      } catch (err) {
        console.error("Failed to load hospitals:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadHospitals();
  }, []);

  const handleSelectLogin = (hospital: HospitalItem) => {
    login(hospital.id, hospital.name, hospital.lat, hospital.lng);
    router.push("/dashboard");
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customId.trim()) return;
    login(customId.trim(), `Facility (${customId.trim()})`);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-xl space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-block neo-badge neo-badge-red text-xs tracking-widest uppercase mb-1">
            NETWORK AUTHENTICATION
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight text-[var(--ink)]">
            SELECT FACILITY
          </h1>
          <p className="font-mono text-sm text-gray-700">
            Identify your healthcare facility node connected to live Neon PostgreSQL.
          </p>
        </div>

        {/* Real Facility Cards */}
        <div className="space-y-3">
          {hospitals.map((hospital) => {
            const isSelected = selectedId === hospital.id;
            return (
              <div
                key={hospital.id}
                onClick={() => setSelectedId(hospital.id)}
                className={`neo-card p-4 cursor-pointer transition-all ${
                  isSelected
                    ? "bg-white border-4 border-[var(--accent)] shadow-[5px_5px_0_var(--accent)] scale-101"
                    : "bg-white hover:bg-neutral-50 border-3 border-[var(--ink)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-neutral-100 border-2 border-[var(--ink)] flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-5 h-5 text-[var(--ink)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-lg font-bold uppercase text-[var(--ink)]">
                          {hospital.name}
                        </h3>
                        <span className="neo-badge neo-badge-black text-[9px] py-0">
                          {hospital.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-[var(--accent)] mt-1 block">
                        NODE ID: {hospital.id} • {hospital.total_beds || 0} TOTAL BEDS ({hospital.available_beds || 0} AVAIL)
                      </span>
                    </div>
                  </div>

                  <NeobrutalistButton
                    variant={isSelected ? "red" : "white"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectLogin(hospital);
                    }}
                    className="shrink-0 flex items-center gap-1 text-xs"
                  >
                    <span>ENTER</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </NeobrutalistButton>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Node Login */}
        <NeobrutalistCard
          title="OR ENTER CUSTOM NODE ID"
          className="bg-neutral-50"
        >
          <form onSubmit={handleCustomLogin} className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. hospital_custom_99"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              className="flex-1 bg-white border-2 border-[var(--ink)] p-2 font-mono text-sm shadow-[2px_2px_0_var(--ink)] focus:outline-none"
            />
            <NeobrutalistButton type="submit" variant="black" size="sm">
              CONNECT
            </NeobrutalistButton>
          </form>
        </NeobrutalistCard>
      </div>
    </div>
  );
}
