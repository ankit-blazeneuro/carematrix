"use client";

import React, { useEffect, useState } from "react";
import { SwytchcodeLog } from "@/types";
import { api } from "@/lib/api";
import { Terminal, RefreshCw, ChevronDown, ChevronRight, Activity } from "lucide-react";

export function SwytchcodeLogViewer() {
  const [logs, setLogs] = useState<SwytchcodeLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSwytchcodeLogs();
      setLogs(data || []);
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

  const renderPayloadCards = (payload: Record<string, any>) => {
    if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
      return <div className="text-[11px] text-neutral-500 italic">No additional parameters.</div>;
    }

    return (
      <div className="grid grid-cols-2 gap-2 mt-2">
        {Object.entries(payload).map(([key, value]) => {
          const formattedKey = key.replace(/_/g, " ").toUpperCase();
          const formattedVal =
            typeof value === "object"
              ? Object.entries(value)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(", ")
              : String(value);

          return (
            <div
              key={key}
              className="p-2 bg-neutral-100 border border-[var(--ink)] flex flex-col justify-between"
            >
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-600">
                {formattedKey}
              </span>
              <span className="font-mono text-xs font-bold text-[var(--ink)] mt-0.5 break-words">
                {formattedVal}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="neo-card bg-white text-[var(--ink)] p-4 space-y-3 font-mono border-3 border-[var(--ink)] shadow-[5px_5px_0_var(--ink)] h-full flex flex-col">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b-2 border-[var(--ink)] pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[var(--accent)]" />
          <span className="font-display text-base tracking-wider uppercase text-[var(--ink)] font-bold">
            SWYTCHCODE DISPATCH MONITOR
          </span>
        </div>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="p-1 hover:bg-neutral-100 border border-[var(--ink)] rounded-none cursor-pointer transition-colors"
          title="Refresh Swytchcode logs"
        >
          <RefreshCw
            className={`w-4 h-4 text-[var(--ink)] ${
              isLoading ? "animate-spin text-[var(--accent)]" : ""
            }`}
          />
        </button>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs min-h-0">
        {logs.length === 0 ? (
          <div className="text-neutral-500 text-center py-6 italic flex flex-col items-center gap-1.5">
            <Activity className="w-5 h-5 opacity-40 animate-pulse text-[var(--ink)]" />
            <span>No active Swytchcode workflow executions logged.</span>
          </div>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                className="border-2 border-[var(--ink)] bg-neutral-50 p-2.5 rounded-none transition-all hover:bg-neutral-100"
              >
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="flex items-center justify-between cursor-pointer select-none gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                    )}
                    <span className="text-[var(--ink)] font-bold truncate">
                      {log.method.replace("carematrix.", "").replace(".dispatch", "").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-neutral-600 font-bold">
                      {log.time_iso.split("T")[1]?.slice(0, 8) || "LIVE"}
                    </span>
                    <span className="neo-badge neo-badge-red text-[8px] py-0 px-1.5 border border-[var(--ink)]">
                      {log.status}
                    </span>
                  </div>
                </div>

                {/* Details & Clean Structured Grid */}
                {isExpanded && (
                  <div className="mt-2.5 pt-2 border-t border-[var(--ink)] space-y-2 animate-in fade-in duration-100">
                    <div className="text-xs text-[var(--ink)]">
                      <span className="text-neutral-600 font-bold uppercase text-[10px] block mb-0.5">
                        DISPATCH DETAILS
                      </span>
                      {log.details}
                    </div>

                    <div className="text-xs text-[var(--ink)]">
                      <span className="text-neutral-600 font-bold uppercase text-[10px] block mb-0.5">
                        EXECUTION ENGINE
                      </span>
                      {log.engine}
                    </div>

                    <div>
                      <span className="text-neutral-600 font-bold uppercase text-[10px] block mb-1">
                        PAYLOAD ATTRIBUTES
                      </span>
                      {renderPayloadCards(log.payload)}
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
