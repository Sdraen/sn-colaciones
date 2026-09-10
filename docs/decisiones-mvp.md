# Decisiones del MVP

Última actualización: 10 de septiembre de 2026.

## Reglas confirmadas

- Existen cuatro roles: trabajador, administradora Securitas, administradora proveedora y despacho.
- El trabajador puede reservar cualquier día publicado de la semana, modificarlo o eliminarlo hasta las 22:00 del día anterior. No puede ingresar pedidos el mismo día.
- La vista del trabajador abre siempre en la semana actual. Puede cambiar a una
  semana futura únicamente cuando la proveedora ya publicó su menú; los
  borradores y las semanas pasadas no aparecen en el selector.
- La proveedora ingresa únicamente cada plato y su disponibilidad estimada. Las
  alternativas disponibles son Principal 1, Principal 2, Vegetariano,
  Hipocalórico, Sándwich y su opción vegetariana, Burger y su opción
  vegetariana, Empanadas, Handroll y su opción vegetariana.
- Cada trabajador elige exactamente un acompañamiento entre ensalada y fruta.
  Los miércoles también puede elegir postre; elegir fruta o postre reemplaza la
  ensalada. Además elige exactamente una opción entre pan y té.
- El trabajador ve los cupos restantes de cada plato. Una alternativa agotada
  queda deshabilitada y la base de datos impide sobrecupos incluso cuando dos
  personas intentan reservar al mismo tiempo.
- Entre las 08:00 y las 11:00 del mismo día solamente la administradora Securitas puede agregar colaciones, sujetas a la disponibilidad informada por la proveedora.
- Entre las 11:00 y las 13:00 Securitas puede solicitar una colación extra tardía. La proveedora debe aprobarla o rechazarla e indicar un motivo claro al rechazar.
- A las 13:00 se cierran por completo las nuevas colaciones del día.
- La proveedora ingresa junto con cada alternativa del menú una disponibilidad
  estimada, basada en el promedio de colaciones solicitadas por la empresa. La
  disponibilidad bloquea altas cuando se alcanza y puede ajustarse posteriormente.
- La proveedora puede crear y publicar el menú de la semana actual aunque se
  haya atrasado. También puede preparar semanas futuras. Esta excepción no
  reabre los plazos vencidos de pedidos de trabajadores.
- El servicio regular y sus menús pueden estar disponibles de lunes a domingo.
  Sábado y domingo se configuran igual que los demás días y solo se marcan
  como `Sin servicio` cuando corresponda.
- La proveedora puede definir un menú semanal opcional para capacitaciones, en un apartado separado del menú de trabajadores.
- Marcia Sepúlveda, como administradora Securitas, puede registrar capacitaciones para cualquier fecha hábil actual o futura de la semana. El ingreso está habilitado hasta las 09:00 y vuelve a abrir desde las 14:00; entre ambos horarios permanece cerrado. Los alumnos no necesitan cuentas y todo el grupo recibe el menú definido por la proveedora.
- La forma de operar durante feriados y vacaciones sigue pendiente de
  confirmación. Es posible que exista servicio con una cantidad menor informada
  por Securitas, por lo que esos días no deben bloquearse automáticamente hasta
  cerrar la regla.
- La administradora Securitas informará los feriados, vacaciones y días
  especiales. Todavía falta definir si cada aviso bloquea el servicio o solo
  modifica su disponibilidad.
- La proveedora, Securitas y despacho pueden consultar siempre el resumen diario. Antes de las 13:00 es un conteo en vivo y luego queda como resumen final histórico.
- El resumen incluye preparaciones, componentes, pan, té, acompañamientos, capacitaciones, extras y la nómina por nombre. La proveedora etiqueta las colaciones.
- Despacho registra con hora su llegada a Securitas y, posteriormente, el
  término de la entrega. La administradora Securitas confirma la recepción
  completa; esa confirmación contabiliza los pedidos como entregados.
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

- Correos definitivos de administradoras y trabajadores.
- Si existe servicio durante feriados y vacaciones, y cómo informa Securitas la
  disponibilidad reducida para esas fechas.
- Dominio y remitente que se verificarán en Resend.
- Continuación de la frase incompleta del documento: “A la administradora Securitas y…”. Hasta aclararla, los reportes quedan disponibles para ambas administradoras sin agregar otra regla.

## Modelo de datos

- `profiles`: cuentas autenticadas y roles.
- `diners`: trabajadores, alumnos o externos que reciben una colación.
- `training_sessions`: grupos temporales de capacitación.
- `orders`: pedidos individuales o agregados, relacionados con un día y un menú.
- `service_calendar_blocks`: feriados, vacaciones y cierres.
- `notifications`: avisos web y correos pendientes, enviados o fallidos.
- `service_delivery_tracking`: llegada, término de entrega y confirmación de
  recepción por servicio diario.

Esta separación evita crear cuentas para alumnos y visitas y conserva las decisiones sensibles en manos de las administradoras.
