import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandVertical } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";
import { CreatePasswordForm } from "./password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crear contraseña" };

export default async function CreatePasswordPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/login?error=El enlace venció o ya fue utilizado");
  }

  return (
    <main className="login-page-enter page-shell relative grid min-h-[calc(100vh-72px)] place-items-center overflow-hidden">
      <span className="login-orb login-orb-left" aria-hidden="true" />
      <span className="login-orb login-orb-right" aria-hidden="true" />
      <section className="login-card-enter card relative z-10 w-full max-w-[420px] overflow-hidden">
        <div className="bg-[linear-gradient(135deg,var(--brand-strong),var(--brand),var(--accent))] px-6 py-6 text-white sm:px-7">
          <div className="rounded-2xl bg-[#fffdf8] px-4 py-3 shadow-sm">
            <BrandVertical className="mx-auto w-36 sm:w-40" priority />
          </div>
          <p className="mt-4 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-white/75">
            Acceso personal
          </p>
          <h1 className="mt-4 text-2xl font-black tracking-[-0.035em]">
            Crea tu contraseña
          </h1>
          <p className="mt-1.5 text-sm leading-5 text-white/85">
            La usarás para ingresar sin solicitar un enlace cada vez.
          </p>
        </div>
        <div className="px-6 py-6 sm:px-7">
          <CreatePasswordForm email={data.user.email ?? "tu correo"} />
          <p className="mt-4 flex items-start gap-2 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--herb)]" />
            La administración nunca podrá ver tu contraseña.
          </p>
        </div>
      </section>
    </main>
  );
}
