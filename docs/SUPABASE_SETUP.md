# Configuración de Supabase para GALAX PC REPAIR

## Variables públicas (frontend)
Edita `assets/js/config.js`:

```js
supabase: { url: 'https://TU-PROYECTO.supabase.co', anonKey: 'TU_CLAVE_ANON' }
```

Nunca agregues `service_role`, claves de Culqi secretas, tokens de Gemma ni contraseñas.

## Migraciones
Ejecuta en este orden en el SQL Editor de Supabase:

1. `database/supabase/001_schema_postgres.sql`
2. `database/supabase/002_seed_postgres.sql`
3. `supabase/migrations/202611260002_catalog_seed.sql`
4. `supabase/migrations/202611260003_store_backend.sql`

## Auth
- Habilita Email/Password.
- Redirect URLs:
  - `https://galanespacial.github.io/GALAX-PC-REPAIR/cuenta.html`
  - `https://galanespacial.github.io/GALAX-PC-REPAIR/cuenta.html?confirmado=1`
  - `https://galanespacial.github.io/GALAX-PC-REPAIR/cuenta.html?recuperar=1`
  - `http://127.0.0.1:5173/cuenta.html` para pruebas locales.
- Activa confirmación de correo si quieres verificación real.

## Rol administrador
Ejecuta con la cuenta del equipo ya registrada:

```sql
update public.profiles set role = 'admin' where id = 'UUID_DEL_USUARIO';
```

No se puede promover a admin desde JavaScript; el trigger `protect_profile_role` lo impide.

## Edge Functions
Despliega `supabase/functions/*` y configura secretos:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMMA_API_URL`, `GEMMA_API_KEY`, `GEMMA_MODEL` (opcional)
- `VISION_API_URL`, `VISION_API_KEY` (opcional)
- `CULQI_PRIVATE_KEY`, `CULQI_WEBHOOK_SECRET` (para tarjetas)

## Storage
Bucket público `product-images` para imágenes cargadas por admin (opcional). El catálogo actual usa rutas locales del repositorio.
