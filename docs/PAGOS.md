# Pagos en GALAX PC REPAIR

Métodos coordinados:
- Yape
- Plin
- Transferencia bancaria
- Tarjeta (solo cuando Culqi esté configurado)

Reglas:
- El pedido se crea con `payment_status = pending`.
- No se marca como pagado sin confirmación del proveedor.
- La tarjeta está deshabilitada en la UI si falta `culqi.publicKey` o Supabase.
- Los webhooks deben verificarse antes de actualizar el estado.
- Nunca se guardan números completos de tarjeta ni CVV.
- El recibo PNG es comprobante comercial interno, no factura SUNAT.

Credenciales faltantes:
- Clave pública Culqi (`pk_test_...` / `pk_live_...`)
- Clave privada Culqi en secreto de Edge Function
- Secret de webhook
- Aprobación comercial de Yape/Plin si se requiere API
