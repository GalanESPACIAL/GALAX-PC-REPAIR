-- GALAX PC REPAIR — Contenido editable del editor de página (PostgreSQL/Supabase)
-- Idempotente: se puede ejecutar varias veces sin duplicar ni borrar datos.

-- Columnas de promociones por producto (opcionales, fechas de vigencia)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS promo_inicio date;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS promo_fin date;

-- Asegurar unicidad de la clave de configuración (necesario para ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_clave_key'
  ) THEN
    ALTER TABLE configuracion ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);
  END IF;
END $$;

INSERT INTO configuracion (clave, valor, descripcion) VALUES
 ('hero_eyebrow','Venta · Reparación · Asistencia','Etiqueta superior del inicio'),
 ('hero_title','Tecnología que','Título principal del inicio'),
 ('hero_highlight','sí funciona','Palabra destacada del título'),
 ('hero_text','Componentes y equipos con stock real, reparación técnica especializada y un asistente que te orienta con datos de nuestro catálogo. Todo en un solo lugar.','Texto descriptivo del inicio'),
 ('hero_primary_text','Ver catálogo','Texto del botón principal'),
 ('hero_primary_url','/shop/catalog.php','Enlace del botón principal'),
 ('hero_secondary_text','Reparar mi equipo','Texto del botón secundario'),
 ('hero_secondary_url','/shop/repair_request.php','Enlace del botón secundario'),
 ('banner_title','Tecnología a tu alcance','Título del banner promocional'),
 ('banner_text','Descubre nuestros productos y servicios con precios reales y stock disponible.','Texto del banner promocional'),
 ('banner_button_text','Ver ofertas','Texto del botón del banner'),
 ('banner_url','/shop/catalog.php?oferta=1','Enlace del banner'),
 ('section_categorias_visible','1','Mostrar u ocultar categorías'),
 ('section_destacados_visible','1','Mostrar u ocultar destacados'),
 ('section_ofertas_visible','1','Mostrar u ocultar ofertas'),
 ('section_servicios_visible','1','Mostrar u ocultar servicios'),
 ('section_whatsapp_visible','1','Mostrar u ocultar WhatsApp'),
 ('section_tesis_visible','1','Mostrar u ocultar sección del proyecto'),
 ('ofertas_title','Precios que convienen','Título de la sección de ofertas'),
 ('ofertas_text','Productos con precio promocional, equipos recomendados y novedades.','Texto de la sección de ofertas'),
 ('whatsapp_title','Únete a nuestra comunidad de GALAX PC REPAIR','Título de la invitación'),
 ('whatsapp_text','Mantente informado sobre novedades tecnológicas, productos, ofertas y noticias de nuestra comunidad.','Texto de la invitación'),
 ('whatsapp_url','https://chat.whatsapp.com/I7Syor85Jia6lfE6oIJ7tX?s=sh&p=a&iam=2//de','Enlace exacto del grupo de WhatsApp'),
 ('tesis_intro','GALAX PC REPAIR es un proyecto desarrollado con la visión de crear una plataforma tecnológica que integre comercio electrónico, servicios informáticos, gestión de productos, soporte técnico y herramientas digitales en un solo entorno.','Introducción de la memoria'),
 ('tesis_objetivo','Construir una solución que permita ofrecer productos y servicios informáticos de manera organizada, moderna y accesible.','Objetivo general'),
 ('tesis_objetivos_especificos','Integrar catálogo, carrito y pedidos en una sola plataforma.
Ofrecer seguimiento de reparaciones y soporte técnico.
Brindar herramientas de administración sin editar código.','Objetivos específicos'),
 ('tesis_descripcion','Esta plataforma nace del interés por la programación, el desarrollo web y los sistemas de información. Reúne tienda, inventario, reparaciones, soporte y asistente inteligente en un entorno organizado y accesible.','Descripción de la plataforma'),
 ('tesis_tecnologias','PHP, JavaScript, HTML y CSS; Supabase (autenticación, base de datos PostgreSQL y almacenamiento); diseño responsive; servicios REST y asistente con modelo local.','Tecnologías utilizadas'),
 ('tesis_conclusion','GALAX PC REPAIR representa mi esfuerzo, aprendizaje, creatividad y compromiso con el desarrollo tecnológico.','Conclusión'),
 ('tesis_autor','Pedro Aldair Arribasplata','Autor del proyecto')
ON CONFLICT (clave) DO NOTHING;
