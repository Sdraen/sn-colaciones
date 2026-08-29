"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Mail, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: false,
      },
    });

    if (authError) setError("No fue posible solicitar el acceso. Intenta nuevamente.");
    else setMessage("Revisa tu correo y abre el enlace de acceso. También revisa spam.");
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="text-sm font-extrabold">
          Correo autorizado
        </label>
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 focus-within:border-[var(--brand)]">
          <Mail size={19} className="text-[var(--brand)]" aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@correo.cl"
            className="min-h-13 w-full bg-transparent py-3 outline-none"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-xl bg-[var(--herb-soft)] px-4 py-3 text-sm font-semibold text-[var(--herb-strong)]">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="focus-ring flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-5 font-extrabold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? <LoaderCircle size={19} className="animate-spin" /> : <Send size={19} />}
        {pending ? "Enviando..." : "Enviar enlace de acceso"}
      </button>
    </form>
  );
}
