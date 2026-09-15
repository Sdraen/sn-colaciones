"use client";

import { useEffect } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AuthSessionBridge() {
  useEffect(() => {
    let active = true;

    async function activateSession() {
      const supabase = createClient();
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          redirectToLogin();
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
      }

      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        redirectToLogin();
        return;
      }
      window.location.replace("/crear-contrasena");
    }

    void activateSession();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="login-page-enter page-shell grid min-h-[calc(100vh-72px)] place-items-center">
      <section className="card w-full max-w-[420px] p-7 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--herb-soft)] text-[var(--herb-strong)]">
          <ShieldCheck size={23} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-black">Validando tu acceso</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Espera un momento mientras protegemos tu sesión.
        </p>
        <LoaderCircle
          size={24}
          className="mx-auto mt-5 animate-spin text-[var(--brand)]"
          aria-label="Validando"
        />
      </section>
    </main>
  );
}

function redirectToLogin() {
  const login = new URL("/login", window.location.origin);
  login.searchParams.set("error", "El enlace venció o ya fue utilizado. Solicita uno nuevo.");
  window.location.replace(login.toString());
}
