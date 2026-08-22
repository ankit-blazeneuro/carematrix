"use client";

import React, { useRef } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip } from "react-leaflet";
import { HeatmapHospital } from "@/types";

interface MapInnerProps {
  hospitals: HeatmapHospital[];
  selected: HeatmapHospital | null;
  onSelect: (h: HeatmapHospital) => void;
  zoneColor: (demand: number) => { fill: string; stroke: string; label: string };
  circleRadius: (total: number) => number;
}

export default function MapInner({
  hospitals,
  selected,
  onSelect,
  zoneColor,
  circleRadius,
}: MapInnerProps) {
  const mapRef = useRef(null);

  return (
    <MapContainer
      ref={mapRef}
      center={[28.57, 77.18]}
      zoom={11}
      style={{ width: "100%", height: "100%" }}
      className="z-10"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hospitals.map((h) => {
        const demandVal = h.demand_pct ?? h.demand ?? 50;
        const totalBeds = h.total_beds ?? h.total ?? 100;
        const availBeds = h.available_beds ?? h.available ?? 20;

        const { fill, stroke } = zoneColor(demandVal);
        const isSelected = selected?.id === h.id;

        return (
          <React.Fragment key={h.id}>
            {/* Translucent zone circle */}
            <Circle
              center={[h.lat, h.lng]}
              radius={circleRadius(totalBeds)}
              pathOptions={{
                color: stroke,
                fillColor: fill,
                fillOpacity: isSelected ? 0.38 : 0.22,
                weight: isSelected ? 3 : 1.8,
                dashArray: isSelected ? undefined : "6 4",
              }}
            />
            {/* Solid pin marker */}
            <CircleMarker
              center={[h.lat, h.lng]}
              radius={isSelected ? 11 : 8}
              pathOptions={{
                color: "#111111",
                fillColor: fill,
                fillOpacity: 1,
                weight: isSelected ? 3.5 : 2,
              }}
              eventHandlers={{ click: () => onSelect(h) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                <div className="font-mono text-xs p-1">
                  <strong className="block text-sm">{h.name}</strong>
                  <span>{demandVal}% Utilised • {availBeds} Beds Free</span>
                </div>
              </Tooltip>
            </CircleMarker>
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
