"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_INTERVAL_MS = 30_000;

export function useAutoRefresh(
  refreshAction: () => Promise<void>,
  {
    enabled = true,
    intervalMs = DEFAULT_INTERVAL_MS,
  }: { enabled?: boolean; intervalMs?: number } = {},
) {
  const actionRef = useRef(refreshAction);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState("");

  useEffect(() => {
    actionRef.current = refreshAction;
  }, [refreshAction]);

  const refreshNow = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;

    setRefreshing(true);
    const request = actionRef
      .current()
      .then(() => {
        setLastUpdatedAt(new Date());
        setRefreshError("");
      })
      .catch((caught: unknown) => {
        setRefreshError(
          caught instanceof Error ? caught.message : "No fue posible actualizar los datos",
        );
      })
      .finally(() => {
        inFlightRef.current = null;
        setRefreshing(false);
      });

    inFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshNow();
    };
    const timer = window.setInterval(refreshWhenVisible, intervalMs);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [enabled, intervalMs, refreshNow]);

  return { lastUpdatedAt, refreshError, refreshing, refreshNow };
}

export function formatRefreshTime(value: Date | null) {
  if (!value) return "Actualización automática cada 30 segundos";
  return `Actualizado a las ${new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value)}`;
}
