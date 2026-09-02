# Configuración de correos con Resend

SN Colaciones usa dos integraciones complementarias:

- **Avisos de la aplicación:** el backend los envía mediante la API de Resend y una plantilla de React Email.
- **Acceso y seguridad:** Supabase Auth genera los enlaces y códigos; Resend los entrega mediante SMTP.

No se debe reemplazar la generación de enlaces de Supabase ni construir enlaces de acceso manualmente.

## 1. Requisitos

1. Tener un dominio propio y verificarlo en Resend. Se recomienda usar un subdominio, por ejemplo `correo.midominio.cl`.
2. Configurar en DNS los registros DKIM, SPF y DMARC indicados por Resend.
3. Crear una API key de Resend exclusiva para SN Colaciones.
4. Definir remitentes claros, por ejemplo:
   - `SN Colaciones <notificaciones@correo.midominio.cl>` para avisos.
   - `SN Colaciones <acceso@correo.midominio.cl>` para autenticación.

La API key y la clave secreta de Supabase son secretos de backend. Nunca deben tener el prefijo `NEXT_PUBLIC_` ni quedar versionadas.

## 2. Avisos enviados por el backend

Configurar estas variables en el entorno donde se ejecuta el backend:

```env
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=SN Colaciones <notificaciones@correo.midominio.cl>
APP_URL=https://colaciones.midominio.cl
```

Para revisar la cola sin enviar correos:

```bash
npm run notifications:email -w backend
```

Para despacharla realmente:

```bash
npm run notifications:email -w backend -- --apply
```

En producción debe existir una tarea programada que ejecute el despacho. El resumen matinal se puede crear y enviar con:

```bash
npm run notifications:morning -w backend -- --apply
```

## 3. Correos de Supabase Auth mediante Resend

En **Supabase Dashboard > Authentication > Email/Notifications > SMTP Settings**, activar SMTP personalizado y completar:

| Campo | Valor |
|---|---|
| Sender name | `SN Colaciones` |
| Sender email | `acceso@correo.midominio.cl` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | API key de Resend |

Luego revisar en **Authentication > URL Configuration**:

- **Site URL:** URL pública real del frontend.
- **Redirect URLs:** incluir la URL pública y las rutas de retorno utilizadas por la aplicación.

También se deben revisar los límites de envío de Supabase Auth para el volumen esperado. Mantener deshabilitado el registro público si las cuentas seguirán siendo creadas por la administradora.

## 4. Plantillas profesionales de autenticación

Las plantillas versionadas están en `supabase/templates`. Copiar el contenido de cada archivo en la plantilla correspondiente del Dashboard:

| Plantilla de Supabase | Archivo | Asunto recomendado |
|---|---|---|
| Magic Link | `magic-link.html` | `Tu acceso seguro a SN Colaciones` |
| Invite user | `invite.html` | `Activa tu cuenta de SN Colaciones` |
| Reset password | `recovery.html` | `Restablece tu contraseña de SN Colaciones` |
| Change email address | `email-change.html` | `Confirma tu nuevo correo` |
| Confirm signup | `confirmation.html` | `Confirma tu correo de SN Colaciones` |
| Reauthentication | `reauthentication.html` | `{{ .Token }} es tu código de seguridad` |
| Password changed | `password-changed.html` | `Tu contraseña fue actualizada` |
| Email address changed | `email-changed.html` | `El correo de tu cuenta fue actualizado` |

Activar las notificaciones de seguridad de cambio de contraseña y cambio de correo si están disponibles en el plan y configuración del proyecto.

## 5. Seguridad y prueba final

- Deshabilitar el seguimiento de clics y aperturas para los correos de autenticación. La reescritura de enlaces puede interferir con enlaces de acceso de un solo uso.
- No incluir contraseñas, tokens completos ni datos sensibles en avisos operativos.
- Probar enlace mágico, invitación, recuperación y avisos con una cuenta real autorizada.
- Confirmar que el remitente, asunto, logo textual, enlace y versión móvil se ven correctamente.
- Revisar en Resend entregas, rebotes y reclamos; no reintentar permanentemente direcciones inválidas.

Hasta completar el dominio verificado y el SMTP personalizado, los correos de Supabase Auth no saldrán mediante la cuenta de Resend de producción.
