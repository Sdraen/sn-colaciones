# Decisiones del MVP

Última actualización: 31 de agosto de 2026.

## Reglas confirmadas

- Existen cuatro roles: trabajador, administradora Securitas, administradora proveedora y despacho.
- El trabajador puede reservar cualquier día publicado de la semana, modificarlo o eliminarlo hasta las 22:00 del día anterior. No puede ingresar pedidos el mismo día.
- Cada colación elige ensalada, postre o ninguno, y exactamente una opción entre pan y té.
- Entre las 08:00 y las 11:00 del mismo día solamente la administradora Securitas puede agregar colaciones, sujetas a la disponibilidad informada por la proveedora.
- Entre las 11:00 y las 13:00 Securitas puede solicitar una colación extra tardía. La proveedora debe aprobarla o rechazarla e indicar un motivo claro al rechazar.
- A las 13:00 se cierran por completo las nuevas colaciones del día.
- La disponibilidad se registra por alternativa de menú y bloquea altas del mismo día cuando se alcanza. Su método de cálculo sigue pendiente de la clienta.
- La proveedora puede preparar durante la semana actual el menú de la semana siguiente.
- La proveedora puede definir un menú semanal opcional para capacitaciones, en un apartado separado del menú de trabajadores.
- Marcia Sepúlveda, como administradora Securitas, puede registrar capacitaciones para cualquier fecha hábil actual o futura de la semana. El ingreso está habilitado hasta las 09:00 y vuelve a abrir desde las 14:00; entre ambos horarios permanece cerrado. Los alumnos no necesitan cuentas y todo el grupo recibe el menú definido por la proveedora.
- No se permiten capacitaciones en fines de semana, feriados, vacaciones o días sin servicio.
- La proveedora, Securitas y despacho pueden consultar siempre el resumen diario. Antes de las 13:00 es un conteo en vivo y luego queda como resumen final histórico.
- El resumen incluye preparaciones, componentes, pan, té, acompañamientos, capacitaciones, extras y la nómina por nombre. La proveedora etiqueta las colaciones; despacho sólo verifica carga y entrega.
- Las notificaciones se entregan dentro del sistema y por correo. Resend es el proveedor inicial.
- Ambas administradoras disponen de reportes diarios, semanales y mensuales. El mensual comprende desde el día 1 hasta la fecha seleccionada.
- Toda fecha visible usa el formato chileno `dd/mm/aaaa`; las horas se calculan
  y presentan con la zona `America/Santiago`. La API y PostgreSQL conservan ISO
  `aaaa-mm-dd` para intercambio y cálculos.
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
