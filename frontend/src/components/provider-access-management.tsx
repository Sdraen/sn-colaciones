"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Mail, Search, Send, ShieldCheck, Truck, UserCheck, UserPlus, UserX } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { browserApiRequest } from "@/lib/api/client";
import type { ProviderAccessAccountDto, ProviderManagedRole } from "@/lib/api/contracts";

export function ProviderAccessManagement({
  initialAccounts,
}: {
  initialAccounts: ProviderAccessAccountDto[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [role, setRole] = useState<ProviderManagedRole>("delivery");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredAccounts = useMemo(() => {
    const term = normalize(search);
    if (!term) return accounts;
    return accounts.filter((account) =>
      normalize(`${account.fullName} ${account.email ?? ""}`).includes(term),
    );
  }, [accounts, search]);

  const activeAccounts = accounts.filter((account) => account.active).length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const account = await browserApiRequest<ProviderAccessAccountDto>(
        "/api/v1/provider/access-users",
        {
          method: "POST",
          body: JSON.stringify({
            fullName: String(data.get("fullName")),
            email: String(data.get("email")),
            role,
          }),
        },
      );
      setAccounts((current) =>
        [...current, account].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, "es-CL"),
        ),
      );
      form.reset();
      setMessage(
        `Enviamos a ${account.email} la invitación para que ${account.fullName} cree su contraseña.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible crear la cuenta de acceso.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordSetup(account: ProviderAccessAccountDto) {
    setSendingId(account.id);
    setMessage("");
    setError("");
    try {
      await browserApiRequest<{ email: string }>(
        `/api/v1/provider/access-users/${account.id}/password-setup`,
        { method: "POST" },
      );
      setMessage(
        `Enviamos a ${account.email} un enlace para crear o recuperar su contraseña.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible enviar el correo de contraseña.",
      );
    } finally {
      setSendingId(null);
    }
  }

  async function updateAccountStatus(account: ProviderAccessAccountDto) {
    const nextActive = !account.active;
    setStatusId(account.id);
    setMessage("");
    setError("");
    try {
      const result = await browserApiRequest<{ id: string; active: boolean }>(
        `/api/v1/provider/access-users/${account.id}/status`,
        { method: "PATCH", body: JSON.stringify({ active: nextActive }) },
      );
      setAccounts((current) =>
        current.map((item) =>
          item.id === result.id ? { ...item, active: result.active } : item,
        ),
      );
      setMessage(
        nextActive
          ? `El acceso de ${account.fullName} fue reactivado.`
          : `El acceso de ${account.fullName} fue desactivado.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cambiar el acceso.");
    } finally {
      setStatusId(null);
    }
  }

  return (
    <section className="provider-panel-enter mt-7">
      <div className="grid items-start gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <div className="provider-card-motion card p-6">
          <p className="eyebrow">Gestión de accesos</p>
          <h2 className="mt-1 text-2xl font-black">Crear un usuario</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Autoriza a una administradora Securitas o a un encargado de despacho.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-[var(--herb-soft)] p-3 text-sm text-[var(--herb-strong)]">
            <ShieldCheck size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <strong className="block">Contraseña personal y privada</strong>
              La persona recibirá una invitación para crear su propia contraseña.
            </p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-extrabold" htmlFor="access-role">
                Tipo de acceso
              </label>
              <FormSelect
                id="access-role"
                value={role}
                onValueChange={(value) => {
                  if (value === "delivery" || value === "company_admin") setRole(value);
                }}
                ariaLabel="Tipo de acceso"
                options={[
                  { value: "delivery", label: "Despacho / delivery" },
                  { value: "company_admin", label: "Administradora Securitas" },
                ]}
                className="mt-2 font-semibold"
              />
              <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                {role === "delivery" ? (
                  <><Truck size={15} className="mt-0.5 shrink-0" /> Puede registrar llegada y entrega de colaciones.</>
                ) : (
                  <><Building2 size={15} className="mt-0.5 shrink-0" /> Puede gestionar trabajadores, capacitaciones, extras y confirmar la recepción.</>
                )}
              </p>
            </div>

            <label className="block text-sm font-extrabold">
              Nombre completo
              <input
                name="fullName"
                required
                minLength={3}
                maxLength={120}
                autoComplete="name"
                className="form-control mt-2 px-4"
                placeholder={role === "delivery" ? "Ej.: Encargado turno fin de semana" : "Ej.: Administradora turno fin de semana"}
              />
            </label>

            <label className="block text-sm font-extrabold">
              Correo de acceso
              <span className="form-control mt-2 flex items-center gap-3 px-3 focus-within:border-[var(--brand)]">
                <Mail size={18} className="text-[var(--brand)]" aria-hidden="true" />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="min-h-12 w-full bg-transparent outline-none"
                  placeholder={role === "delivery" ? "despacho@empresa.cl" : "administracion@securitas.cl"}
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="provider-action focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-extrabold text-white disabled:cursor-wait disabled:opacity-60"
            >
              <UserPlus size={18} aria-hidden="true" />
              {saving ? "Enviando invitación…" : "Crear y enviar invitación"}
            </button>

            <div aria-live="polite">
              <SuccessDialog message={message || null} onClose={() => setMessage("")} />
              {error ? (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">
                  {error}
                </p>
              ) : null}
            </div>
          </form>
        </div>

        <div className="provider-card-motion card overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Equipo autorizado</p>
                <h2 className="mt-1 text-xl font-black">Usuarios autorizados</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold text-[var(--brand-strong)]">
                <ShieldCheck size={16} aria-hidden="true" />
                {activeAccounts} activos · {accounts.length - activeAccounts} pendientes
              </span>
            </div>
            <label className="form-control mt-4 flex min-h-11 items-center gap-3 px-3 focus-within:border-[var(--brand)]">
              <Search size={18} className="text-[var(--muted)]" aria-hidden="true" />
              <span className="sr-only">Buscar usuario autorizado</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-11 w-full bg-transparent outline-none"
                placeholder="Buscar por nombre o correo"
              />
            </label>
          </div>

          {filteredAccounts.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {filteredAccounts.map((account) => (
                <li key={account.id} className="flex flex-col items-start justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">{account.fullName}</p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {account.email ?? "Correo no disponible"}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand)]">
                      {account.role === "delivery" ? <Truck size={13} /> : <Building2 size={13} />}
                      {account.role === "delivery" ? "Despacho" : "Administradora Securitas"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                        !account.active
                          ? "bg-red-50 text-[var(--danger)]"
                          : account.accessActivated
                          ? "bg-[var(--herb-soft)] text-[var(--herb-strong)]"
                          : "bg-[var(--accent-soft)] text-[var(--warning)]"
                      }`}
                    >
                      {!account.active ? (
                        <span className="inline-flex items-center gap-1.5">
                          <UserX size={14} aria-hidden="true" /> Desactivado
                        </span>
                      ) : account.accessActivated ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 size={14} aria-hidden="true" /> Activo
                        </span>
                      ) : (
                        "Invitación pendiente"
                      )}
                    </span>
                    {account.active && account.email ? (
                      <button
                        type="button"
                        onClick={() => void sendPasswordSetup(account)}
                        disabled={sendingId === account.id}
                        className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-extrabold text-[var(--brand)] disabled:cursor-wait disabled:opacity-60"
                      >
                        <Send size={14} aria-hidden="true" />
                        {sendingId === account.id ? "Enviando…" : "Reenviar clave"}
                      </button>
                    ) : null}
                    <ConfirmDialog
                      title={account.active ? "Desactivar este acceso?" : "Reactivar este acceso?"}
                      description={
                        account.active
                          ? `${account.fullName} dejara de poder ingresar y operar en el sistema.`
                          : `${account.fullName} recuperara el acceso correspondiente a su rol.`
                      }
                      confirmLabel={account.active ? "Si, desactivar" : "Si, reactivar"}
                      tone={account.active ? "danger" : "brand"}
                      onConfirm={() => updateAccountStatus(account)}
                      trigger={
                        <button
                          type="button"
                          disabled={statusId === account.id}
                          className={`focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold disabled:cursor-wait disabled:opacity-60 ${
                            account.active
                              ? "bg-red-50 text-[var(--danger)]"
                              : "bg-[var(--herb-soft)] text-[var(--herb-strong)]"
                          }`}
                        >
                          {account.active ? <UserX size={14} /> : <UserCheck size={14} />}
                          {statusId === account.id
                            ? "Guardando..."
                            : account.active
                              ? "Desactivar"
                              : "Reactivar"}
                        </button>
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm font-bold text-[var(--muted)]">
              No hay usuarios de despacho o Securitas registrados.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-CL")
    .trim();
}
