#!/usr/bin/env python3
"""Arma una versión de un solo archivo (moneda-y-batalla.html) con todo adentro:
CSS, JavaScript y las imágenes de la moneda en base64. Se abre con doble toque en el celular,
sin servidor y sin conexión.

Uso:  python3 tools/build_single.py [carpeta_de_salida]
"""
import base64
import io
import os
import re
import sys
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist")
os.makedirs(OUT, exist_ok=True)


def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()


def data_uri(path, size=640):
    """Reduce la imagen y la pasa a WebP (con transparencia) en base64: pesa ~10 veces menos que el PNG."""
    im = Image.open(os.path.join(ROOT, path)).convert("RGBA")
    im = im.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=90, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


MILEI = data_uri("assets/coin-milei.png")
CRIS = data_uri("assets/coin-cristina.png")

html = read("index.html")
css = read("css/style.css")
css = css.replace("url(../assets/coin-milei.png)", f"url({MILEI})").replace("url(../assets/coin-cristina.png)", f"url({CRIS})")

# CSS dentro de <style>
html = html.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "\n</style>")
# imágenes del menú
html = html.replace('src="assets/coin-milei.png"', f'src="{MILEI}"').replace('src="assets/coin-cristina.png"', f'src="{CRIS}"')
# sin manifest ni íconos externos (en un archivo suelto no hacen falta)
html = re.sub(r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n?', "", html)


def inline_script(m):
    js = read(m.group(1))
    assert "</script" not in js.lower()
    return "<script>\n" + js + "\n</script>"


html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_script, html)
# las imágenes que usa el JS de la moneda
html = html.replace("'assets/coin-milei.png'", f"'{MILEI}'").replace("'assets/coin-cristina.png'", f"'{CRIS}'")

single = os.path.join(OUT, "moneda-y-batalla.html")
with open(single, "w", encoding="utf-8") as f:
    f.write(html)
print("ok", single, round(os.path.getsize(single) / 1024), "KB")

# zip del proyecto completo (sin fotos originales ni git)
zpath = os.path.join(OUT, "moneda-y-batalla-proyecto.zip")
skip_dirs = {".git", "dist", "src", "__pycache__"}
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fn in files:
            full = os.path.join(base, fn)
            z.write(full, os.path.join("moneda-y-batalla", os.path.relpath(full, ROOT)))
print("ok", zpath, round(os.path.getsize(zpath) / 1024), "KB")
