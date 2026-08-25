# Configuración de Supabase

Proyecto remoto: `sn-colaciones` en la región South America (São Paulo).

## 1. Variables locales

En el panel de Supabase, abrir **Connect > Framework > Next.js** y copiar la
clave publicable. Completar `frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Los archivos `.env.local` están ignorados por Git. El backend usa los nombres
`SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. No usar una clave `sb_secret_...`,
`service_role`, la contraseña de PostgreSQL ni una cadena de conexión en una
variable `NEXT_PUBLIC_`.

## 2. Esquema inicial

1. Abrir **SQL Editor** en Supabase.
2. Crear una consulta nueva.
3. Copiar el contenido de `supabase/migrations/0001_initial_schema.sql`.
4. Ejecutarlo una sola vez.
5. Comprobar en **Table Editor** que aparezcan las tablas creadas.

La migración se ejecuta dentro de una transacción. Todas las tablas tienen Row
Level Security habilitado y comienzan cerradas hasta agregar las políticas de
los tres roles.

Después de comprobar el esquema inicial, ejecutar del mismo modo y una sola vez
`supabase/migrations/0002_role_policies.sql`. Esta segunda migración revoca el
acceso anónimo y separa los permisos de trabajador, administradora Securitas y
administradora proveedora.

## 3. Pendiente antes de usar datos reales

- Configurar Supabase Auth.
- Probar las políticas RLS con usuarios de cada rol.
- Generar los tipos TypeScript desde el esquema remoto.
- Importar únicamente datos revisados o anonimizados del Excel.
