"use client";

import { useEffect, useRef, useState } from "react";

function getWsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    return `${protocol}//${host}:8000`;
  }
  return "ws://localhost:8000";
}

export function useWebSocket(
  channel: "transfers" | "resources" | "heatmap",
  onMessage: (event: string, data: any) => void
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
    let pollInterval: NodeJS.Timeout;

    const connect = () => {
      try {
        const wsUrl = getWsBaseUrl();
        const ws = new WebSocket(`${wsUrl}/ws/${channel}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) setIsConnected(true);
          console.log(`[CareMatrix WS] Connected to channel: ${channel}`);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            onMessageRef.current(parsed.event, parsed.data);
          } catch (e) {
            console.error("[CareMatrix WS] Error parsing message:", e);
          }
        };

        ws.onerror = () => {
          if (isMounted) setIsConnected(false);
        };

        ws.onclose = () => {
          if (isMounted) setIsConnected(false);
          // Try reconnecting after 5 seconds
          reconnectTimeout = setTimeout(() => {
            if (isMounted) connect();
          }, 5000);
        };
      } catch (err) {
        if (isMounted) setIsConnected(false);
        reconnectTimeout = setTimeout(() => {
          if (isMounted) connect();
        }, 5000);
      }
    };

    connect();

    // 3-second polling fallback if WebSockets are disconnected
    pollInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        onMessageRef.current("poll_sync", { channel, timestamp: Date.now() });
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
