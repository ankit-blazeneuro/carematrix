"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHospital } from "@/context/HospitalContext";
import { useWebSocket } from "@/hooks/useWebSocket";

export function HeaderNav() {
  const pathname = usePathname();
  const { hospitalId, hospitalName, logout } = useHospital();
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

  return (
    <header className="w-full bg-white border-b-3 border-[var(--ink)] sticky top-0 z-40 px-4 py-2 shadow-[0_3px_0_var(--ink)] shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-7 h-7 bg-[var(--accent)] border-2 border-[var(--ink)] flex items-center justify-center text-white font-display text-lg shadow-[2px_2px_0_var(--ink)]">
              +
            </div>
            <span className="font-display text-xl tracking-wider text-[var(--ink)] uppercase">
              CARE<span className="text-[var(--accent)]">MATRIX</span>
            </span>
          </Link>

          {/* Real-time Status Badge */}
          <div
            className={`neo-badge text-[10px] py-0.5 px-1.5 flex items-center gap-1.5 ${
              isConnected ? "neo-badge-red" : "neo-badge-black"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-white animate-ping" : "bg-neutral-400"
              }`}
            />
            <span>{isConnected ? "LIVE WS" : "MOCK SYNC"}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1.5">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-display text-xs md:text-sm px-2.5 py-1 border-2 border-[var(--ink)] uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-[var(--accent)] text-white shadow-[2px_2px_0_var(--ink)]"
                    : "bg-white text-[var(--ink)] hover:bg-neutral-100 shadow-[1.5px_1.5px_0_var(--ink)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Active Hospital & Session */}
        <div className="flex items-center gap-2">
          {hospitalId ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-[11px] font-bold text-[var(--ink)] truncate max-w-[150px]">
                  {hospitalName}
                </span>
                <span className="text-[9px] uppercase font-mono text-[var(--accent)] font-bold">
                  ID: {hospitalId}
                </span>
              </div>
              <Link
                href="/login"
                onClick={logout}
                className="font-display text-[10px] px-2 py-0.5 bg-neutral-100 border-2 border-[var(--ink)] uppercase hover:bg-[var(--accent)] hover:text-white transition-colors shadow-[1.5px_1.5px_0_var(--ink)]"
              >
                SWITCH
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="font-display text-[10px] px-2.5 py-0.5 bg-[var(--accent)] text-white border-2 border-[var(--ink)] uppercase shadow-[1.5px_1.5px_0_var(--ink)]"
            >
              LOGIN
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
