import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandVertical } from "@/components/brand-logo";
import { getCurrentApiUser } from "@/lib/api/server";
import { homeByRole, isAdministrativeRole, safeNextPath } from "@/lib/auth-flow";
import { MfaFlow } from "./mfa-flow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificacion en dos pasos" };

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, getCurrentApiUser()]);
  const requestedPath = safeNextPath(params.next);

  if (!user) {
    redirect(`/login?${new URLSearchParams({ next: requestedPath })}`);
  }

  const destination = requestedPath === "/" ? homeByRole(user.role) : requestedPath;
  if (!isAdministrativeRole(user.role) || user.assuranceLevel === "aal2") {
    redirect(destination);
  }

  return (
    <main className="login-page-enter page-shell relative grid min-h-[calc(100vh-72px)] place-items-center overflow-hidden">
      <span className="login-orb login-orb-left" aria-hidden="true" />
      <span className="login-orb login-orb-right" aria-hidden="true" />

      <section className="login-card-enter card relative z-10 w-full max-w-[460px] overflow-hidden">
        <div className="bg-[linear-gradient(135deg,var(--herb-strong),var(--herb),var(--accent))] px-6 py-6 text-white sm:px-7">
          <div className="rounded-2xl bg-[#fffdf8] px-4 py-3 shadow-sm">
            <BrandVertical className="mx-auto w-36 sm:w-40" priority />
          </div>
          <p className="mt-4 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-white/75">
            Proteccion administrativa
          </p>
          <h1 className="mt-4 text-2xl font-black tracking-[-0.035em]">
            Verificacion en dos pasos
          </h1>
          <p className="mt-1.5 text-sm leading-5 text-white/85">
            Tu cuenta administra informacion sensible y necesita una segunda verificacion.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-7">
          <MfaFlow
            email={user.email ?? "tu cuenta"}
            fullName={user.fullName}
            nextPath={destination}
          />
          <p className="mt-5 flex items-start gap-2 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--herb)]" aria-hidden="true" />
            El codigo cambia cada 30 segundos y nunca debes compartirlo.
          </p>
        </div>
      </section>
    </main>
  );
}
