from pathlib import Path
import re
for f in ['docs/galax_preview.html','docs/inventario_categoria1.js']:
    t = Path('F:/GALAX PC REPAIR', f).read_text(encoding='utf-8-sig')
    print(f, 'moji', len(re.findall(r'[\u00c2\u00c3][\u0080-\u00ff\u2010-\u201e\u2022\u20ac]', t)), 'e2', t.count('\u00e2\u20ac'))
