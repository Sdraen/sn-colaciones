"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  LogOut,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "loading" | "setup" | "enrolling" | "challenge";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function MfaFlow({
  email,
  fullName,
  nextPath,
}: {
  email: string;
  fullName: string;
  nextPath: string;
}) {
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function inspectFactors() {
      const supabase = createClient();
      const [assurance, factors] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (!active) return;

      if (assurance.error || factors.error) {
        setError("No fue posible comprobar la verificacion de tu cuenta.");
        setMode("setup");
        return;
      }
      if (assurance.data.currentLevel === "aal2") {
        window.location.replace(nextPath);
        return;
      }

      const verifiedFactor = factors.data.totp[0];
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setMode("challenge");
        return;
      }

      setMode("setup");
    }

    void inspectFactors();
    return () => {
      active = false;
    };
  }, [nextPath]);

  async function beginEnrollment() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) {
      setError("No fue posible preparar la autenticacion en este momento.");
      setPending(false);
      return;
    }

    const verifiedFactor = factors.data.totp[0];
    if (verifiedFactor) {
      setFactorId(verifiedFactor.id);
      setMode("challenge");
      setPending(false);
      return;
    }

    const unverifiedFactors = factors.data.all.filter(
      (factor) => factor.factor_type === "totp" && factor.status === "unverified",
    );
    for (const factor of unverifiedFactors) {
      const removal = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (removal.error) {
        setError("No fue posible reiniciar la configuracion anterior.");
        setPending(false);
        return;
      }
    }

    const result = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "SN Colaciones",
      issuer: "SN Colaciones",
    });
    if (result.error) {
      setError("No fue posible generar el codigo QR. Intenta nuevamente.");
      setPending(false);
      return;
    }

    setFactorId(result.data.id);
    setEnrollment({
      factorId: result.data.id,
      qrCode: qrDataUrl(result.data.totp.qr_code),
      secret: result.data.totp.secret,
    });
    setMode("enrolling");
    setPending(false);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Ingresa los seis digitos de tu aplicacion de autenticacion.");
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) {
      setError("El codigo es incorrecto o ya vencio. Usa el codigo actual e intenta nuevamente.");
      setPending(false);
      return;
    }

    window.location.replace(nextPath);
  }

  async function copySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No fue posible copiar la clave. Puedes ingresarla manualmente.");
    }
  }

  if (mode === "loading") {
    return (
      <div className="py-8 text-center" aria-live="polite">
        <LoaderCircle
          size={28}
          className="mx-auto animate-spin text-[var(--brand)]"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
          Comprobando la seguridad de tu cuenta...
        </p>
      </div>
    );
  }

  if (mode === "setup") {
    return (
      <div>
        <AccountSummary email={email} fullName={fullName} />
        <div className="mt-4 rounded-2xl bg-[var(--herb-soft)] p-4 text-sm leading-6 text-[var(--herb-strong)]">
          <div className="flex items-start gap-3">
            <Smartphone size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-extrabold">Configura tu telefono una sola vez</p>
              <p className="mt-1">
                Necesitas Google Authenticator, Microsoft Authenticator, Authy o una aplicacion compatible.
              </p>
            </div>
          </div>
        </div>
        <ol className="mt-4 space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
          <li>Abre la aplicacion de autenticacion en tu telefono.</li>
          <li>Escanea el codigo QR que mostraremos.</li>
          <li>Escribe el codigo de seis digitos para confirmar.</li>
        </ol>
        <Feedback error={error} />
        <button
          type="button"
          disabled={pending}
          onClick={() => void beginEnrollment()}
          className="login-submit focus-ring mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? (
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <QrCode size={18} aria-hidden="true" />
          )}
          {pending ? "Preparando..." : "Configurar autenticacion"}
        </button>
        <SignOutLink />
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={verify}>
        <AccountSummary email={email} fullName={fullName} />

        {mode === "enrolling" && enrollment ? (
          <div className="mt-4">
            <p className="text-sm font-extrabold">1. Escanea este codigo QR</p>
            <div className="mx-auto mt-3 w-fit rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
              <Image
                src={enrollment.qrCode}
                alt="Codigo QR para configurar SN Colaciones en la aplicacion de autenticacion"
                width={220}
                height={220}
                unoptimized
                className="size-[220px] max-w-full"
              />
            </div>
            <details className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
              <summary className="cursor-pointer text-sm font-extrabold">
                No puedo escanear el codigo
              </summary>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Ingresa esta clave manualmente en tu aplicacion. No la compartas ni la envies por correo.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs font-bold">
                  {enrollment.secret}
                </code>
                <button
                  type="button"
                  onClick={() => void copySecret()}
                  className="focus-ring grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-white text-[var(--brand)]"
                  aria-label="Copiar clave de configuracion"
                >
                  {copied ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <Copy size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
            </details>
            <p className="mt-5 text-sm font-extrabold">2. Confirma el codigo generado</p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm leading-6">
            <div className="flex items-start gap-3">
              <KeyRound size={20} className="mt-0.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
              <div>
                <p className="font-extrabold">Revisa tu aplicacion de autenticacion</p>
                <p className="mt-1 text-[var(--muted)]">
                  Escribe el codigo actual asociado a SN Colaciones.
                </p>
              </div>
            </div>
          </div>
        )}

        <label htmlFor="mfa-code" className="mt-4 block text-sm font-extrabold">
          Codigo de seis digitos
        </label>
        <div className="login-field mt-1.5 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3.5">
          <ShieldCheck size={18} className="shrink-0 text-[var(--herb)]" aria-hidden="true" />
          <input
            id="mfa-code"
            name="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="min-h-11 min-w-0 flex-1 bg-transparent py-2.5 text-center text-xl font-black tracking-[0.35em] outline-none"
            aria-describedby={error ? "mfa-error" : undefined}
          />
        </div>

        <Feedback error={error} />
        <button
          type="submit"
          disabled={pending || code.length !== 6}
          className="login-submit focus-ring mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? (
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck size={18} aria-hidden="true" />
          )}
          {pending ? "Verificando..." : "Verificar y continuar"}
        </button>
      </form>
      <SignOutLink />
    </div>
  );
}

function AccountSummary({ email, fullName }: { email: string; fullName: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">
      <span className="block text-xs font-bold text-[var(--muted)]">Cuenta administrativa</span>
      <strong className="block truncate">{fullName}</strong>
      <span className="block truncate text-xs text-[var(--muted)]">{email}</span>
    </div>
  );
}

function Feedback({ error }: { error: string | null }) {
  return error ? (
    <p
      id="mfa-error"
      role="alert"
      className="login-feedback-enter mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-[var(--danger)]"
    >
      {error}
    </p>
  ) : null;
}

function SignOutLink() {
  return (
    <form action="/auth/signout" method="post" className="mt-4">
      <button
        type="submit"
        className="focus-ring flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-[var(--muted)] hover:bg-[var(--surface-muted)]"
      >
        <LogOut size={17} aria-hidden="true" />
        Cerrar sesion
      </button>
    </form>
  );
}

function qrDataUrl(qrCode: string) {
  return qrCode.startsWith("data:")
    ? qrCode
    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
}
