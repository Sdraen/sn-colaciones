import { ChefHat, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentApiUser } from "@/lib/api/server";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, currentUser] = await Promise.all([searchParams, getCurrentApiUser()]);
  if (currentUser) redirect(homeByRole(currentUser.role));
  const nextPath = safeNextPath(params.next);

  return (
    <main className="page-shell grid min-h-[calc(100vh-72px)] place-items-center">
      <section className="card w-full max-w-lg overflow-hidden">
        <div className="bg-[linear-gradient(135deg,var(--brand-strong),var(--brand),var(--accent))] px-7 py-8 text-white sm:px-9">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/18">
            <ChefHat size={25} aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">Ingresar a SN Colaciones</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/85">
            Usa tu contraseña o solicita un enlace de acceso de un solo uso.
          </p>
        </div>
        <div className="px-7 py-8 sm:px-9">
          {params.error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-[var(--danger)]">
              {params.error}
            </p>
          ) : null}
          <LoginForm nextPath={nextPath} />
          <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--herb)]" />
            El acceso está cerrado al público. Sólo funcionan correos creados previamente por la administración.
          </p>
        </div>
      </section>
    </main>
  );
}

function safeNextPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function homeByRole(role: "worker" | "company_admin" | "provider_admin") {
  if (role === "worker") return "/pedidos";
  if (role === "company_admin") return "/admin/empresa";
  return "/admin/proveedor";
}
