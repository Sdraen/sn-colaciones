"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { createClient } from "@/lib/supabase/client";

const minimumPasswordLength = 10;

export function CreatePasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < minimumPasswordLength) {
      setError(`La contraseña debe tener al menos ${minimumPasswordLength} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError("No fue posible guardar la contraseña. Solicita un enlace nuevo.");
      return;
    }
    setMessage("Tu contraseña quedó guardada. Ya puedes usarla para tus próximos ingresos.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">
        <span className="block text-xs font-bold text-[var(--muted)]">Cuenta</span>
        <strong className="break-all">{email}</strong>
      </div>

      <PasswordField
        id="new-password"
        label="Nueva contraseña"
        value={password}
        onChange={setPassword}
        visible={showPassword}
        onToggleVisibility={() => setShowPassword((current) => !current)}
      />
      <PasswordField
        id="confirm-password"
        label="Repetir contraseña"
        value={confirmation}
        onChange={setConfirmation}
        visible={showPassword}
      />

      <p className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--herb)]" />
        Usa al menos {minimumPasswordLength} caracteres y no compartas tu clave.
      </p>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="login-submit focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <KeyRound size={18} aria-hidden="true" />
        )}
        {pending ? "Guardando..." : "Guardar contraseña"}
      </button>

      <SuccessDialog
        message={message}
        title="Contraseña creada"
        onClose={() => window.location.replace("/")}
      />
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility?: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-extrabold">
        {label}
      </label>
      <div className="login-field mt-1.5 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3.5">
        <KeyRound size={18} className="shrink-0 text-[var(--brand)]" aria-hidden="true" />
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={minimumPasswordLength}
          maxLength={72}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 min-w-0 flex-1 bg-transparent py-2.5 outline-none"
        />
        {onToggleVisibility ? (
          <button
            type="button"
            onClick={onToggleVisibility}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            className="focus-ring grid size-9 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          >
            {visible ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
