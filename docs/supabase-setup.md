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

Finalmente, ejecutar `supabase/migrations/0003_confirmed_business_rules.sql`.
Esta migración agrega disponibilidad, calendario de feriados y vacaciones,
notificaciones internas, trazabilidad de entregas y la obligación de justificar
los rechazos de solicitudes extraordinarias.

Después de configurar la API Express, ejecutar
`supabase/migrations/0004_backend_rpc_and_guards.sql`. Agrega operaciones
atómicas para menús, reservas, capacitaciones, extras, excepciones,
disponibilidad y entregas; valida las ventanas horarias en PostgreSQL y registra
eventos de auditoría.

Luego ejecutar `supabase/migrations/0005_agreed_operational_corrections.sql`.
Esta migración aplica las correcciones acordadas: pan o té excluyentes,
ventana extraordinaria hasta las 12:00, capacitaciones hasta las 09:00 con un
menú definido por la proveedora, disponibilidad efectiva, menú de la semana
siguiente y cola doble de notificaciones web/correo.

## 3. Estado y pendientes antes de producción

- Las migraciones `0001` a `0004` ya fueron ejecutadas y verificadas en el proyecto remoto.
- La migración `0005` debe ejecutarse y verificarse antes de probar estas correcciones con datos reales.
- Se creó la organización `Securitas Concepción` y se importaron 78 trabajadores
  desde la hoja revisada, sin cuentas ni correos asociados.
- El acceso OTP del frontend está implementado con creación pública deshabilitada.
- Crear los perfiles iniciales cuando se confirmen los correos de las administradoras.
- Deshabilitar además el registro público desde la configuración de Supabase Auth.
- Exigir MFA TOTP para las administradoras.
- Configurar SMTP de producción; Resend es la alternativa inicial.
- Verificar un dominio en Resend y configurar `RESEND_API_KEY`, `EMAIL_FROM` y `APP_URL` sólo en el backend.
- Programar `npm run notifications:morning -w backend -- --apply` entre las 07:00 y las 08:00 de Santiago. Sin `--apply`, el comando sólo simula.
- Probar las políticas RLS con usuarios de cada rol.
- Generar los tipos TypeScript desde el esquema remoto.
- Revisar con la clienta posibles errores ortográficos en los nombres importados.
