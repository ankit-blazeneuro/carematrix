"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface HospitalContextType {
  hospitalId: string | null;
  hospitalName: string | null;
  lat: number;
  lng: number;
  login: (id: string, name?: string, lat?: number, lng?: number) => void;
  logout: () => void;
}

const DEFAULT_HOSPITALS: Record<string, { name: string; lat: number; lng: number }> = {
  hospital123: { name: "Sarvodaya General Hospital", lat: 28.445, lng: 76.997 },
  hospital456: { name: "City Care Emergency Center", lat: 28.46, lng: 77.02 },
  hospital789: { name: "Apex Health Institute", lat: 28.43, lng: 76.98 },
};

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

export function HospitalProvider({ children }: { children: React.ReactNode }) {
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [hospitalName, setHospitalName] = useState<string | null>(null);
  const [lat, setLat] = useState<number>(28.445);
  const [lng, setLng] = useState<number>(76.997);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem("carematrix_hospital_id");
      if (savedId && DEFAULT_HOSPITALS[savedId]) {
        setHospitalId(savedId);
        setHospitalName(DEFAULT_HOSPITALS[savedId].name);
        setLat(DEFAULT_HOSPITALS[savedId].lat);
        setLng(DEFAULT_HOSPITALS[savedId].lng);
      } else {
        // Default login for quick demo
        const defaultId = "hospital123";
        setHospitalId(defaultId);
        setHospitalName(DEFAULT_HOSPITALS[defaultId].name);
        setLat(DEFAULT_HOSPITALS[defaultId].lat);
        setLng(DEFAULT_HOSPITALS[defaultId].lng);
      }
    } catch {
      // localStorage error fallback
    }
    setIsLoaded(true);
  }, []);

  const login = (id: string, name?: string, customLat?: number, customLng?: number) => {
    const meta = DEFAULT_HOSPITALS[id] || {
      name: name || `Hospital (${id})`,
      lat: customLat || 28.445,
      lng: customLng || 76.997,
    };
    setHospitalId(id);
    setHospitalName(name || meta.name);
    setLat(customLat || meta.lat);
    setLng(customLng || meta.lng);
    try {
      localStorage.setItem("carematrix_hospital_id", id);
    } catch {}
  };

  const logout = () => {
    setHospitalId(null);
    setHospitalName(null);
    try {
      localStorage.removeItem("carematrix_hospital_id");
    } catch {}
  };

  return (
    <HospitalContext.Provider
      value={{
        hospitalId,
        hospitalName,
        lat,
        lng,
        login,
        logout,
      }}
    >
      {children}
    </HospitalContext.Provider>
  );
}

export function useHospital() {
  const context = useContext(HospitalContext);
  if (!context) {
    throw new Error("useHospital must be used within a HospitalProvider");
  }
  return context;
}
