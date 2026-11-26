/* =====================================================================
   GALAX PC REPAIR — Configuración pública del frontend.
   ---------------------------------------------------------------------
   SEGURIDAD: aquí SOLO van valores públicos (URL del proyecto Supabase y
   la clave "anon"). Nunca agregues la service_role, llaves de Culqi
   secretas, tokens de Gemma ni contraseñas: este archivo se publica en
   GitHub Pages y lo descarga cualquier visitante.
   ===================================================================== */
window.GALAX_CONFIG = {
  siteUrl: 'https://galanespacial.github.io/GALAX-PC-REPAIR/',
  brand: 'GALAX PC REPAIR',
  whatsapp: '51986260738',
  currency: 'PEN',
  locale: 'es-PE',
  supabase: {
    url: '',          // Ej.: https://abcdefgh.supabase.co
    anonKey: ''       // Clave pública "anon" / "publishable" del proyecto
  },
  functions: {
    aiChat: 'ai-chat',
    visualSearch: 'visual-search',
    createPayment: 'create-payment',
    paymentWebhook: 'payment-webhook'
  },
  culqi: {
    publicKey: '',    // Clave pública de Culqi (pk_test_... / pk_live_...). NUNCA la secreta.
    checkoutScript: 'https://checkout.culqi.com/js/v4'
  },
  commerce: {
    shippingLima: 12,
    maxQtyPerLine: 10,
    orderPrefix: 'GX'
  },
  flags: {
    catalogFromSupabase: true, // Si Supabase está configurado, el catálogo usa RPC con paginación en servidor.
    cloudFavorites: true,
    cloudContent: true
  }
};
