# Backend SN Colaciones

API Node.js, Express y TypeScript organizada por capas.

## Carpetas

- `controllers`: adapta HTTP a casos de uso.
- `services`: reglas y operaciones de negocio.
- `routes`: definición de endpoints.
- `schemas`: validación Zod y contratos.
- `middleware`: autenticación, errores y aspectos transversales.
- `models`: modelos propios del dominio cuando no provengan de Supabase.
- `lib`: clientes de infraestructura, incluido Supabase.
- `config`: carga y validación del entorno.
- `openapi`: contrato público de la API.
- `tests`: pruebas de integración HTTP.

## Variables

Copiar `.env.example` a `.env.local`. La clave `SUPABASE_SECRET_KEY` es opcional
hasta implementar operaciones administrativas, pero jamás debe salir del backend.

## Comandos

```bash
npm run dev -w backend
npm run test -w backend
npm run build -w backend
```
