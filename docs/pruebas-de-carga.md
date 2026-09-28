# Pruebas de carga

La prueba de carga usa k6 contra la API real y cuentas temporales de trabajadores.
Nunca debe ejecutarse contra producción. Usa el backend local o un ambiente de
staging conectado a una base de datos de prueba.

## Qué valida

- consulta del menú semanal autenticado;
- creación o actualización de los pedidos de cada día abierto;
- confirmación posterior de que los pedidos quedaron guardados;
- tiempos p95, tasa de errores HTTP y fallos de negocio;
- comportamiento normal, aumento gradual hasta 300 usuarios y pico de 300.

Los criterios iniciales son menos de 1 % de errores, p95 general menor a 2
segundos y más de 99 % de comprobaciones correctas. La lectura sostenida debe
quedar bajo 1 segundo. La primera oleada simultánea de 100 usuarios puede llegar
a 2,5 segundos.

## Requisitos

1. Backend y Supabase de prueba disponibles.
2. Una semana publicada con al menos dos días aún reservables.
3. Cupo total suficiente en cada día para la cantidad de bots preparada.
4. `backend/.env.local` configurado con las credenciales del proyecto de prueba.
5. k6 instalado en Windows:

```powershell
winget install k6 --source winget
k6 version
```

## Primera ejecucion segura

Inicia el sistema en una terminal:

```powershell
npm run dev
```

En otra terminal prepara solo cinco cuentas, ejecuta el smoke test y limpia:

```powershell
$env:LOAD_TEST_WORKERS = "5"
npm run load:prepare
npm run load:smoke
npm run load:cleanup
Remove-Item Env:LOAD_TEST_WORKERS
```

La preparación crea `test-artifacts/k6-workers.json`. Contiene sesiones
temporales, está ignorado por Git y no se debe compartir. Ejecuta k6 durante la
hora siguiente a la preparación para evitar que las sesiones expiren.

## Secuencia completa

No pases al siguiente nivel hasta que el anterior termine sin errores.

### Mínimo obligatorio: 100 usuarios simultáneos

Este escenario crea un menú futuro aislado con cupo 100. No modifica cupos ni
pedidos operacionales. Los 100 usuarios consultan el menú, reservan dos días y
verifican sus pedidos al mismo tiempo.

```powershell
npm run load:prepare100
npm run load:concurrent100
npm run load:cleanup
```

### Carga normal: 100 usuarios durante 5 minutos

```powershell
$env:LOAD_TEST_WORKERS = "100"
npm run load:prepare100
npm run load:normal
npm run load:cleanup
```

Si el menú de staging tiene un cupo menor, usa la cantidad realmente disponible
sin modificar los cupos operacionales. Por ejemplo, para 40 usuarios:

```powershell
$env:LOAD_TEST_WORKERS = "40"
$env:LOAD_USERS = "40"
npm run load:prepare
npm run load:normal
npm run load:cleanup
Remove-Item Env:LOAD_TEST_WORKERS, Env:LOAD_USERS
```

### Estrés: aumento gradual hasta 300 usuarios

La prueba sube a 50, luego a 150 y finalmente a 300 usuarios; mantiene 300
durante cinco minutos y después baja a cero.

```powershell
$env:LOAD_TEST_WORKERS = "300"
npm run load:prepare
npm run load:stress300
npm run load:cleanup
```

### Pico: 300 usuarios al mismo tiempo

```powershell
$env:LOAD_TEST_WORKERS = "300"
npm run load:prepare
npm run load:spike300
npm run load:cleanup
Remove-Item Env:LOAD_TEST_WORKERS
```

Cada ejecucion deja su resumen JSON dentro de `test-artifacts/`.

## Ambiente remoto de staging

Para evitar apuntar por error a un servidor remoto, hay que confirmar exactamente
su origen. Mantén estas variables también durante la limpieza:

```powershell
$env:LOAD_TEST_API_URL = "https://api-staging.ejemplo.cl/api/v1"
$env:LOAD_TEST_CONFIRMED_ORIGIN = "https://api-staging.ejemplo.cl"
$env:LOAD_TEST_WORKERS = "5"
npm run load:prepare
npm run load:smoke
npm run load:cleanup
Remove-Item Env:LOAD_TEST_API_URL, Env:LOAD_TEST_CONFIRMED_ORIGIN, Env:LOAD_TEST_WORKERS
```

Si una ejecución se interrumpe, ejecuta `npm run load:cleanup` antes de volver a
preparar cuentas. La limpieza elimina también el archivo de sesiones y la
preparación siguiente borra bots antiguos como medida preventiva.
