# Decisiones del MVP

Última actualización: 29 de agosto de 2026, según las correcciones acordadas con la proveedora.

## Reglas confirmadas

- Existen tres roles: trabajador, administradora Securitas y administradora proveedora.
- El trabajador puede reservar cualquier día publicado de la semana, modificarlo o eliminarlo hasta las 22:00 del día anterior. No puede ingresar pedidos el mismo día.
- Cada colación elige ensalada, postre o ninguno, y exactamente una opción entre pan y té.
- Entre las 08:00 y las 11:00 del mismo día solamente la administradora Securitas puede agregar colaciones, sujetas a la disponibilidad informada por la proveedora.
- Entre las 11:00 y las 12:00 Securitas puede crear una solicitud extraordinaria. La proveedora debe aprobarla o rechazarla e indicar un motivo claro al rechazar.
- La disponibilidad se registra por alternativa de menú y bloquea altas del mismo día cuando se alcanza. Su método de cálculo sigue pendiente de la clienta.
- La proveedora puede preparar durante la semana actual el menú de la semana siguiente.
- La proveedora define un único menú diario para capacitaciones.
- Marcia Sepúlveda, como administradora Securitas, registra el nombre y la cantidad total de asistentes entre las 00:00 y las 09:00 del mismo día. Los alumnos no necesitan cuentas y todo el grupo recibe el menú definido por la proveedora.
- No se permiten capacitaciones en fines de semana, feriados, vacaciones o días sin servicio.
- Ambas administradoras reciben entre las 07:00 y las 08:00 un resumen de las colaciones registradas.
- Las notificaciones se entregan dentro del sistema y por correo. Resend es el proveedor inicial.
- Ambas administradoras disponen de reportes diarios, semanales y mensuales. El mensual comprende desde el día 1 hasta la fecha seleccionada.
- Los reportes incluyen cantidades solicitadas, confirmadas, canceladas, entregadas, tipo de pedido, menú, acompañamiento, pan y té.
- El sistema no administra precios, pagos ni cobranzas.

## Acceso recomendado

- Usar Supabase Auth y no almacenar contraseñas propias.
- Aprovisionar previamente las cuentas autorizadas para impedir el registro público.
- Usar enlaces mágicos u OTP con `shouldCreateUser: false`.
- Exigir MFA TOTP a las administradoras antes de producción.
- Mantener la autorización por rol mediante perfiles y Row Level Security.

## Pendiente de confirmar

- Cómo calcula la proveedora la disponibilidad diaria.
- Correos definitivos de administradoras y trabajadores.
- Fuente oficial de feriados, vacaciones y días excepcionales.
- Dominio y remitente que se verificarán en Resend.
- Continuación de la frase incompleta del documento: “A la administradora Securitas y…”. Hasta aclararla, los reportes quedan disponibles para ambas administradoras sin agregar otra regla.

## Modelo de datos

- `profiles`: cuentas autenticadas y roles.
- `diners`: trabajadores, alumnos o externos que reciben una colación.
- `training_sessions`: grupos temporales de capacitación.
- `orders`: pedidos individuales o agregados, relacionados con un día y un menú.
- `service_calendar_blocks`: feriados, vacaciones y cierres.
- `notifications`: avisos web y correos pendientes, enviados o fallidos.

Esta separación evita crear cuentas para alumnos y visitas y conserva las decisiones sensibles en manos de las administradoras.
