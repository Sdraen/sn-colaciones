# Cierre y aceptación del MVP

Más que agregar funcionalidades, ahora falta cerrar y validar. El sistema está
en etapa de piloto funcional, pero aún no se considera listo para producción.

## Lo imprescindible antes de terminar

### 1. Confirmar las reglas pendientes con la clienta

- Confirmar si existe servicio en feriados y vacaciones, y cómo informa
  Securitas la disponibilidad reducida para esas fechas.
- Correos definitivos de cada rol.

### 2. Cerrar dos posibles vacíos detectados

- Una vez confirmada la regla de feriados y vacaciones, ajustar el calendario y
  agregar una interfaz sencilla para gestionarlo.
- Realizar la prueba funcional de llegada y término de entrega por despacho y
  de confirmación final por Securitas. La migración `0008` ya fue ejecutada y
  verificada en el proyecto remoto.

### 3. Realizar una prueba completa con datos reales

- La proveedora publica el menú.
- Los trabajadores reservan, modifican y cancelan.
- Securitas registra capacitaciones y extras.
- La proveedora aprueba o rechaza extras.
- Delivery consulta e imprime el resumen.
- Delivery registra la llegada y el término de la entrega; Securitas confirma
  la recepción completa.
- Ambas administradoras revisan reportes.

### 4. Antes de producción

- Crear las cuentas definitivas.
- Deshabilitar registros públicos.
- Probar permisos RLS con cada rol.
- Configurar dominio, Resend y correos de acceso.
- Desplegar frontend y backend.
- Configurar respaldos, monitoreo y envío automático de correos.
- Hacer una prueba móvil real.
- Mantener documentado y verificar que las migraciones `0001` a `0008` fueron
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
