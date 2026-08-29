# Backend SN Colaciones

API Node.js 24, Express 5, TypeScript, Zod y Supabase organizada por capas.

## Responsabilidades

- Validar el JWT de Supabase y cargar el perfil activo.
- Autorizar acciones mediante los roles `worker`, `company_admin` y `provider_admin`.
- Validar todos los parámetros HTTP con Zod.
- Ejecutar consultas con el JWT del usuario para conservar Row Level Security.
- Dejar reglas sensibles y operaciones atómicas dentro de PostgreSQL.
- Entregar errores normalizados y un `requestId` para trazabilidad.

La clave `SUPABASE_SECRET_KEY` no se utiliza para pedidos normales. Está reservada para futuros procesos administrativos controlados y nunca debe llegar al frontend.

## Capas

- `controllers`: traduce HTTP a casos de uso.
- `services`: consultas, agregaciones y reglas de aplicación.
- `routes`: métodos, rutas y middleware autorizado.
- `schemas`: contratos Zod de body, params y query.
- `middleware`: autenticación, roles, validación, request id y errores.
- `models`: contexto autenticado y modelos del dominio.
- `types`: tipos de API, Express y esquema Supabase.
- `lib`: clientes y adaptadores de infraestructura.
- `openapi`: contrato público OpenAPI 3.1.
- `tests`: pruebas unitarias e integración HTTP.

## Variables locales

Copiar `.env.example` como `.env.local`:

```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
RESEND_API_KEY=re_...
EMAIL_FROM=SN Colaciones <notificaciones@tu-dominio.cl>
APP_URL=https://tu-dominio.cl
```

`SUPABASE_SECRET_KEY` es opcional mientras no se ejecuten tareas administrativas.

## Migraciones requeridas

Ejecutar en orden:

1. `0001_initial_schema.sql`
2. `0002_role_policies.sql`
3. `0003_confirmed_business_rules.sql`
4. `0004_backend_rpc_and_guards.sql`
5. `0005_agreed_operational_corrections.sql`

La API de pedidos, disponibilidad, capacitaciones, extras y excepciones necesita
las funciones RPC creadas por `0004`.

## Endpoints iniciales

Todos, excepto `/api/health`, reciben:

```http
Authorization: Bearer <supabase-access-token>
```

| Método | Ruta | Rol |
| --- | --- | --- |
| GET | `/api/health` | Público |
| GET | `/api/v1/auth/me` | Cualquier usuario activo |
| GET | `/api/v1/menus/current` | Cualquier usuario activo |
| GET | `/api/v1/orders/me` | Trabajador |
| PUT | `/api/v1/orders/me` | Trabajador |
| DELETE | `/api/v1/orders/me/:orderId` | Trabajador propietario |
| GET | `/api/v1/notifications` | Cualquier usuario activo |
| PATCH | `/api/v1/notifications/:notificationId/read` | Destinatario |
| GET | `/api/v1/company/operations` | Administradora Securitas |
| POST | `/api/v1/company/training-sessions` | Administradora Securitas |
| POST | `/api/v1/company/extras` | Administradora Securitas |
| POST | `/api/v1/company/exceptions` | Administradora Securitas |
| GET | `/api/v1/company/reports` | Administradora Securitas |
| PUT | `/api/v1/provider/menu-weeks/:startsOn` | Proveedora |
| POST | `/api/v1/provider/menu-weeks/:weekId/publish` | Proveedora |
| GET/POST | `/api/v1/provider/calendar-blocks` | Proveedora |
| DELETE | `/api/v1/provider/calendar-blocks/:blockId` | Proveedora |
| PATCH | `/api/v1/provider/menu-options/:menuOptionId/availability` | Proveedora |
| PATCH | `/api/v1/provider/exceptions/:exceptionId` | Proveedora |
| PATCH | `/api/v1/provider/orders/:orderId/fulfillment` | Proveedora |
| GET | `/api/v1/provider/operations` | Proveedora |
| GET | `/api/v1/provider/reports/weekly` | Proveedora |
| GET | `/api/v1/provider/reports` | Proveedora |

Consultar `openapi/openapi.yaml` para los contratos completos.

Las reglas horarias se evalúan con la zona configurada en la organización y
los instantes almacenados en cada `service_day`. No dependen del reloj del
navegador. Las solicitudes extraordinarias se notifican dentro de la aplicación
y dejan un correo pendiente. Los reportes genéricos aceptan
`period=daily|weekly|monthly` y una fecha ISO opcional en `date`.

## Notificaciones y resumen matinal

Los comandos son simulaciones mientras no se agregue `--apply`:

```bash
npm run notifications:email -w backend
npm run notifications:morning -w backend
```

El primero despacha correos pendientes. El segundo crea el resumen diario para
ambas administradoras y luego despacha la cola. En producción debe programarse
entre las 07:00 y las 08:00 en la zona `America/Santiago`:

```bash
npm run notifications:morning -w backend -- --apply
```

Resend usa una clave idempotente por notificación, por lo que un reintento no
duplica el correo. El remitente debe pertenecer a un dominio verificado.

## Respuestas de error

```json
{
  "error": {
    "code": "ORDER_WINDOW_CLOSED",
    "message": "La ventana para reservar esta colación está cerrada",
    "requestId": "0fb2a027-75d7-4472-a8b2-23ab28c53cc8"
  }
}
```

El `requestId` también se devuelve en la cabecera `x-request-id`.

## Comandos

```bash
npm run dev -w backend
npm run typecheck -w backend
npm run lint -w backend
npm run test -w backend
npm run build -w backend
npm run verify:supabase -w backend
npm run notifications:morning -w backend
```

## Importación y creación de cuentas

La nómina se puede revisar e importar desde el Excel sin guardar el archivo ni
los nombres dentro del repositorio. El comando es una vista previa mientras no
se agregue `--apply`:

```powershell
npm run import:workers -w backend -- --file "C:\ruta\archivo.xlsx" --sheet "NOMBRE HOJA"
```

Las cuentas también se preparan en modo vista previa. Para una administradora:

```powershell
npm run provision:user -w backend -- --email correo@empresa.cl --name "Nombre Apellido" --role company_admin
```

Para un trabajador se exige vincular una persona ya existente en la nómina:

```powershell
npm run provision:user -w backend -- --email correo@dominio.cl --name "Nombre Apellido" --role worker --worker-name "Nombre Apellido"
```

Roles válidos: `worker`, `company_admin` y `provider_admin`. Revisar la vista
previa y recién entonces repetir el comando con `--apply`. El aprovisionamiento
no envía correos: la persona solicita su enlace de acceso desde `/login`.
