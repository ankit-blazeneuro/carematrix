"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useHospital } from "@/context/HospitalContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Activity, LogOut, Building2 } from "lucide-react";

export function HeaderNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { hospitalId, hospitalName, location, shortCode, isAuthenticated, logout } = useHospital();
  const { isConnected } = useWebSocket("transfers", () => {});

  if (pathname === "/login") {
    return null;
  }

  const navLinks = [
    { label: "TRANSFERS", href: "/dashboard" },
    { label: "PREDICTIONS", href: "/prediction" },
    { label: "INVENTORY", href: "/inventory" },
    { label: "HEATMAP", href: "/heatmap" },
  ];

  const handleSignOut = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="w-full bg-white border-b-3 border-[var(--ink)] sticky top-0 z-40 px-3 md:px-6 py-2.5 shadow-[0_3px_0_var(--ink)] shrink-0">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo & Live Mesh Badge */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-[var(--accent)] border-2 border-[var(--ink)] flex items-center justify-center text-white font-display text-xl font-bold shadow-[2px_2px_0_var(--ink)] group-hover:translate-x-0.5 transition-transform">
              +
            </div>
            <span className="font-display text-xl md:text-2xl tracking-wider text-[var(--ink)] uppercase">
              CARE<span className="text-[var(--accent)]">MATRIX</span>
            </span>
          </Link>

          {/* Real-time Status Badge */}
          <div
            className={`hidden sm:flex neo-badge text-[10px] py-0.5 px-2 items-center gap-1.5 ${
              isConnected ? "neo-badge-red" : "neo-badge-black"
            }`}
          >
            <Activity className="w-3 h-3 animate-pulse" />
            <span>{isConnected ? "LIVE MESH" : "ACTIVE SYNC"}</span>
          </div>
        </div>

        {/* Navigation Section Links */}
        <nav className="flex items-center gap-1 md:gap-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-display text-xs md:text-sm px-2.5 md:px-3.5 py-1.5 border-2 border-[var(--ink)] uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-[var(--accent)] text-white shadow-[2.5px_2.5px_0_var(--ink)] font-bold scale-[1.02]"
                    : "bg-white text-[var(--ink)] hover:bg-neutral-100 shadow-[1.5px_1.5px_0_var(--ink)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Hospital Identity & Sign Out */}
        <div className="flex items-center gap-2">
          {isAuthenticated && hospitalId ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-neutral-50 border-2 border-[var(--ink)] text-left shadow-[1.5px_1.5px_0_var(--ink)]">
                <Building2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] font-bold text-[var(--ink)] truncate max-w-[160px]">
                    {hospitalName}
                  </span>
                  <span className="text-[9px] font-mono text-gray-600 font-bold">
                    NODE: {hospitalId}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="font-display text-xs px-2.5 py-1.5 bg-neutral-100 border-2 border-[var(--ink)] uppercase hover:bg-[var(--accent)] hover:text-white transition-colors shadow-[1.5px_1.5px_0_var(--ink)] flex items-center gap-1 cursor-pointer"
                title="Sign Out of Facility"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SIGN OUT</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="font-display text-xs px-3 py-1.5 bg-[var(--accent)] text-white border-2 border-[var(--ink)] uppercase shadow-[1.5px_1.5px_0_var(--ink)] hover:bg-[var(--accent-dark)] transition-colors"
            >
              LOGIN
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
