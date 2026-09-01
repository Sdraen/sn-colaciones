import Link from "next/link";
import { ArrowRight, Building2, ChefHat, ClipboardCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { getCurrentApiUser } from "@/lib/api/server";
import type { AppRole } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const currentUser = await getCurrentApiUser();

  return (
    <main className="page-shell">
      <section className="home-hero relative overflow-hidden rounded-[32px] px-6 py-10 text-white sm:px-10 lg:px-12">
        <div className="absolute -right-16 -bottom-28 size-72 rounded-full bg-[var(--herb)]/25 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
            <Sparkles size={14} aria-hidden="true" />
            Sistema operativo
          </div>
          <h1 className="text-balance text-4xl leading-[1.05] font-black tracking-[-0.045em] sm:text-5xl">
            Gestión de colaciones
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-white/85 sm:text-lg">
            Pedidos, producción y reportes en un solo lugar.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5">
          <div>
            <p className="eyebrow">Acceso personalizado</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
              {currentUser
                ? `Hola, ${currentUser.fullName}`
                : "Ingresa con tu correo autorizado"}
            </h2>
          </div>
        </div>

        {currentUser ? (
          <CurrentRoleCard role={currentUser.role} />
        ) : (
          <LoginCard />
        )}
      </section>

      <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
        <ShieldCheck size={15} className="text-[var(--herb)]" aria-hidden="true" />
        El acceso y los roles se validan con Supabase y con la API del sistema.
      </div>
    </main>
  );
}

function LoginCard() {
  return (
    <div className="max-w-xl">
      <RoleCard
        href="/login"
        icon={ShieldCheck}
        title="Acceso seguro"
        description="Sólo pueden ingresar las personas registradas previamente por la administración."
        action="Ingresar al sistema"
        tone="tomato"
      />
    </div>
  );
}

function CurrentRoleCard({ role }: { role: AppRole }) {
  if (role === "worker") {
    return (
      <RoleCard
        href="/pedidos"
        icon={ClipboardCheck}
        title="Mis colaciones"
        description="Revisa el menú semanal, elige una colación y modifica tu reserva antes del cierre."
        action="Ir a mis pedidos"
        tone="tomato"
      />
    );
  }
  if (role === "company_admin") {
    return (
      <RoleCard
        href="/admin/empresa"
        icon={Building2}
        title="Administración Securitas"
        description="Gestiona capacitaciones y colaciones extra dentro de sus horarios."
        action="Abrir panel empresa"
        tone="sun"
      />
    );
  }
  if (role === "delivery") {
    return (
      <RoleCard
        href="/despacho"
        icon={Truck}
        title="Despacho diario"
        description="Revisa cantidades, componentes y la nómina completa de cada entrega."
        action="Abrir panel de despacho"
        tone="sun"
      />
    );
  }
  return (
    <RoleCard
      href="/admin/proveedor"
      icon={ChefHat}
      title="Administración proveedora"
      description="Publica los menús, controla cantidades y resuelve solicitudes fuera de horario."
      action="Abrir panel proveedor"
      tone="herb"
    />
  );
}

interface RoleCardProps {
  href: string;
  icon: typeof ClipboardCheck;
  title: string;
  description: string;
  action: string;
  tone: "tomato" | "sun" | "herb";
}

function RoleCard({ href, icon: Icon, title, description, action, tone }: RoleCardProps) {
  const tones = {
    tomato: "bg-[var(--brand-soft)] text-[var(--brand)]",
    sun: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    herb: "bg-[var(--herb)] text-white",
  };

  return (
    <Link
      href={href}
      className="focus-ring card group flex min-h-48 max-w-xl flex-col p-6 transition duration-300 hover:-translate-y-1 hover:border-[var(--brand)]/30 hover:shadow-xl"
    >
      <span className={`grid size-12 place-items-center rounded-2xl ${tones[tone]}`}>
        <Icon size={23} aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-xl font-black tracking-[-0.025em]">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <span className="mt-4 flex items-center gap-2 text-sm font-extrabold text-[var(--brand)]">
        {action}
        <ArrowRight size={17} className="transition group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </Link>
  );
}
