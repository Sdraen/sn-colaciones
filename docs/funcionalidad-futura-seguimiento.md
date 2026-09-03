# Funcionalidad futura: seguimiento de preparación y entrega

## Estado de la propuesta

La preparación animada sigue propuesta para una etapa futura. El seguimiento
operativo de llegada, término de entrega y recepción se implementa por separado
en la migración `0008`.

El objetivo es que trabajadores y administradoras puedan conocer el avance de
las colaciones del día sin tener que consultar directamente a la proveedora.

## Flujo recomendado

El seguimiento utilizará estados generales aplicables a la operación completa
del día:

1. `Pedidos cerrados`
2. `En preparación`
3. `Listo para despacho`
4. `En camino`
5. `Entregado`

No utilizar `En horno`, porque no todas las preparaciones requieren horno. Los
estados deben representar etapas operativas válidas para cualquier menú.

## Responsabilidades y permisos

- **Administradora proveedora:** puede avanzar desde `Pedidos cerrados` hasta
  `Listo para despacho`.
- **Usuario delivery:** en la funcionalidad actual registra su llegada a
  Securitas y el término de la entrega. En una fase futura podrá reflejar además
  `En camino` dentro del flujo animado completo.
- **Administradora Securitas:** consulta el estado y confirma la recepción
  completa después de que despacho termina la entrega.
- **Trabajador:** puede consultar el estado de su propia colación, sin acceder a
  datos personales ni pedidos de otros trabajadores.

El backend debe validar estos permisos. No se debe confiar únicamente en botones
ocultos en el frontend.

## Alcance de los estados

La actualización será por servicio diario y no pedido por pedido. Al avanzar el
estado del día, los pedidos activos asociados mostrarán automáticamente ese
avance. Esto evita que la proveedora tenga que actualizar decenas de colaciones
individualmente.

Capacitaciones y extras incluidos en la entrega del día deben reflejar el mismo
estado general. Las solicitudes canceladas o rechazadas quedan excluidas del
seguimiento activo.

## Historial y trazabilidad

Cada cambio debe guardar como mínimo:

- servicio y fecha;
- estado anterior y estado nuevo;
- fecha y hora exactas en `America/Santiago`;
- usuario y rol que realizó el cambio;
- observación opcional ante una corrección o incidencia.

Los estados deben avanzar en orden. Un retroceso o corrección debe requerir una
confirmación explícita, una observación obligatoria y quedar registrado en el
historial.

## Presentación en la interfaz

Mostrar una línea de progreso con iconos, nombre de la etapa actual y hora de la
última actualización. Las transiciones pueden usar animaciones suaves al cambiar
de etapa, sin animaciones permanentes que distraigan.

La interfaz debe respetar `prefers-reduced-motion` y seguir siendo comprensible
sin animaciones. En dispositivos móviles, las etapas pueden presentarse de forma
vertical para evitar desplazamiento horizontal.

Mensajes sugeridos para trabajadores:

- `Tu colación fue registrada.`
- `La cocina comenzó la preparación.`
- `Tu colación está lista para salir.`
- `El pedido va en camino.`
- `Las colaciones fueron entregadas en Securitas.`

## Notificaciones

Los cambios importantes pueden generar un aviso dentro de la aplicación. El
correo debe ser opcional y reservarse principalmente para incidencias o cambios
relevantes, evitando enviar un correo masivo en cada etapa normal.

## Situaciones especiales por definir

Antes de implementar se debe confirmar:

- quién puede corregir un estado marcado por error;
- si `Entregado` significa llegada a Securitas o entrega individual al trabajador;
- tratamiento de entregas parciales o atrasadas;
- si capacitaciones y colaciones regulares pueden despacharse por separado;
- tiempo durante el cual se mostrará el seguimiento de un día anterior.

## Criterios mínimos de aceptación

- Solo los roles autorizados pueden cambiar cada etapa.
- Todos los cambios quedan registrados con usuario, fecha y hora.
- Proveedora, Securitas y delivery observan el mismo estado actualizado.
- Cada trabajador ve el estado correspondiente a su propia colación.
- El flujo funciona correctamente en escritorio y móvil.
- Las animaciones no bloquean acciones y respetan accesibilidad.
- Cancelaciones y solicitudes rechazadas no aparecen como entregas activas.
- La actualización simultánea de varios usuarios no permite saltos ni estados
  contradictorios.
