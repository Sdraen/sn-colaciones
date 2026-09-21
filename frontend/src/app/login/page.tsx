import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandVertical } from "@/components/brand-logo";
import { getCurrentApiUser } from "@/lib/api/server";
import { LoginForm } from "./login-form";
import { homeByRole, isAdministrativeRole, mfaPath, safeNextPath } from "@/lib/auth-flow";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, currentUser] = await Promise.all([searchParams, getCurrentApiUser()]);
  const nextPath = safeNextPath(params.next);
  if (currentUser) {
    const destination = nextPath === "/" ? homeByRole(currentUser.role) : nextPath;
    if (isAdministrativeRole(currentUser.role) && currentUser.assuranceLevel !== "aal2") {
      redirect(mfaPath(destination));
    }
    redirect(destination);
  }

  return (
    <main className="login-page-enter page-shell relative grid min-h-[calc(100vh-72px)] place-items-center overflow-hidden">
      <span className="login-orb login-orb-left" aria-hidden="true" />
      <span className="login-orb login-orb-right" aria-hidden="true" />

      <section className="login-card-enter card relative z-10 w-full max-w-[420px] overflow-hidden">
        <div className="bg-[linear-gradient(135deg,var(--brand-strong),var(--brand),var(--accent))] px-6 py-6 text-white sm:px-7">
          <div className="login-brand-enter rounded-2xl bg-[#fffdf8] px-4 py-3 shadow-sm">
            <BrandVertical className="mx-auto w-36 sm:w-40" priority />
          </div>
          <p className="mt-4 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-white/75">
            Acceso privado
          </p>
          <h1 className="mt-4 text-2xl font-black tracking-[-0.035em]">Bienvenido</h1>
          <p className="mt-1.5 text-sm leading-5 text-white/85">
            Ingresa con tus datos autorizados.
          </p>
        </div>
        <div className="login-content-enter px-6 py-6 sm:px-7">
          {params.error ? (
            <p role="alert" className="login-feedback-enter rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-[var(--danger)]">
              {params.error}
            </p>
          ) : null}
          <LoginForm nextPath={nextPath} />
          <p className="mt-4 flex items-start gap-2 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--herb)]" />
            Solo pueden ingresar cuentas creadas previamente por la administración.
          </p>
        </div>
      </section>
    </main>
  );
}
