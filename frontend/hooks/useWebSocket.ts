"use client";

import { useEffect, useRef, useState } from "react";

function getWsBaseUrl(): string {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host; // Contains host and port (e.g. 192.168.1.15:3000)
    return `${protocol}//${host}`;
  }
  return process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
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
            onMessageRef.current(parsed.event, parsed.data);
          } catch (e) {
            console.error("[CareMatrix WS] Error parsing message:", e);
          }
        };

        ws.onerror = (err) => {
          console.warn(`[CareMatrix WS] Socket error on channel ${channel}:`, err);
          if (isMounted) setIsConnected(false);
        };

        ws.onclose = () => {
          if (isMounted) setIsConnected(false);
          // Try reconnecting after 4 seconds
          reconnectTimeout = setTimeout(() => {
            if (isMounted) connect();
          }, 4000);
        };
      } catch (err) {
        if (isMounted) setIsConnected(false);
        reconnectTimeout = setTimeout(() => {
          if (isMounted) connect();
        }, 4000);
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
