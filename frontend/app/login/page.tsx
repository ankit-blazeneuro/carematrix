"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHospital, KNOWN_HOSPITALS } from "@/context/HospitalContext";
import { NeobrutalistCard } from "@/components/NeobrutalistCard";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import { Lock, ArrowRight, ShieldCheck, KeyRound, Building2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useHospital();

  const [hospitalId, setHospitalId] = useState("hospital123");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!hospitalId.trim()) {
      setError("Hospital Node ID is required.");
      return;
    }

    if (!password.trim()) {
      setError("Password is required to access facility node.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = login(hospitalId.trim(), password.trim());
      setIsLoading(false);

      if (res.success) {
        router.push("/dashboard");
      } else {
        setError(res.error || "Authentication failed.");
      }
    }, 250);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-6 px-4">
      <div className="w-full max-w-md space-y-5">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 neo-badge neo-badge-red text-xs tracking-widest uppercase mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SECURE FACILITY NODE ACCESS</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight text-[var(--ink)]">
            CARE<span className="text-[var(--accent)]">MATRIX</span>
          </h1>
          <p className="font-mono text-xs text-gray-700 max-w-sm mx-auto">
            Authorized personnel login. Enter facility Node ID and Password to authenticate.
          </p>
        </div>

        {/* Credentials Form */}
        <NeobrutalistCard className="bg-white border-4 border-[var(--ink)] space-y-4 p-5">
          <div className="flex items-center justify-between border-b-2 border-[var(--ink)] pb-2.5">
            <div className="flex items-center gap-2 font-display text-lg font-bold uppercase text-[var(--ink)]">
              <Lock className="w-5 h-5 text-[var(--accent)]" />
              <span>FACILITY AUTHENTICATION</span>
            </div>
            <span className="neo-badge neo-badge-black text-[9px]">ENCRYPTED</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 font-mono text-xs">
            <div className="space-y-1">
              <label className="font-bold uppercase text-[var(--ink)] block flex items-center justify-between">
                <span>Hospital Node ID</span>
                <span className="text-[10px] text-gray-500 font-normal">REQUIRED</span>
              </label>
              <input
                type="text"
                placeholder="e.g. hospital123"
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                required
                className="w-full bg-neutral-50 border-2 border-[var(--ink)] p-2.5 text-sm font-bold text-[var(--ink)] shadow-[2px_2px_0_var(--ink)] focus:outline-none focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold uppercase text-[var(--ink)] block flex items-center justify-between">
                <span>Facility Password</span>
                <span className="text-[10px] text-gray-500 font-normal">REQUIRED</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-neutral-50 border-2 border-[var(--ink)] p-2.5 text-sm font-bold text-[var(--ink)] shadow-[2px_2px_0_var(--ink)] focus:outline-none focus:bg-white"
              />
            </div>

            {error && (
              <p className="p-2.5 bg-red-100 border-2 border-[var(--accent)] text-[var(--accent-dark)] font-bold text-xs">
                ⚠️ {error}
              </p>
            )}

            <NeobrutalistButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 pt-3 pb-3"
            >
              <span>{isLoading ? "AUTHENTICATING..." : "SIGN IN TO NODE"}</span>
              <ArrowRight className="w-4 h-4" />
            </NeobrutalistButton>
          </form>
        </NeobrutalistCard>

        {/* Demo Credentials Reference Note */}
        <div className="p-3 bg-neutral-100 border-2 border-[var(--ink)] font-mono text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[var(--ink)] uppercase">
            <KeyRound className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>AUTHORIZATION DIRECTORY (DEMO ACCESS)</span>
          </div>
          <div className="space-y-0.5 text-gray-700 text-[10px]">
            <div>• <strong className="text-[var(--ink)]">hospital123</strong> — Sarvodaya General Hospital</div>
            <div>• <strong className="text-[var(--ink)]">hospital321</strong> — Global Care Medical Centre</div>
            <div>• <strong className="text-[var(--ink)]">hospital456</strong> — City Care Emergency Center</div>
            <div>• <strong className="text-[var(--ink)]">hospital789</strong> — Apex Health Institute</div>
            <div className="pt-1 text-[var(--accent)] font-bold">Password for all nodes: <code className="bg-white px-1 border border-black text-black">password123</code></div>
          </div>
        </div>

      </div>
    </div>
  );
}
