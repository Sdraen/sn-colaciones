import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChefHat,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="home-hero relative overflow-hidden rounded-[32px] px-6 py-12 text-white sm:px-10 lg:px-14 lg:py-16">
        <div className="absolute -bottom-28 -right-16 size-72 rounded-full bg-[var(--herb)]/25 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
            <Sparkles size={14} /> Primera versión para validar el flujo
          </div>
          <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Cada colación, confirmada y a tiempo.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-white/85 sm:text-lg">
            Una vista simple para que los trabajadores elijan su menú y dos
            paneles coordinados para Securitas y la proveedora.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Accesos de demostración</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
              Elige una experiencia
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
            En esta etapa puedes cambiar de rol libremente para revisar todo el
            recorrido.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <RoleCard
            href="/pedidos"
            icon={ClipboardCheck}
            title="Trabajador"
            description="Revisa el menú semanal, elige una colación y modifica tu reserva antes del cierre."
            action="Probar pedido"
            tone="tomato"
          />
          <RoleCard
            href="/admin/empresa"
            icon={Building2}
            title="Administradora Securitas"
            description="Gestiona capacitaciones, personal externo, extras y solicitudes excepcionales."
            action="Abrir panel empresa"
            tone="sun"
          />
          <RoleCard
            href="/admin/proveedor"
            icon={ChefHat}
            title="Administradora proveedora"
            description="Publica los menús, controla cantidades y resuelve solicitudes fuera de horario."
            action="Abrir panel proveedor"
            tone="herb"
          />
        </div>
      </section>

      <section className="card mt-8 grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-[var(--herb-soft)] text-[var(--herb)]">
          <GraduationCap size={24} />
        </span>
        <div>
          <h2 className="font-extrabold">Capacitaciones sin cuentas individuales</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            La administradora de Securitas registra el grupo, la cantidad de
            alumnos y sus alternativas. Cada colación se suma al conteo general.
          </p>
        </div>
      </section>

      <div className="mt-7 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
        <ShieldCheck size={15} className="text-[var(--herb)]" />
        Datos ficticios en modo demostración. Supabase será la persistencia real.
      </div>
    </main>
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
      className="focus-ring card group flex min-h-64 flex-col p-6 transition duration-300 hover:-translate-y-1 hover:border-[var(--brand)]/30 hover:shadow-xl"
    >
      <span className={`grid size-12 place-items-center rounded-2xl ${tones[tone]}`}>
        <Icon size={23} />
      </span>
      <h3 className="mt-7 text-xl font-black tracking-[-0.025em]">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <span className="mt-6 flex items-center gap-2 text-sm font-extrabold text-[var(--brand)]">
        {action}
        <ArrowRight size={17} className="transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
