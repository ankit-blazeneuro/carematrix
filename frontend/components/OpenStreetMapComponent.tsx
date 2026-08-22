"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { HeatmapHospital } from "@/types";

// Leaflet default icon fix for bundlers
const createCustomIcon = (name: string, demandPct: number, isSelected: boolean) => {
  const isCritical = demandPct >= 85;
  const isHeavy = demandPct >= 70 && demandPct < 85;
  const bgColor = isCritical ? "#dc2626" : isHeavy ? "#000000" : "#ffffff";
  const textColor = isCritical || isHeavy ? "#ffffff" : "#000000";
  const borderColor = isSelected ? "#dc2626" : "#000000";
  const borderWidth = isSelected ? "3px" : "2px";
  const shadow = isSelected ? "3px 3px 0 #dc2626" : "2px 2px 0 #000000";

  const html = `
    <div style="
      background: ${bgColor};
      color: ${textColor};
      border: ${borderWidth} solid ${borderColor};
      box-shadow: ${shadow};
      padding: 3px 6px;
      font-family: Impact, Arial Black, sans-serif;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: bold;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transform: translate(-50%, -50%);
    ">
      <span style="
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${isCritical ? "#ffffff" : isHeavy ? "#dc2626" : "#22c55e"};
        display: inline-block;
      "></span>
      <span>${name}</span>
      <span style="
        font-family: Courier New, monospace;
        font-size: 10px;
        padding: 0 3px;
        background: ${isCritical ? "#991b1b" : "#e4e4e7"};
        color: ${isCritical ? "#ffffff" : "#000000"};
      ">${demandPct}%</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-leaflet-marker",
    iconSize: [120, 30],
    iconAnchor: [60, 15],
  });
};

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

interface Props {
  hospitals: HeatmapHospital[];
  selectedHospital: HeatmapHospital | null;
  onSelectHospital: (hospital: HeatmapHospital) => void;
}

export default function OpenStreetMapComponent({
  hospitals,
  selectedHospital,
  onSelectHospital,
}: Props) {
  const defaultCenter: [number, number] = selectedHospital
    ? [selectedHospital.lat, selectedHospital.lng]
    : [28.445, 77.0];

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      >
        <ChangeView
          center={
            selectedHospital
              ? [selectedHospital.lat, selectedHospital.lng]
              : defaultCenter
          }
          zoom={13}
        />

        {/* OpenStreetMap standard raster tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Capacity Demand Circles and Hospital Markers */}
        {hospitals.map((hosp) => {
          const isCritical = hosp.demand_pct >= 85;
          const isSelected = selectedHospital?.id === hosp.id;
          const icon = createCustomIcon(hosp.name, hosp.demand_pct, isSelected);

          return (
            <React.Fragment key={hosp.id}>
              {/* Heat radius circle */}
              <Circle
                center={[hosp.lat, hosp.lng]}
                radius={isCritical ? 1400 : 900}
                pathOptions={{
                  color: isCritical ? "#dc2626" : "#000000",
                  fillColor: isCritical ? "#dc2626" : "#71717a",
                  fillOpacity: isCritical ? 0.35 : 0.15,
                  weight: isSelected ? 3 : 1.5,
                  dashArray: isCritical ? "4, 4" : undefined,
                }}
              />

              {/* Marker with Neobrutalist DivIcon */}
              <Marker
                position={[hosp.lat, hosp.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectHospital(hosp),
                }}
              >
                <Popup className="neo-popup">
                  <div className="p-1 font-mono text-xs space-y-1">
                    <strong className="font-display uppercase text-sm block border-b border-black pb-0.5">
                      {hosp.name}
                    </strong>
                    <div>Total Beds: <strong>{hosp.total_beds}</strong></div>
                    <div>Available: <strong className="text-[var(--accent)]">{hosp.available_beds}</strong></div>
                    <div>BOR Load: <strong>{hosp.demand_pct}%</strong></div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
