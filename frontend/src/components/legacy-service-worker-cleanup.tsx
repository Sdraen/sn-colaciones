"use client";

import { useEffect } from "react";

const RELOAD_KEY = "sn-colaciones:legacy-service-worker-cleanup:v1";

export function LegacyServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let mounted = true;

    async function unregisterLegacyWorkers() {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;

      const hadController = Boolean(navigator.serviceWorker.controller);
      const results = await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
      const removedWorker = results.some(Boolean);

      if (
        mounted &&
        hadController &&
        removedWorker &&
        window.sessionStorage.getItem(RELOAD_KEY) !== "done"
      ) {
        window.sessionStorage.setItem(RELOAD_KEY, "done");
        window.location.reload();
      }
    }

    void unregisterLegacyWorkers().catch((error: unknown) => {
      console.error("[service-worker-cleanup] No fue posible quitar el registro obsoleto", {
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
