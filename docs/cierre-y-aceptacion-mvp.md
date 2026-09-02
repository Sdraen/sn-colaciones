# Cierre y aceptación del MVP

Más que agregar funcionalidades, ahora falta cerrar y validar. El sistema está
en etapa de piloto funcional, pero aún no se considera listo para producción.

## Lo imprescindible antes de terminar

### 1. Confirmar las reglas pendientes con la clienta

- Cómo calcula la disponibilidad diaria.
- Cómo se informan feriados, vacaciones y días sin servicio.
- Quién confirma finalmente que una colación fue entregada.
- Correos definitivos de cada rol.

### 2. Cerrar dos posibles vacíos detectados

- El backend permite gestionar feriados y vacaciones, pero falta una interfaz
  sencilla para hacerlo.
- El backend puede marcar pedidos como entregados, pero debe definirse quién lo
  hará y desde qué pantalla. Esto es necesario para que los reportes de
  `entregadas` sean reales.

### 3. Realizar una prueba completa con datos reales

- La proveedora publica el menú.
- Los trabajadores reservan, modifican y cancelan.
- Securitas registra capacitaciones y extras.
- La proveedora aprueba o rechaza extras.
- Delivery consulta e imprime el resumen.
- Ambas administradoras revisan reportes.

### 4. Antes de producción

- Crear las cuentas definitivas.
- Deshabilitar registros públicos.
- Probar permisos RLS con cada rol.
- Configurar dominio, Resend y correos de acceso.
- Desplegar frontend y backend.
- Configurar respaldos, monitoreo y envío automático de correos.
- Hacer una prueba móvil real.
- Mantener documentado y verificar que las migraciones `0001` a `0007` fueron
  ejecutadas correctamente en el proyecto remoto.

## Clasificación de solicitudes durante la reunión

Para proteger el alcance del trabajo, cada solicitud debe quedar clasificada en
una de estas categorías:

- **Error:** una funcionalidad aprobada no trabaja como fue acordada. Está
  incluido en el alcance.
- **Corrección:** ajuste pequeño sobre una función acordada. Se puede incluir
  una cantidad limitada de correcciones.
- **Nueva funcionalidad:** nueva pantalla, proceso, reporte o regla. Se registra
  para una segunda etapa y se cotiza por separado.

Mensaje sugerido para la clienta:

> El valor acordado contempla las funcionalidades actuales del MVP. Los errores
> y ajustes necesarios para que esas funciones trabajen correctamente están
> incluidos. Cualquier nueva función que aparezca después de la aprobación se
> registrará para una segunda etapa y se cotizará por separado.

El seguimiento animado y otras ideas nuevas quedan reservadas para una fase 2,
como se indica en `docs/funcionalidad-futura-seguimiento.md`. El siguiente paso
es preparar una lista de aceptación para la reunión y completar únicamente los
vacíos necesarios para operar.
