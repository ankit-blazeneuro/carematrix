"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHospital } from "@/context/HospitalContext";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Activity, Layers, Radio } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoaded } = useHospital();

  useEffect(() => {
    if (isLoaded && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoaded, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-8 md:py-16 text-center space-y-6 md:space-y-8">
      {/* Top Banner Ribbon */}
      <div className="neo-badge neo-badge-red text-xs px-4 py-1 tracking-widest font-mono ribbon-animated border-3 border-[var(--ink)] shadow-[3px_3px_0_var(--ink)]">
        HEALTHCARE COORDINATION MESH SYSTEM
      </div>

      {/* Main Title */}
      <div className="space-y-3 max-w-3xl">
        <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tight text-[var(--ink)]">
          CARE<span className="text-[var(--accent)]">MATRIX</span>
        </h1>
        <p className="font-mono text-sm md:text-lg text-gray-800 max-w-2xl mx-auto leading-relaxed">
          High-throughput real-time patient transfers, automated ML surge forecasting, and emergency medical supply exchange.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
        <Link href="/dashboard">
          <NeobrutalistButton variant="primary" size="lg" className="flex items-center gap-3 py-3 px-6 text-lg">
            <span>ENTER COMMAND CENTER</span>
            <ArrowRight className="w-5 h-5" />
          </NeobrutalistButton>
        </Link>
        <Link href="/login">
          <NeobrutalistButton variant="white" size="lg" className="py-3 px-6 text-lg">
            SELECT FACILITY NODE
          </NeobrutalistButton>
        </Link>
      </div>

      {/* 3 Core Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl pt-8 text-left">
        <div className="neo-card bg-white space-y-2 border-3">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Radio className="w-6 h-6" />
            <h3 className="font-display text-lg uppercase font-bold text-[var(--ink)]">
              LIVE BROADCASTS
            </h3>
          </div>
          <p className="font-mono text-xs text-gray-700 leading-normal">
            Real-time patient transfer handshakes with sub-second WebSocket broadcasting and receiving facility matching.
          </p>
        </div>

        <div className="neo-card bg-white space-y-2 border-3">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Layers className="w-6 h-6" />
            <h3 className="font-display text-lg uppercase font-bold text-[var(--ink)]">
              SURGE ML FORECAST
            </h3>
          </div>
          <p className="font-mono text-xs text-gray-700 leading-normal">
            Machine-learned Bed Occupancy Rate (BOR) forecasting, ED load prediction, and 6-stage queue simulation.
          </p>
        </div>

        <div className="neo-card bg-white space-y-2 border-3">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <ShieldCheck className="w-6 h-6" />
            <h3 className="font-display text-lg uppercase font-bold text-[var(--ink)]">
              RESOURCE POOL
            </h3>
          </div>
          <p className="font-mono text-xs text-gray-700 leading-normal">
            Automated inter-facility medical supply exchange and shared regional inventory dispatch.
          </p>
        </div>
      </div>
    </div>
  );
}
