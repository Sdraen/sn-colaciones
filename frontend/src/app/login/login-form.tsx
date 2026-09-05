"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Link2, LoaderCircle, LogIn, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type LoginMode = "password" | "magic_link";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const normalizedEmail = email.trim().toLocaleLowerCase("es-CL");

    if (mode === "password") {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError("Correo o contraseña incorrectos.");
        setPending(false);
        return;
      }

      window.location.assign(nextPath);
      return;
    }

    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
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
    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
      <div className="login-mode-switch grid grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1" aria-label="Método de acceso">
        <button
          type="button"
          aria-pressed={mode === "password"}
          onClick={() => selectMode("password")}
          className={`login-mode-button min-h-10 rounded-lg px-2 text-xs font-extrabold sm:text-sm ${
            mode === "password" ? "bg-white text-[var(--brand)] shadow-sm" : "text-[var(--muted)]"
          }`}
        >
          Contraseña
        </button>
        <button
          type="button"
          aria-pressed={mode === "magic_link"}
          onClick={() => selectMode("magic_link")}
          className={`login-mode-button min-h-10 rounded-lg px-2 text-xs font-extrabold sm:text-sm ${
            mode === "magic_link" ? "bg-white text-[var(--brand)] shadow-sm" : "text-[var(--muted)]"
          }`}
        >
          Enlace por correo
        </button>
      </div>

      <div className="login-fields-enter" key={mode}>
        <p className="mb-3 text-xs leading-5 text-[var(--muted)]">
          {mode === "password"
            ? "Usa la contraseña asignada a tu cuenta."
            : "Te enviaremos un enlace seguro que podrás usar una sola vez."}
        </p>
        <label htmlFor="email" className="text-sm font-extrabold">
          Correo autorizado
        </label>
        <div className="login-field mt-1.5 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3.5">
          <Mail size={18} className="shrink-0 text-[var(--brand)]" aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@correo.cl"
            className="min-h-11 min-w-0 w-full bg-transparent py-2.5 outline-none"
          />
        </div>

        {mode === "password" ? (
          <div className="mt-4">
            <label htmlFor="password" className="text-sm font-extrabold">
              Contraseña
            </label>
            <div className="login-field mt-1.5 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3.5">
              <KeyRound size={18} className="shrink-0 text-[var(--brand)]" aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-11 min-w-0 flex-1 bg-transparent py-2.5 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="focus-ring grid size-9 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="login-feedback-enter rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="login-feedback-enter rounded-xl bg-[var(--herb-soft)] px-3.5 py-2.5 text-sm font-semibold text-[var(--herb-strong)]">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="login-submit focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
        ) : mode === "password" ? (
          <LogIn size={18} aria-hidden="true" />
        ) : (
          <Link2 size={18} aria-hidden="true" />
        )}
        {pending
          ? mode === "password"
            ? "Ingresando..."
            : "Enviando..."
          : mode === "password"
            ? "Ingresar"
            : "Enviar enlace de acceso"}
      </button>
    </form>
  );
}
