# Autenticación y notificaciones

## Estrategia de acceso

La implementación recomendada es Supabase Auth con cuentas creadas o invitadas por un administrador. El registro público debe permanecer deshabilitado.

1. El trabajador recibe un enlace mágico o código de un solo uso en su correo.
2. Supabase valida la identidad y crea una sesión segura.
3. La aplicación consulta `profiles` para conocer el rol.
4. Row Level Security limita qué registros puede leer o modificar ese rol.
5. Las administradoras completan un segundo factor TOTP antes de acceder a acciones sensibles.

No se deben almacenar contraseñas, códigos de acceso ni secretos de sesión en tablas propias.

## Trabajadores sin correo corporativo

Orden de preferencia:

1. Correo personal con enlace mágico u OTP.
2. Teléfono personal con OTP, si la empresa acepta el costo de SMS.
3. Cuenta individual administrada con contraseña temporal y cambio obligatorio, solo si las alternativas anteriores no son posibles.

No se recomienda compartir una sola clave entre trabajadores porque elimina la trazabilidad y permite suplantaciones.

## Notificaciones

La primera versión debe guardar todos los avisos dentro de `notifications`. El correo es un canal adicional, no la única fuente de verdad.

- Nueva solicitud tardía de colación extra: aviso a la proveedora.
- Colación extra aprobada o rechazada: aviso a Securitas, incluyendo el motivo cuando corresponda.
- Menú semanal publicado: aviso opcional a trabajadores.
- Resumen diario o semanal: correo opcional a las administradoras.

Resend puede enviar los correos de la aplicación y también puede configurarse como SMTP de Supabase para correos de autenticación. Antes de activarlo se necesita verificar un dominio y definir las direcciones remitentes.

La guía de activación, los remitentes recomendados y la relación de plantillas se
encuentran en `docs/configuracion-resend.md`.

## Implementación actual

- El frontend usa Supabase Auth mediante cookies SSR y flujo PKCE.
- `/pedidos`, `/admin/*` y `/despacho` redirigen al login cuando no existe una sesión válida.
- El frontend reenvía el access token a Express y `GET /api/v1/auth/me` obtiene
  el perfil y el rol; el navegador no decide permisos por sí solo.
- La navegación muestra únicamente el área autorizada para el rol autenticado.
- El registro público permanece cerrado mediante `shouldCreateUser: false`.
- `/login` permite contraseña para cuentas aprovisionadas y conserva el enlace
  mágico como mecanismo alternativo.
- `npm run provision:user -w backend` permite revisar y crear cuentas de forma
  controlada; nunca ejecuta cambios sin `--apply`. Las contraseñas temporales se
  reciben mediante `PROVISION_USER_PASSWORD` y no se guardan en archivos.
- La administradora de Securitas puede crear exclusivamente cuentas de
  trabajadores desde su panel. El backend vincula el usuario de Supabase Auth,
  su perfil y la persona de la nómina dentro de la misma operación controlada.
- Las cuentas creadas desde el panel no reciben una contraseña conocida por la
  administradora. Cada trabajador solicita su propio enlace mágico en `/login`.
- `npm run verify:worker-provisioning -w backend` comprueba la creación y la
  limpieza de una cuenta temporal. `npm run load:test-workers -w backend`
  simula por defecto 80 sesiones y pedidos, y elimina la información generada.
- Los avisos operativos se renderizan con React Email en formato HTML y texto
  plano, y se envían con Resend usando una clave idempotente por notificación.
- Los enlaces mágicos, invitaciones, recuperaciones y avisos de seguridad siguen
  siendo generados por Supabase Auth. Para entregarlos con Resend se debe activar
  SMTP personalizado y copiar las plantillas versionadas en `supabase/templates`.

Las cuentas de prueba deben usar correos individuales, rotar sus contraseñas o
eliminarse antes de habilitar el sistema en producción.
