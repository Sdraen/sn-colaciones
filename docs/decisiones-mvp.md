# Decisiones provisionales del MVP

Última actualización: 24 de agosto de 2026.

## Confirmado

- Existen tres roles: trabajador, administradora Securitas y administradora proveedora.
- Los trabajadores seleccionan sus propias colaciones.
- Los alumnos de capacitaciones no necesitan cuentas individuales.
- La administradora Securitas registra cada capacitación y sus cantidades.
- Un bloque de capacitación representa una cantidad de alumnos con el mismo menú y agregados. Si el grupo elige alternativas distintas, se registran varios bloques con el mismo nombre.
- La proveedora publica los menús de la semana siguiente los viernes.
- La inscripción anticipada cierra a las 22:00 del día anterior.
- A las 08:00 se publican los cupos disponibles del día.
- Entre las 08:00 y las 11:00 se permiten pedidos únicamente mientras existan cupos.
- A las 11:00 se cierra definitivamente el pedido normal.
- Las solicitudes posteriores al cierre requieren aprobación de la proveedora.
- La administradora Securitas puede registrar colaciones extra para personal externo.
- El resumen debe incluir totales por plato, ensalada, fruta/postre, pan y té.

## Supuestos temporales para la demostración

- Se permite elegir cualquier día visible de la semana.
- Ensalada, fruta/postre o ninguno son alternativas excluyentes.
- Pan y té se pueden seleccionar de manera independiente.
- Las colaciones de capacitación ingresan directamente al conteo.
- Los menús y pedidos viven solo durante la sesión del navegador.
- Los horarios se muestran, pero todavía no bloquean acciones.
- Los datos y nombres mostrados son ficticios.

## Pendiente de confirmar

- Si el trabajador reserva toda la semana o solo el día siguiente.
- Cómo se calcula y quién ingresa la disponibilidad de las 08:00.
- Si los cupos son globales o específicos por plato y agregado.
- Cómo se registran capacitaciones cuyos alumnos eligen menús diferentes.
- Si una capacitación requiere aprobación de la proveedora.
- Qué diferencia operativa exacta existe entre extra y excepcional.
- Cómo inicia sesión un trabajador sin correo corporativo.
- Si el sistema administrará precios y cobros o solo emitirá reportes.
- Canal de notificación inicial: aplicación, correo, notificación web o WhatsApp.
- Reglas para fines de semana, feriados, cancelaciones y días sin servicio.

## Criterio de diseño de datos

Se separan las personas que **utilizan el sistema** de las personas que **reciben una colación**:

- `profiles`: cuentas autenticadas y roles.
- `diners`: trabajadores, alumnos o externos que reciben una colación.
- `training_sessions`: capacitaciones temporales.
- `orders`: pedidos individuales o agregados, siempre relacionados con un día y un menú.

Esta separación evita crear cuentas para alumnos temporales y permite que la administradora Securitas registre sus pedidos.
