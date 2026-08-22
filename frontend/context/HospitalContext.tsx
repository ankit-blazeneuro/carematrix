"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface HospitalMeta {
  name: string;
  short: string;
  location: string;
  lat: number;
  lng: number;
  password?: string;
}

export const KNOWN_HOSPITALS: Record<string, HospitalMeta> = {
  hospital123: {
    name: "Sarvodaya General Hospital",
    short: "SGH",
    location: "Sector 45, Gurugram, NCR",
    lat: 28.4450,
    lng: 76.9970,
    password: "password123",
  },
  hospital321: {
    name: "Global Care Medical Centre",
    short: "GMC",
    location: "Connaught Place, New Delhi",
    lat: 28.6329,
    lng: 77.2195,
    password: "password123",
  },
  hospital456: {
    name: "City Care Emergency Center",
    short: "CCE",
    location: "Sector 62, Noida, UP",
    lat: 28.62,
    lng: 77.36,
    password: "password123",
  },
  hospital789: {
    name: "Apex Health Institute",
    short: "AHI",
    location: "Mathura Road, Faridabad, HR",
    lat: 28.43,
    lng: 76.98,
    password: "password123",
  },
};

export interface HospitalContextType {
  hospitalId: string | null;
  hospitalName: string | null;
  location: string | null;
  shortCode: string | null;
  lat: number;
  lng: number;
  isAuthenticated: boolean;
  isLoaded: boolean;
  login: (id: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

export function HospitalProvider({ children }: { children: React.ReactNode }) {
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [hospitalName, setHospitalName] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [lat, setLat] = useState<number>(28.445);
  const [lng, setLng] = useState<number>(76.997);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem("carematrix_hospital_id");
      const savedAuth = localStorage.getItem("carematrix_auth");

      if (savedId && savedAuth === "true") {
        const meta = KNOWN_HOSPITALS[savedId] || {
          name: localStorage.getItem("carematrix_hospital_name") || `Facility (${savedId})`,
          short: savedId.slice(0, 3).toUpperCase(),
          location: "NCR Medical Grid",
          lat: 28.445,
          lng: 76.997,
        };
        setHospitalId(savedId);
        setHospitalName(meta.name);
        setShortCode(meta.short);
        setLocation(meta.location);
        setLat(meta.lat);
        setLng(meta.lng);
        setIsAuthenticated(true);
      }
    } catch {
      // Storage error fallback
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const login = (id: string, password: string): { success: boolean; error?: string } => {
    const trimmedId = id.trim();
    const trimmedPass = password.trim();

    if (!trimmedId) {
      return { success: false, error: "Hospital Node ID is required." };
    }

    if (!trimmedPass) {
      return { success: false, error: "Password is required." };
    }

    const meta = KNOWN_HOSPITALS[trimmedId];
    if (meta && meta.password && meta.password !== trimmedPass) {
      return { success: false, error: "Invalid password for this facility node." };
    }

    const finalName = meta?.name || `Facility Node (${trimmedId})`;
    const finalShort = meta?.short || trimmedId.slice(0, 3).toUpperCase();
    const finalLocation = meta?.location || "NCR Healthcare Mesh";
    const finalLat = meta?.lat || 28.445;
    const finalLng = meta?.lng || 76.997;

    setHospitalId(trimmedId);
    setHospitalName(finalName);
    setShortCode(finalShort);
    setLocation(finalLocation);
    setLat(finalLat);
    setLng(finalLng);
    setIsAuthenticated(true);

    try {
      localStorage.setItem("carematrix_hospital_id", trimmedId);
      localStorage.setItem("carematrix_hospital_name", finalName);
      localStorage.setItem("carematrix_auth", "true");
    } catch {}

    return { success: true };
  };

  const logout = () => {
    setHospitalId(null);
    setHospitalName(null);
    setLocation(null);
    setShortCode(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem("carematrix_hospital_id");
      localStorage.removeItem("carematrix_hospital_name");
      localStorage.removeItem("carematrix_auth");
    } catch {}
  };

  return (
    <HospitalContext.Provider
      value={{
        hospitalId,
        hospitalName,
        location,
        shortCode,
        lat,
        lng,
        isAuthenticated,
        isLoaded,
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
