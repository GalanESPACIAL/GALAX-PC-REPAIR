-- Reversión estricta de la migración 004 (restaura el estado dañado "??").
-- Sólo debe usarse para deshacer 004, nunca en producción: vuelve a introducir
-- la codificación incorrecta generada al aplicar 002 desde una consola ANSI.
SET NAMES utf8mb4;

UPDATE `categorias` SET nombre='Tarjetas gr??ficas'        WHERE id=14 AND nombre='Tarjetas gráficas';
UPDATE `categorias` SET nombre='Fuentes de alimentaci??n' WHERE id=15 AND nombre='Fuentes de alimentación';
UPDATE `categorias` SET nombre='Aud??fonos'               WHERE id=19 AND nombre='Audífonos';
UPDATE `categorias` SET nombre='Refrigeraci??n'           WHERE id=23 AND nombre='Refrigeración';

UPDATE `categorias` SET descripcion='M??dulos de memoria'                        WHERE id=11 AND descripcion='Módulos de memoria';
UPDATE `categorias` SET descripcion='Unidades de estado s??lido'                 WHERE id=12 AND descripcion='Unidades de estado sólido';
UPDATE `categorias` SET descripcion='Unidades mec??nicas de almacenamiento'      WHERE id=13 AND descripcion='Unidades mecánicas de almacenamiento';
UPDATE `categorias` SET descripcion='GPU y aceleradores gr??ficos'               WHERE id=14 AND descripcion='GPU y aceleradores gráficos';
UPDATE `categorias` SET descripcion='Teclados mec??nicos y de membrana'          WHERE id=17 AND descripcion='Teclados mecánicos y de membrana';
UPDATE `categorias` SET descripcion='Ventiladores, disipadores y pasta t??rmica' WHERE id=23 AND descripcion='Ventiladores, disipadores y pasta térmica';
UPDATE `categorias` SET descripcion='Herramientas y repuestos t??cnicos'         WHERE id=24 AND descripcion='Herramientas y repuestos técnicos';

UPDATE `categorias` SET slug='fuentes-de-alimentacian' WHERE id=15 AND slug='fuentes-de-alimentacion';
UPDATE `categorias` SET slug='audafonos'               WHERE id=19 AND slug='audifonos';
UPDATE `categorias` SET slug='refrigeracian'           WHERE id=23 AND slug='refrigeracion';

UPDATE `configuracion` SET descripcion='URL p??blica de la tienda'                       WHERE id=12 AND descripcion='URL pública de la tienda';
UPDATE `configuracion` SET descripcion='Costo de env??o a domicilio en PEN'               WHERE id=13 AND descripcion='Costo de envío a domicilio en PEN';
UPDATE `configuracion` SET descripcion='D??as de conservaci??n del historial del chat'    WHERE id=15 AND descripcion='Días de conservación del historial del chat';
UPDATE `configuracion` SET descripcion='Segundos de espera m??xima para el modelo'       WHERE id=17 AND descripcion='Segundos de espera máxima para el modelo';
UPDATE `configuracion` SET descripcion='Pol??tica de privacidad del chat'                 WHERE id=19 AND descripcion='Política de privacidad del chat';
UPDATE `configuracion` SET valor='Tecnolog??a que funciona. Servicio en el que conf??a.' WHERE id=18 AND valor='Tecnología que funciona. Servicio en el que confía.';
UPDATE `configuracion` SET valor='El historial del chat se conserva seg??n la configuraci??n del sistema y puede eliminarse desde el perfil.' WHERE id=19 AND valor LIKE 'El historial del chat se conserva según%';

UPDATE `permisos` SET descripcion='Gesti??n de pedidos de la tienda'        WHERE id=11 AND descripcion='Gestión de pedidos de la tienda';
UPDATE `permisos` SET descripcion='Gesti??n de ??rdenes de reparaci??n'     WHERE id=12 AND descripcion='Gestión de órdenes de reparación';
UPDATE `permisos` SET descripcion='Configuraci??n del asistente'            WHERE id=15 AND descripcion='Configuración del asistente';
UPDATE `permisos` SET descripcion='Gesti??n de devoluciones'                WHERE id=18 AND descripcion='Gestión de devoluciones';

UPDATE `roles` SET nombre='T??cnico' WHERE id=5 AND nombre='Técnico';
UPDATE `roles` SET descripcion='Gesti??n de reparaciones e inventario' WHERE id=5 AND descripcion='Gestión de reparaciones e inventario';
UPDATE `roles` SET descripcion='Operaciones comerciales y atenci??n'     WHERE id=6 AND descripcion='Operaciones comerciales y atención';

UPDATE `servicios` SET nombre='Reparaci??n de PC y laptops' WHERE id=1 AND nombre='Reparación de PC y laptops';
UPDATE `servicios` SET nombre='Formateo e instalaci??n'     WHERE id=3 AND nombre='Formateo e instalación';
UPDATE `servicios` SET nombre='Instalaci??n de redes'       WHERE id=5 AND nombre='Instalación de redes';
UPDATE `servicios` SET nombre='Diagn??stico electr??nico'    WHERE id=6 AND nombre='Diagnóstico electrónico';

UPDATE `servicios` SET descripcion='Diagn??stico y reparaci??n de fallas de hardware, arranque, pantalla y componentes.' WHERE id=1 AND descripcion LIKE 'Diagnóstico y reparación de fallas%';
UPDATE `servicios` SET descripcion='Revisi??n electr??nica y reparaci??n especializada de placas y conectores.' WHERE id=2 AND descripcion LIKE 'Revisión electrónica y reparación%';
UPDATE `servicios` SET descripcion='Instalaci??n y configuraci??n del sistema operativo y programas esenciales.' WHERE id=3 AND descripcion LIKE 'Instalación y configuración del sistema%';
UPDATE `servicios` SET descripcion='Limpieza interna, cuidado t??rmico y puesta a punto para prolongar la vida ??til.' WHERE id=4 AND descripcion LIKE 'Limpieza interna, cuidado térmico%';
UPDATE `servicios` SET descripcion='Configuraci??n de redes cableadas e inal??mbricas para hogares y negocios.' WHERE id=5 AND descripcion LIKE 'Configuración de redes cableadas%';
UPDATE `servicios` SET descripcion='Evaluaci??n t??cnica para identificar el origen de la falla y recomendar una soluci??n.' WHERE id=6 AND descripcion LIKE 'Evaluación técnica para identificar%';

DELETE FROM `migraciones` WHERE version='004_repair_utf8_text.sql';
