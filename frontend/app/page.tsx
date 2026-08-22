"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHospital } from "@/context/HospitalContext";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Activity, Users, Layers } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { hospitalId } = useHospital();

  useEffect(() => {
    if (hospitalId) {
      router.push("/dashboard");
    }
  }, [hospitalId, router]);

  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center space-y-8">
      {/* Top Banner Ribbon */}
      <div className="neo-badge neo-badge-yellow text-sm px-4 py-1 tracking-widest font-mono ribbon-animated border-3 border-[var(--ink)]">
        HEALTHCARE COORDINATION MESH SYSTEM
      </div>

      {/* Main Title */}
      <div className="space-y-4 max-w-3xl">
        <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tight text-[var(--ink)]">
          CARE<span className="text-[var(--accent)]">MATRIX</span>
        </h1>
        <p className="font-mono text-base md:text-xl text-gray-800 max-w-2xl mx-auto">
          High-throughput real-time patient transfers, automated ML surge forecasting, and emergency medical resource exchange.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
        <Link href="/dashboard">
          <NeobrutalistButton variant="primary" size="lg" className="flex items-center gap-3">
            <span>ENTER COMMAND CENTER</span>
            <ArrowRight className="w-5 h-5" />
          </NeobrutalistButton>
        </Link>
        <Link href="/login">
          <NeobrutalistButton variant="white" size="lg">
            SELECT FACILITY
          </NeobrutalistButton>
        </Link>
      </div>

      {/* 3 Core Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl pt-12 text-left">
        <div className="neo-card bg-white space-y-2">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Activity className="w-6 h-6" />
            <h3 className="font-display text-lg uppercase font-bold text-[var(--ink)]">
              LIVE BROADCASTS
            </h3>
          </div>
          <p className="font-mono text-xs text-gray-700">
            Real-time patient transfer handshakes with sub-second WebSocket broadcasting and auto-fallback polling.
          </p>
        </div>

        <div className="neo-card bg-white space-y-2">
          <div className="flex items-center gap-2 text-[var(--accent-blue)]">
            <Layers className="w-6 h-6" />
            <h3 className="font-display text-lg uppercase font-bold text-[var(--ink)]">
              SURGE ML FORECAST
            </h3>
          </div>
          <p className="font-mono text-xs text-gray-700">
            Machine-learned Bed Occupancy Rate (BOR) forecasting and 6-stage queue simulation.
          </p>
        </div>

        <div className="neo-card bg-white space-y-2">
          <div className="flex items-center gap-2 text-[var(--accent-green)]">
            <ShieldCheck className="w-6 h-6" />
            <h3 className="font-display text-lg uppercase font-bold text-[var(--ink)]">
              SWYTCHCODE DISPATCH
            </h3>
          </div>
          <p className="font-mono text-xs text-gray-700">
            Automated inter-facility medical supply exchange and instant emergency notification triggers.
          </p>
        </div>
      </div>
    </div>
  );
}
