"use client";

import React, { useEffect, useState } from "react";
import { SwytchcodeLog } from "@/types";
import { api } from "@/lib/api";
import { Terminal, RefreshCw, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

export function SwytchcodeLogViewer() {
  const [logs, setLogs] = useState<SwytchcodeLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSwytchcodeLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load Swytchcode logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="neo-card bg-[var(--ink)] text-white p-4 space-y-3 font-mono shadow-[6px_6px_0_var(--accent)]">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b-2 border-white/20 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[var(--accent-yellow)]" />
          <span className="font-display text-base tracking-wider uppercase text-white">
            SWYTCHCODE DISPATCH MONITOR
          </span>
        </div>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="p-1 hover:bg-white/10 rounded cursor-pointer transition-colors"
          title="Refresh Swytchcode logs"
        >
          <RefreshCw
            className={`w-4 h-4 text-white/70 ${
              isLoading ? "animate-spin text-[var(--accent-yellow)]" : ""
            }`}
          />
        </button>
      </div>

      {/* Log Feed */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
        {logs.length === 0 ? (
          <div className="text-white/50 text-center py-4 italic">
            No active Swytchcode workflow executions logged.
          </div>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                className="border border-white/15 bg-white/5 p-2.5 rounded-none transition-all hover:bg-white/10"
              >
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 truncate">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--accent-yellow)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-white/50 shrink-0" />
                    )}
                    <span className="text-[var(--accent-yellow)] font-bold truncate">
                      {log.method}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-white/60">
                      {log.time_iso.split("T")[1]?.slice(0, 8) || "LIVE"}
                    </span>
                    <span className="neo-badge neo-badge-green text-[9px] py-0 px-1 border border-white">
                      {log.status}
                    </span>
                  </div>
                </div>

                {/* Details & Payload */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5 animate-in fade-in duration-100">
                    <div className="text-white/80">
                      <span className="text-white/50 font-bold">Details:</span> {log.details}
                    </div>
                    <div className="text-white/80">
                      <span className="text-white/50 font-bold">Engine:</span> {log.engine}
                    </div>
                    <div className="bg-black/60 p-2 border border-white/10 rounded-none overflow-x-auto">
                      <pre className="text-[11px] text-[var(--accent-yellow)] leading-tight">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
