# Decisiones del MVP

Última actualización: 15 de septiembre de 2026.

## Reglas confirmadas

- Existen cuatro roles: trabajador, administradora Securitas, administradora proveedora y despacho.
- Las capacitaciones nuevas incluyen por cada alumno almuerzo, ensalada, fruta, jugo y pan. Securitas sólo decide si añade té al grupo; todos los componentes se multiplican por la cantidad de alumnos y aparecen en los reportes y en el control de recepción.
- La administradora proveedora crea los accesos individuales de despacho y de
  las administradoras Securitas, y puede reenviar la invitación para definir la
  contraseña. Cada persona usa su propia cuenta; no se comparten claves entre
  turnos.
- El trabajador puede reservar cualquier día publicado de la semana, modificarlo o eliminarlo hasta las 22:00 del día anterior. No puede ingresar pedidos el mismo día.
- La vista del trabajador abre siempre en la semana actual. Puede cambiar a una
  semana futura únicamente cuando la proveedora ya publicó su menú; los
  borradores y las semanas pasadas no aparecen en el selector.
- La proveedora ingresa únicamente cada plato y su disponibilidad estimada. Las
  alternativas disponibles son Principal 1, Principal 2, Vegetariano,
  Hipocalórico, Sándwich y su opción vegetariana, Burger y su opción
  vegetariana, Empanadas, Handroll y su opción vegetariana.
- Cada trabajador elige exactamente un acompañamiento entre ensalada y fruta.
  No necesita conocer la preparación específica de esos acompañamientos antes
  de reservar. Además puede elegir pan, té o ambos, cualquier día de la semana.
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
- Cada formulario diario del menú funciona como un acordeón. El botón “Cerrar
  día” sólo contrae visualmente el formulario y no guarda, bloquea ni modifica
  pedidos, cupos o ventanas horarias.
- La proveedora puede definir un menú semanal opcional para capacitaciones, en un apartado separado del menú de trabajadores. Debe informar un cupo que se aplica y consume por separado en cada día hábil.
- Marcia Sepúlveda, como administradora Securitas, puede registrar capacitaciones para cualquier fecha hábil actual o futura de la semana, sin superar la disponibilidad restante de ese día. Hasta las 09:00 puede registrar para hoy o fechas futuras; entre las 09:00 y las 14:00 no puede crear nuevas capacitaciones; desde las 14:00 sólo puede hacerlo para fechas futuras. Los alumnos no necesitan cuentas y todo el grupo recibe el menú definido por la proveedora.
- Al modificar una capacitación se valida la diferencia de cupos y al eliminarla se liberan automáticamente. La base de datos serializa registros simultáneos para impedir sobrecupos.
- La forma de operar durante feriados y vacaciones sigue pendiente de
  confirmación. Es posible que exista servicio con una cantidad menor informada
  por Securitas, por lo que esos días no deben bloquearse automáticamente hasta
  cerrar la regla.
- La administradora Securitas informará los feriados, vacaciones y días
  especiales. Todavía falta definir si cada aviso bloquea el servicio o solo
  modifica su disponibilidad.
- La proveedora, Securitas y despacho pueden consultar siempre el resumen diario. Antes de las 13:00 es un conteo en vivo y luego queda como resumen final histórico.
- El resumen incluye preparaciones, componentes, pan, té, acompañamientos, capacitaciones, extras y la nómina por nombre. La proveedora etiqueta las colaciones.
- Despacho o la administradora Securitas pueden registrar con hora la llegada
  de las colaciones. Despacho registra posteriormente el término de la entrega.
- Securitas compara por preparación y complemento las cantidades esperadas con
  las realmente recibidas, puede informar faltantes y observaciones, y la
  proveedora recibe un aviso interno y por correo. La recepción completa sólo
  puede confirmarse cuando el control fue guardado y no tiene faltantes; esa
  confirmación contabiliza los pedidos como entregados.
- Las notificaciones se entregan dentro del sistema y por correo. Resend es el proveedor inicial.
- Ambas administradoras disponen de reportes diarios, semanales y mensuales. El mensual comprende el mes calendario completo de la fecha seleccionada.
- Toda fecha visible usa el formato chileno `dd/mm/aaaa`; las horas se calculan
  y presentan con la zona `America/Santiago`. La API y PostgreSQL conservan ISO
  `aaaa-mm-dd` para intercambio y cálculos.
- Los reportes incluyen un estimado de reservas anticipadas, el conteo final por
  plato con ensalada, fruta, pan y té, y la nómina completa de beneficiarios.
- La nómina puede buscarse por nombre, categoría o preparación. Ambas
  administradoras pueden descargar el PDF completo; las capacitaciones aparecen
  como grupo y las colaciones extra con el beneficiario informado por Securitas.
- El sistema no administra precios, pagos ni cobranzas.

## Acceso recomendado

- Usar Supabase Auth y no almacenar contraseñas propias.
- Aprovisionar previamente las cuentas autorizadas para impedir el registro público.
- Cada trabajador recibe una invitación, crea su contraseña personal y luego ingresa con correo y contraseña. La administración nunca conoce la clave.
- Mantener enlaces mágicos y recuperación por correo como mecanismos alternativos con `shouldCreateUser: false`.
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
- `service_receipt_checks`: cantidades esperadas y recibidas, faltantes y
  observaciones informadas por Securitas.

Esta separación evita crear cuentas para alumnos y visitas y conserva las decisiones sensibles en manos de las administradoras.
