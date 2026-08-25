# SN Colaciones

Monorepo para gestionar menús semanales, pedidos de trabajadores,
capacitaciones, colaciones extra y solicitudes excepcionales entre Securitas y
la proveedora.

## Estructura

```text
sn-colaciones/
├── backend/            API Express + TypeScript
├── frontend/           Aplicación Next.js
├── docs/               Decisiones y documentación funcional
├── supabase/           Migraciones PostgreSQL y políticas RLS
├── package.json        Comandos y workspaces del monorepo
└── package-lock.json   Dependencias compartidas
```

### Backend

La API está separada en `controllers`, `services`, `routes`, `schemas`,
`middleware`, `models`, `lib`, `config` y `types`. Incluye un contrato OpenAPI
y pruebas HTTP iniciales.

### Frontend

Next.js mantiene las rutas:

| Ruta | Experiencia |
| --- | --- |
| `/` | Selector de roles y contexto del MVP |
| `/pedidos` | Pedido semanal del trabajador |
| `/admin/empresa` | Panel de la administradora Securitas |
| `/admin/proveedor` | Panel de la administradora proveedora |

## Requisitos

- Node.js 24 LTS o superior.
- npm 11 o superior.

## Configuración

Crear los archivos locales a partir de:

- `frontend/.env.example` → `frontend/.env.local`
- `backend/.env.example` → `backend/.env.local`

Los archivos `.env.local` están ignorados por Git. Una clave
`SUPABASE_SECRET_KEY` solo puede existir en el backend y nunca debe usar el
prefijo `NEXT_PUBLIC_`.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
```

También se puede iniciar cada aplicación por separado:

```bash
npm run dev:frontend
npm run dev:backend
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## Supabase

El esquema y las políticas de los tres roles están en `supabase/migrations/`.
La aplicación continúa usando datos ficticios hasta implementar Auth y conectar
los servicios del frontend con la API.

## Seguridad de datos

El Excel original contiene nombres reales y no debe copiarse al repositorio.
Durante el desarrollo se usan datos ficticios o anonimizados.

## Documentación

- `docs/decisiones-mvp.md`: decisiones, supuestos y preguntas pendientes.
- `docs/supabase-setup.md`: configuración de Supabase.
- `backend/openapi/openapi.yaml`: contrato inicial de la API.
