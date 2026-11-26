# Seguridad

- Solo se publica la clave `anon` de Supabase en `assets/js/config.js`.
- `service_role`, claves privadas de Culqi, tokens de Gemma y secretos de webhook viven en variables de entorno de Edge Functions.
- RLS activo en tablas de tienda y perfiles.
- Los roles se asignan en servidor; el frontend no puede auto-promover.
- El carrito y pedidos validan stock y precio en SQL (`store_create_order`).
- No se almacenan contraseñas en tablas propias.
- `.gitignore` excluye `.env`, modelos, `node_modules`, `PC`, `REPAIR`, venvs.
- Los recibos PNG se generan en el navegador del dueño del pedido.
