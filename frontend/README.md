# Frontend SN Colaciones

Aplicación Next.js 16 con App Router para trabajadores y administradoras.

## Carpetas

- `src/app`: páginas, layouts y rutas.
- `src/components`: componentes compartidos y proveedores de UI.
- `src/config`: configuración pública validada del frontend.
- `src/lib`: utilidades y clientes Supabase.
- `src/schemas`: contratos de formularios y respuestas.
- `src/services`: acceso a la API del backend.
- `src/types`: tipos del dominio.

## Comandos

```bash
npm run dev -w frontend
npm run lint -w frontend
npm run build -w frontend
```

## Acceso y datos

No existe un modo demostración. Todas las rutas operativas requieren una sesión
de Supabase, un perfil activo y el rol correspondiente. Las lecturas iniciales
se realizan en Server Components y todas las mutaciones pasan por la API Express,
que vuelve a validar JWT, rol, RLS y reglas horarias.
