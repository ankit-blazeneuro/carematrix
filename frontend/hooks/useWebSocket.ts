"use client";

import { useEffect, useRef, useState } from "react";

type WebSocketData = {
  id: string;
  patient_id: string;
  hospital_id: string;
  hospital_name: string;
  requester_hospital_id: string;
  requester_hospital_name: string;
  department: string;
  priority: "Critical" | "High" | "Medium" | "Moderate" | "Low";
  status: string;
  [key: string]: string | number | boolean | null | undefined;
};

function getWsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:8000`;
  }

  return "ws://localhost:8000";
}

export function useWebSocket(
  channel: "transfers" | "resources" | "heatmap",
  onMessage: (event: string, data: WebSocketData) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        const wsUrl = getWsBaseUrl();
        const fullUrl = `${wsUrl}/ws/${channel}`;
        console.log(`[CareMatrix WS] Connecting to ${fullUrl}`);
        const ws = new WebSocket(fullUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) setIsConnected(true);
          console.log(`[CareMatrix WS] Connected to channel: ${channel}`);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            onMessageRef.current(parsed.event, parsed.data as WebSocketData);
          } catch (e) {
            console.error("[CareMatrix WS] Error parsing message:", e);
          }
        };

        ws.onerror = () => {
          if (isMounted) setIsConnected(false);
        };

        ws.onclose = () => {
          if (isMounted) setIsConnected(false);
          reconnectTimeout = setTimeout(() => {
            if (isMounted) connect();
          }, 5000);
        };
      } catch {
        if (isMounted) setIsConnected(false);
        reconnectTimeout = setTimeout(() => {
          if (isMounted) connect();
        }, 5000);
      }
    };

    connect();

    // 3-second polling fallback if WebSockets are disconnected
    const pollInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        onMessageRef.current(
          "poll_sync",
          { channel, timestamp: Date.now() } as unknown as WebSocketData
        );
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [channel]);

  return { isConnected };
}
