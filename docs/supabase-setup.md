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
los rechazos de solicitudes tardías que existían en esa versión del modelo.

Después de configurar la API Express, ejecutar
`supabase/migrations/0004_backend_rpc_and_guards.sql`. Agrega operaciones
atómicas para menús, reservas, capacitaciones, extras, excepciones,
disponibilidad y entregas; valida las ventanas horarias en PostgreSQL y registra
eventos de auditoría.

Luego ejecutar `supabase/migrations/0005_agreed_operational_corrections.sql`.
Esta migración aplica las correcciones acordadas: pan o té excluyentes,
ventana tardía vigente hasta las 12:00 en la versión anterior, capacitaciones hasta las 09:00 con un
menú definido por la proveedora, disponibilidad efectiva, menú de la semana
siguiente y cola doble de notificaciones web/correo.

Finalmente ejecutar `supabase/migrations/0006_delivery_extras_and_training_menu.sql`.
Esta migración fija el cierre definitivo a las 13:00, unifica las operaciones
bajo el nombre colación extra, separa el menú opcional de capacitaciones,
incorpora fruta/postre, bebida y observaciones, y agrega el rol de despacho con
acceso de sólo lectura al resumen diario.

Luego ejecutar `supabase/migrations/0007_training_registration_windows.sql`.
Esta corrección permite registrar capacitaciones para fechas hábiles actuales o
futuras hasta las 09:00 y nuevamente desde las 14:00, manteniendo los bloqueos
por feriados, vacaciones y días sin servicio.

Luego ejecutar `supabase/migrations/0008_delivery_tracking_and_receipt.sql`.
Esta migración registra la llegada y el término de la entrega por despacho, y
permite que Securitas confirme la recepción completa con hora y responsable.
La confirmación final actualiza los reportes de colaciones entregadas.

## 3. Estado y pendientes antes de producción

- Las migraciones `0001` a `0008` ya fueron ejecutadas en el proyecto remoto.
- La conexión administrativa, las tablas y los roles requeridos por `0008`
  fueron verificados correctamente el 03/09/2026.
- Antes de la puesta en producción se debe realizar la prueba funcional completa
  de llegada, término de entrega y confirmación de recepción con cada rol.
- Se creó la organización `Securitas Concepción` y se importaron 78 trabajadores
  desde la hoja revisada, sin cuentas ni correos asociados.
- El acceso OTP del frontend está implementado con creación pública deshabilitada.
- Crear los perfiles iniciales cuando se confirmen los correos de las administradoras.
- Deshabilitar además el registro público desde la configuración de Supabase Auth.
- Exigir MFA TOTP para las administradoras.
- Configurar Resend como SMTP de producción para los correos generados por Supabase Auth.
- Verificar un dominio en Resend y configurar `RESEND_API_KEY`, `EMAIL_FROM` y `APP_URL` sólo en el backend. Seguir `docs/configuracion-resend.md` y copiar las plantillas de `supabase/templates` en el Dashboard.
- Programar `npm run notifications:morning -w backend -- --apply` entre las 07:00 y las 08:00 de Santiago. Sin `--apply`, el comando sólo simula.
- Probar las políticas RLS con usuarios de cada rol.
- Generar los tipos TypeScript desde el esquema remoto.
- Revisar con la clienta posibles errores ortográficos en los nombres importados.
