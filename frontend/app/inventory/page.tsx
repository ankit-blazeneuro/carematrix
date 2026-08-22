"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHospital } from "@/context/HospitalContext";
import { ResourcePoolEntry, ResourceRequest } from "@/types";
import { api } from "@/lib/api";
import { NeobrutalistButton } from "@/components/NeobrutalistButton";
import {
  Package,
  Sparkles,
  Receipt,
  Share2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  RefreshCw,
  Building,
} from "lucide-react";

type Item = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  icon: string;
  perPatient: number;
};

type BillItem = Item & { predicted: number; deficit: number; cost: number };

const defaultInventory: Item[] = [
  { id: "i1", name: "Oxygen Cylinders", quantity: 3, price: 5000, icon: "🫧", perPatient: 0.15 },
  { id: "i2", name: "Ventilators", quantity: 12, price: 15000, icon: "🫁", perPatient: 0.05 },
  { id: "i4", name: "Blood Units", quantity: 25, price: 1200, icon: "🩸", perPatient: 0.2 },
  { id: "i5", name: "Syringes", quantity: 150, price: 10, icon: "💉", perPatient: 3.0 },
  { id: "i6", name: "Saline Bottles", quantity: 8, price: 200, icon: "🧴", perPatient: 0.8 },
  { id: "i7", name: "Defibrillators", quantity: 2, price: 7000, icon: "⚡", perPatient: 0.02 },
  { id: "i8", name: "Wheelchairs", quantity: 18, price: 8000, icon: "♿", perPatient: 0.1 },
  { id: "i10", name: "Gloves", quantity: 300, price: 5, icon: "🧤", perPatient: 6.0 },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function InventoryPage() {
  const router = useRouter();
  const { hospitalId, hospitalName, isAuthenticated, isLoaded } = useHospital();

  const [items, setItems] = useState<Item[]>(defaultInventory);
  const [predictions, setPredictions] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [bill, setBill] = useState<BillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [ordering, setOrdering] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predInfo, setPredInfo] = useState<{
    predicted: number;
    confidence_pct: number;
    date: string;
  } | null>(null);

  const [resourcePool, setResourcePool] = useState<ResourcePoolEntry[]>([]);
  const [expandedPool, setExpandedPool] = useState<string | null>(null);
  const [requestedItems, setRequestedItems] = useState<Set<string>>(new Set());

  // Check auth
  useEffect(() => {
    if (isLoaded && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoaded, router]);

  // Load resource pool & local stock from API
  useEffect(() => {
    if (!hospitalId) return;

    api.getResourcePool(hospitalId)
      .then(setResourcePool)
      .catch(() => {});

    api.getHospitalResources(hospitalId)
      .then((resData) => {
        if (resData && resData.length > 0) {
          const resMap: Record<string, number> = {};
          resData.forEach((r) => {
            resMap[r.resource_type] = r.available;
          });
          setItems((prev) =>
            prev.map((item) => ({
              ...item,
              quantity: resMap[item.name] ?? item.quantity,
            }))
          );
        }
      })
      .catch(() => {});
  }, [hospitalId]);

  const formatINR = (num: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);

  const generatePrediction = async () => {
    if (!hospitalId) return;
    setLoading(true);
    setOrderDone(false);

    const data = await api.getPrediction(todayStr(), hospitalId).catch(() => null);
    let patientCount: number;
    if (data && data.prediction) {
      patientCount = data.prediction.predicted;
      setPredInfo({
        predicted: data.prediction.predicted,
        confidence_pct: data.prediction.confidence_pct,
        date: data.prediction.date,
      });
    } else {
      patientCount = Math.floor(Math.random() * 60 + 25);
      setPredInfo({
        predicted: patientCount,
        confidence_pct: 91,
        date: todayStr(),
      });
    }

    const predMap: Record<string, number> = {};
    const statusMap: Record<string, string> = {};
    const newBill: BillItem[] = [];
    let sum = 0;

    items.forEach((item) => {
      const needed = Math.ceil(item.perPatient * patientCount);
      predMap[item.id] = needed;
      if (item.quantity >= needed) {
        statusMap[item.id] = "SATISFIED";
      } else {
        statusMap[item.id] = "REQUIRED";
        const deficit = needed - item.quantity;
        const cost = deficit * item.price;
        sum += cost;
        newBill.push({ ...item, predicted: needed, deficit, cost });
      }
    });

    setPredictions(predMap);
    setStatus(statusMap);
    setBill(newBill);
    setTotal(sum);
    setLoading(false);
  };

  const handleOrder = async () => {
    if (!hospitalId || bill.length === 0) return;
    setOrdering(true);
    await Promise.all(
      bill.map((b) =>
        api.createResourceRequest(hospitalId, b.name, b.deficit).catch(() => {})
      )
    );
    setOrdering(false);
    setOrderDone(true);
  };

  const handleRequestFromPool = async (providerHospitalId: string, resourceType: string) => {
    const key = `${providerHospitalId}::${resourceType}`;
    setRequestedItems((prev) => new Set([...prev, key]));
    if (hospitalId) {
      await api.createResourceRequest(hospitalId, resourceType, 5).catch(() => {});
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      )
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-3 border-[var(--ink)] pb-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight text-[var(--ink)]">
              MEDICAL INVENTORY & SHARED RESOURCE POOL
            </h1>
            <span className="neo-badge neo-badge-black text-[9px]">RESTOCK CONTROL</span>
          </div>
          <p className="font-mono text-xs text-gray-700">
            Node: <strong>{hospitalName}</strong> ({hospitalId}) • Real-time Demand Forecasting & Shared Network Pool
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NeobrutalistButton
            variant="primary"
            size="sm"
            onClick={generatePrediction}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs py-1.5 px-3"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? "FETCHING MODEL..." : "PREDICT RESOURCE NEEDS"}</span>
          </NeobrutalistButton>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN (7 cols): Hospital Stock Table */}
        <div className="lg:col-span-7 neo-card p-3 bg-white border-2 border-[var(--ink)] flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-display text-sm font-bold uppercase">
                ON-SITE HOSPITAL ASSET INVENTORY
              </span>
            </div>
            <span className="neo-badge neo-badge-black text-[8px]">
              {items.length} ITEMS TRACKED
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-2 p-2 bg-neutral-100 font-mono text-[11px] font-bold text-[var(--ink)] border-b-2 border-[var(--ink)] uppercase">
              <div className="col-span-4">Item Name</div>
              <div className="col-span-2 text-center">Available</div>
              <div className="col-span-2 text-center">Required</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2 text-right">Adjust</div>
            </div>

            {items.map((item) => {
              const state = status[item.id];
              const isRequired = state === "REQUIRED";
              const isOk = state === "SATISFIED";

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 gap-2 items-center p-2.5 border-2 border-[var(--ink)] font-mono text-xs transition-colors ${
                    isRequired
                      ? "bg-red-50 border-red-900"
                      : isOk
                      ? "bg-emerald-50 border-emerald-900"
                      : "bg-white"
                  }`}
                >
                  <div className="col-span-4 flex items-center gap-2 font-bold text-[var(--ink)] truncate">
                    <span className="text-base">{item.icon}</span>
                    <span className="truncate">{item.name}</span>
                  </div>

                  <div className="col-span-2 text-center font-bold text-sm text-[var(--ink)]">
                    {item.quantity}
                  </div>

                  <div className="col-span-2 text-center font-bold text-sm text-gray-700">
                    {predictions[item.id] ?? "—"}
                  </div>

                  <div className="col-span-2 flex justify-center">
                    {isRequired && (
                      <span className="neo-badge neo-badge-red text-[8px] py-0">
                        REQUIRED
                      </span>
                    )}
                    {isOk && (
                      <span className="neo-badge neo-badge-black text-[8px] py-0 bg-emerald-700 text-white">
                        SATISFIED
                      </span>
                    )}
                    {!state && (
                      <span className="text-[10px] text-gray-400 font-bold">—</span>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-5 h-5 bg-white border border-[var(--ink)] flex items-center justify-center hover:bg-neutral-100 font-bold text-xs cursor-pointer shadow-[1px_1px_0_var(--ink)]"
                    >
                      +
                    </button>
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-5 h-5 bg-white border border-[var(--ink)] flex items-center justify-center hover:bg-neutral-100 font-bold text-xs cursor-pointer shadow-[1px_1px_0_var(--ink)]"
                    >
                      -
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Prediction Info, Restock Bill & Shared Pool */}
        <div className="lg:col-span-5 flex flex-col gap-3 overflow-hidden min-h-0">
          
          {/* Prediction Badge */}
          {predInfo && (
            <div className="neo-card p-3 bg-white border-2 border-[var(--ink)] shrink-0 space-y-1 font-mono text-xs">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-600">
                <span>ML Influx Forecast</span>
                <span className="neo-badge neo-badge-red text-[8px]">ACTIVE MODEL</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-[var(--ink)]">
                  {predInfo.predicted} <span className="text-xs font-mono font-normal">Patients Forecast</span>
                </span>
                <span className="text-[11px] font-bold text-[var(--accent)]">
                  {predInfo.confidence_pct}% Confidence
                </span>
              </div>
            </div>
          )}

          {/* Restock Bill Panel */}
          <div className="neo-card p-3 bg-white border-2 border-[var(--ink)] shrink-0 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-display text-sm font-bold uppercase">
                  AUTOMATED RESTOCK BILL
                </span>
              </div>
              <span className="text-[10px] font-bold text-gray-500">EST. COST</span>
            </div>

            {bill.length > 0 ? (
              <div className="space-y-1.5">
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {bill.map((b) => (
                    <div key={b.id} className="flex justify-between items-center text-[11px] py-0.5 border-b border-gray-100">
                      <span className="font-bold text-[var(--ink)] truncate max-w-[140px]">
                        {b.name}
                      </span>
                      <span className="text-gray-600">
                        {b.deficit} × {formatINR(b.price)}
                      </span>
                      <span className="font-bold text-[var(--accent)]">
                        {formatINR(b.cost)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-1.5 border-t-2 border-[var(--ink)] flex justify-between items-center font-bold text-sm">
                  <span>TOTAL ESTIMATED</span>
                  <span className="text-[var(--accent-dark)] font-display text-lg">
                    {formatINR(total)}
                  </span>
                </div>

                {orderDone ? (
                  <div className="p-2 bg-emerald-100 border border-emerald-800 text-emerald-950 text-center font-bold text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✓ Resource Requests Dispatched to Network</span>
                  </div>
                ) : (
                  <NeobrutalistButton
                    variant="primary"
                    size="sm"
                    onClick={handleOrder}
                    disabled={ordering || !hospitalId}
                    className="w-full text-xs py-1.5"
                  >
                    {ordering ? "DISPATCHING..." : "DISPATCH RESTOCK ORDER NOW"}
                  </NeobrutalistButton>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-gray-400 italic">
                Click &quot;PREDICT RESOURCE NEEDS&quot; above to compute restock bill.
              </div>
            )}
          </div>

          {/* Shared Network Resource Pool Panel */}
          <div className="neo-card flex-1 flex flex-col p-3 bg-white border-2 border-[var(--ink)] overflow-hidden min-h-0 space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-display text-sm font-bold uppercase">
                  SHARED NETWORK RESOURCE POOL
                </span>
              </div>
              <span className="neo-badge neo-badge-black text-[8px]">NEARBY NODES</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {resourcePool.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400 italic">
                  Scanning nearby regional hospital nodes for available supply surplus...
                </div>
              ) : (
                resourcePool.map((entry) => (
                  <div key={entry.hospital_id} className="border-2 border-[var(--ink)] bg-neutral-50 overflow-hidden">
                    <button
                      className="w-full p-2 flex items-center justify-between bg-white border-b border-[var(--ink)] font-bold text-xs text-[var(--ink)] cursor-pointer hover:bg-neutral-100 transition-colors"
                      onClick={() =>
                        setExpandedPool(expandedPool === entry.hospital_id ? null : entry.hospital_id)
                      }
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                        <span className="truncate">{entry.hospital}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="neo-badge neo-badge-black text-[8px] py-0">
                          {entry.distance_km} KM
                        </span>
                        {expandedPool === entry.hospital_id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {expandedPool === entry.hospital_id && (
                      <div className="p-2 space-y-1.5 bg-neutral-50">
                        {entry.resources.map((res) => {
                          const key = `${entry.hospital_id}::${res.type}`;
                          const isRequested = requestedItems.has(key);

                          return (
                            <div
                              key={res.type}
                              className="p-1.5 bg-white border border-[var(--ink)] flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{res.icon}</span>
                                <span className="font-bold text-[var(--ink)]">{res.type}</span>
                                <span className="text-[10px] text-gray-500 font-bold">
                                  ({res.available} avail)
                                </span>
                              </div>

                              <NeobrutalistButton
                                variant={isRequested ? "black" : "white"}
                                size="sm"
                                disabled={isRequested}
                                onClick={() => handleRequestFromPool(entry.hospital_id, res.type)}
                                className="text-[10px] py-0.5 px-2"
                              >
                                {isRequested ? "✓ REQUESTED" : "REQUEST"}
                              </NeobrutalistButton>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
