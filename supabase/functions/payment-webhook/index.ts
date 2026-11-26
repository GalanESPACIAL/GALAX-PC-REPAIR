import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("CULQI_WEBHOOK_SECRET") || "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  const raw = await req.text();
  // Verificación simple de firma compartida. En producción usar HMAC del proveedor.
  const signature = req.headers.get("x-culqi-signature") || req.headers.get("culqi-signature") || "";
  if (WEBHOOK_SECRET && signature !== WEBHOOK_SECRET) {
    return new Response("invalid_signature", { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response("invalid_json", { status: 400 }); }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const eventType = event?.type || event?.event || "";
  const data = event?.data || event?.object || {};
  const metadata = data?.metadata || {};
  const orderId = Number(metadata?.order_id);
  const chargeId = data?.id;

  if (eventType.includes("charge.succeeded") || eventType.includes("payment.succeeded")) {
    if (orderId) {
      await supabase.from("store_orders").update({
        payment_status: "paid",
        status: "pagado",
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
    }
  } else if (eventType.includes("charge.failed") || eventType.includes("payment.failed")) {
    if (orderId) {
      await supabase.from("store_orders").update({
        payment_status: "failed",
        status: "rechazado",
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
    }
  }

  // Idempotencia: registrar el evento sin duplicar pedidos.
  await supabase.from("audit_log").insert({
    accion: "payment_webhook",
    tabla: "store_orders",
    registro_id: orderId || null,
    detalles: JSON.stringify({ eventType, chargeId }).slice(0, 2000),
  }).catch(() => {});

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
