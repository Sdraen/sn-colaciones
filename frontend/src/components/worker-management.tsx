"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Mail,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { browserApiRequest } from "@/lib/api/client";
import type { WorkerAccountDto } from "@/lib/api/contracts";

export function WorkerManagement({
  initialWorkers,
}: {
  initialWorkers: WorkerAccountDto[];
}) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [selectedDinerId, setSelectedDinerId] = useState(
    initialWorkers.find((worker) => !worker.accountCreated && worker.active)?.id ?? "new",
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const availableWorkers = workers.filter(
    (worker) => worker.active && !worker.accountCreated,
  );
  const filteredWorkers = useMemo(() => {
    const term = normalize(search);
    if (!term) return workers;
    return workers.filter((worker) =>
      normalize(
        `${worker.fullName} ${worker.employeeCode ?? ""} ${worker.email ?? ""}`,
      ).includes(term),
    );
  }, [search, workers]);
  const accountsCreated = workers.filter((worker) => worker.accountCreated).length;
  const creatingNewWorker = selectedDinerId === "new";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const worker = await browserApiRequest<WorkerAccountDto>(
        "/api/v1/company/workers",
        {
          method: "POST",
          body: JSON.stringify({
            email: String(data.get("email")),
            ...(creatingNewWorker
              ? {
                  fullName: String(data.get("fullName")),
                  employeeCode: String(data.get("employeeCode") || "") || undefined,
                }
              : { dinerId: selectedDinerId }),
          }),
        },
      );

      setWorkers((current) =>
        [...current.filter((item) => item.id !== worker.id), worker].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, "es-CL"),
        ),
      );
      const nextAvailable = availableWorkers.find((item) => item.id !== worker.id);
      setSelectedDinerId(nextAvailable?.id ?? "new");
      form.reset();
      setMessage(
        `${worker.fullName} ya puede solicitar su enlace de acceso usando ${worker.email}.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible crear la cuenta del trabajador.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="company-panel-enter mt-7">
      <div className="grid items-start gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <div className="company-card-motion card p-6">
          <p className="eyebrow">Accesos de trabajadores</p>
          <h2 className="mt-1 text-2xl font-black">Crear una cuenta</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Vincula a una persona de la nómina o registra un trabajador nuevo.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-[var(--herb-soft)] p-3 text-sm text-[var(--herb-strong)]">
            <ShieldCheck size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <strong className="block">Acceso sin contraseña compartida</strong>
              La persona solicitará un enlace de un solo uso desde el inicio de sesión.
            </p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-extrabold" htmlFor="worker-record">
              Trabajador
            </label>
            <select
              id="worker-record"
              value={selectedDinerId}
              onChange={(event) => {
                setSelectedDinerId(event.target.value);
                setMessage("");
                setError("");
              }}
              className="company-input min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
            >
              {availableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.fullName}
                  {worker.employeeCode ? ` · ${worker.employeeCode}` : ""}
                </option>
              ))}
              <option value="new">+ Registrar trabajador nuevo</option>
            </select>

            {creatingNewWorker ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-extrabold sm:col-span-2">
                  Nombre completo
                  <input
                    name="fullName"
                    required
                    minLength={3}
                    maxLength={120}
                    autoComplete="name"
                    className="company-input mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] px-3"
                    placeholder="Ej.: Camila González"
                  />
                </label>
                <label className="block text-sm font-extrabold sm:col-span-2">
                  Código de trabajador <span className="font-normal text-[var(--muted)]">(opcional)</span>
                  <input
                    name="employeeCode"
                    maxLength={80}
                    className="company-input mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] px-3"
                    placeholder="Ej.: SEC-105"
                  />
                </label>
              </div>
            ) : null}

            <label className="block text-sm font-extrabold">
              Correo de acceso
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 focus-within:border-[var(--brand)]">
                <Mail size={18} className="text-[var(--brand)]" aria-hidden="true" />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="min-h-12 w-full bg-transparent outline-none"
                  placeholder="nombre@empresa.cl"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="company-action focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-extrabold text-white disabled:cursor-wait disabled:opacity-60"
            >
              <UserPlus size={18} aria-hidden="true" />
              {saving ? "Creando cuenta…" : "Crear acceso de trabajador"}
            </button>

            <div aria-live="polite">
              {message ? (
                <p role="status" className="rounded-xl bg-[var(--herb-soft)] p-3 text-sm font-bold text-[var(--herb-strong)]">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">
                  {error}
                </p>
              ) : null}
            </div>
          </form>
        </div>

        <div className="company-card-motion card overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Nómina</p>
                <h2 className="mt-1 text-xl font-black">Trabajadores registrados</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold text-[var(--brand-strong)]">
                <UsersRound size={16} aria-hidden="true" />
                {accountsCreated} con acceso · {workers.length - accountsCreated} pendientes
              </span>
            </div>
            <label className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 focus-within:border-[var(--brand)]">
              <Search size={18} className="text-[var(--muted)]" aria-hidden="true" />
              <span className="sr-only">Buscar trabajador</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-11 w-full bg-transparent outline-none"
                placeholder="Buscar por nombre, código o correo"
              />
            </label>
          </div>

          <div className="max-h-[620px] overflow-auto">
            {filteredWorkers.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {filteredWorkers.map((worker) => (
                  <li key={worker.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold">{worker.fullName}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {worker.email ?? worker.employeeCode ?? "Sin correo asignado"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${
                        worker.accountCreated
                          ? "bg-[var(--herb-soft)] text-[var(--herb-strong)]"
                          : "bg-[var(--accent-soft)] text-[var(--warning)]"
                      }`}
                    >
                      {worker.accountCreated ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 size={14} aria-hidden="true" /> Con acceso
                        </span>
                      ) : (
                        "Sin acceso"
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-8 text-center text-sm font-bold text-[var(--muted)]">
                No se encontraron trabajadores.
              </p>
            )}
          </div>
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
