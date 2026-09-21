# Seguridad operacional

## Antes de publicar

1. Configurar `TRUST_PROXY_HOPS` con la cantidad exacta de proxies que existen
   delante del backend. Mantener `0` durante desarrollo local.
2. En Supabase Auth, exigir al menos 12 caracteres, mayusculas, minusculas,
   numeros y simbolos. Activar la proteccion de contrasenas filtradas si el plan
   la incluye.
3. Configurar los limites de Auth y CAPTCHA para acceso, recuperacion y enlaces
   magicos. La API propia ya aplica limites adicionales por IP y por usuario.
4. Mantener TOTP habilitado en Supabase Auth. El sistema obliga a
   `provider_admin` y `company_admin` a configurar y verificar su factor antes
   de abrir los paneles o utilizar la API administrativa.
5. Aplicar todas las migraciones, incluidas `0021_security_hardening.sql` y
   `0022_admin_totp_mfa.sql`.
6. Confirmar HTTPS en frontend, backend y Supabase. No incluir
   `SUPABASE_SECRET_KEY` en variables publicas ni en el frontend.
7. Verificar que los respaldos diarios de Supabase esten disponibles. Para una
   operacion critica, habilitar PITR y realizar una restauracion de prueba.

## Alta y baja de personas

- Cada persona debe tener una cuenta individual; nunca se comparten claves.
- Al terminar un turno permanente, contrato o responsabilidad, desactivar la
  cuenta desde la seccion Accesos o Trabajadores el mismo dia.
- La desactivacion bloquea la API y RLS inmediatamente. La reactivacion queda
  registrada en `audit_events`.
- Revisar mensualmente la lista de usuarios activos con la proveedora y
  Securitas.

## Recuperacion de MFA

- Antes de eliminar un factor perdido, verificar la identidad de la persona
  por un canal distinto al correo de acceso.
- La eliminacion administrativa se realiza desde un entorno servidor usando
  `auth.admin.mfa.deleteFactor`; nunca desde el navegador ni exponiendo la
  `SUPABASE_SECRET_KEY`.
- Despues de eliminarlo, cerrar sus sesiones y pedir que registre un factor
  nuevo en el siguiente ingreso.
- Supabase permite registrar un segundo factor TOTP de respaldo. No depender de
  codigos de recuperacion experimentales para la operacion normal.

## Respuesta a incidentes

1. Desactivar la cuenta involucrada.
2. Rotar `SUPABASE_SECRET_KEY`, credenciales SMTP/Resend y cualquier secreto que
   pueda haber sido expuesto.
3. Consultar `audit_events`, Supabase Auth Logs y los logs del backend usando el
   `x-request-id`.
4. Preservar los registros antes de corregir datos.
5. Cambiar contrasenas administrativas y verificar nuevamente MFA.

## Controles automatizados

El flujo de GitHub ejecuta tests, lint, build y `npm audit` para dependencias de
produccion. Dependabot revisa actualizaciones cada semana. Un cambio no debe
publicarse si existen vulnerabilidades altas o criticas sin una excepcion
documentada.
