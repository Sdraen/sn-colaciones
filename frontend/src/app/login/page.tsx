import type { Metadata } from "next";
import { ChefHat, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentApiUser } from "@/lib/api/server";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, currentUser] = await Promise.all([searchParams, getCurrentApiUser()]);
  if (currentUser) redirect(homeByRole(currentUser.role));
  const nextPath = safeNextPath(params.next);

  return (
    <main className="login-page-enter page-shell relative grid min-h-[calc(100vh-72px)] place-items-center overflow-hidden">
      <span className="login-orb login-orb-left" aria-hidden="true" />
      <span className="login-orb login-orb-right" aria-hidden="true" />

      <section className="login-card-enter card relative z-10 w-full max-w-[420px] overflow-hidden">
        <div className="bg-[linear-gradient(135deg,var(--brand-strong),var(--brand),var(--accent))] px-6 py-6 text-white sm:px-7">
          <div className="login-brand-enter flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/18 shadow-sm">
              <ChefHat size={23} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-white/75">
                Acceso privado
              </p>
              <p className="text-sm font-extrabold">SN Colaciones</p>
            </div>
          </div>
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

function safeNextPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function homeByRole(role: "worker" | "company_admin" | "provider_admin" | "delivery") {
  if (role === "worker") return "/pedidos";
  if (role === "company_admin") return "/admin/empresa";
  if (role === "delivery") return "/despacho";
  return "/admin/proveedor";
}
