"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHospital } from "@/context/HospitalContext";
import { HeatMapCanvas } from "@/components/HeatMapCanvas";

export default function HeatMapPage() {
  const router = useRouter();
  const { isAuthenticated, isLoaded } = useHospital();

  useEffect(() => {
    if (isLoaded && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoaded, router]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <HeatMapCanvas />
    </div>
  );
}
