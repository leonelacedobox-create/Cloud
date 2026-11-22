#!/usr/bin/env python3
"""Genera las dos caras de la moneda (assets/coin-milei.png, assets/coin-cristina.png)
y los íconos de la app a partir de las fotos en assets/src/.

Uso:  python3 tools/make_coins.py
Requiere: Pillow, numpy
"""
import math
import os
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "src")
OUT = os.path.join(ROOT, "assets")

S = 720            # tamaño final de cada cara (px)
SS = 2             # supermuestreo para bordes suaves
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

# Cada cara: archivo, recorte (x0,y0,x1,y1) de la foto, texto del borde
FACES = [
    dict(name="milei", file="milei.jpg", box=(160, 0, 800, 640),
         text="JAVIER MILEI", sub="EL LEÓN"),
    dict(name="cristina", file="cristina.jpg", box=(10, 0, 449, 439),
         text="CRISTINA KIRCHNER", sub="LA REINA"),
]

# Paleta de metal (oro envejecido)
DARK = np.array([54, 34, 6], dtype=np.float32)
MID = np.array([196, 142, 44], dtype=np.float32)
LIGHT = np.array([255, 236, 160], dtype=np.float32)


def metal(lum):
    """lum: array 0..1 -> RGB dorado."""
    lum = np.clip(lum, 0, 1)[..., None]
    lo = DARK + (MID - DARK) * np.clip(lum * 2, 0, 1)
    hi = MID + (LIGHT - MID) * np.clip(lum * 2 - 1, 0, 1)
    return np.where(lum < 0.5, lo, hi)


def radial(size, inner, outer, power=1.0):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2
    r = np.sqrt((x - c) ** 2 + (y - c) ** 2) / c
    return inner + (outer - inner) * np.clip(r, 0, 1) ** power


def brushed_noise(size, seed):
    rng = np.random.default_rng(seed)
    n = rng.random((size, size)).astype(np.float32)
    img = Image.fromarray((n * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    return np.asarray(img, dtype=np.float32) / 255.0


def circle_mask(size, radius, feather=1.5):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    c = size / 2
    d.ellipse((c - radius, c - radius, c + radius, c + radius), fill=255)
    return m.filter(ImageFilter.GaussianBlur(feather))


def photo_relief(path, box, diameter):
    im = Image.open(path).convert("RGB").crop(box).resize((diameter, diameter), Image.LANCZOS)
    g = ImageOps.grayscale(im)
    g = ImageOps.autocontrast(g, cutoff=1)
    # contraste local: hace que parezca acuñado
    blur = g.filter(ImageFilter.GaussianBlur(diameter / 12))
    ga = np.asarray(g, dtype=np.float32) / 255
    ba = np.asarray(blur, dtype=np.float32) / 255
    local = np.clip(0.5 + (ga - ba) * 1.9, 0, 1)
    base = np.clip(ga * 0.55 + local * 0.45, 0, 1)
    base = np.clip((base - 0.5) * 1.25 + 0.52, 0, 1)
    # relieve (emboss) desde la luz arriba-izquierda
    emb = np.asarray(g.filter(ImageFilter.GaussianBlur(1.2)).filter(ImageFilter.EMBOSS), dtype=np.float32) / 255
    lum = np.clip(base * 0.78 + (emb - 0.5) * 0.55 + 0.08, 0, 1)
    return lum


def draw_arc_text(canvas, text, center, radius, size, start_deg, span_deg, color, inverted=False):
    """Escribe texto siguiendo un arco. start_deg: ángulo del centro del texto (0 = arriba)."""
    font = ImageFont.truetype(FONT_BOLD, size)
    n = len(text)
    # ancho de cada letra
    widths = [font.getlength(ch) for ch in text]
    total = sum(widths) + (n - 1) * size * 0.06
    # ángulo que ocupa el texto
    ang_total = total / radius
    cur = -ang_total / 2
    for ch, w in zip(text, widths):
        ang_c = cur + (w / 2) / radius
        cur += (w + size * 0.06) / radius
        a = math.radians(start_deg) + (ang_c if not inverted else -ang_c)
        # glifo
        g = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        gd.text((size, size), ch, font=font, fill=color, anchor="mm")
        rot = math.degrees(a) if not inverted else math.degrees(a) + 180
        g = g.rotate(-rot, resample=Image.BICUBIC, expand=False)
        px = center[0] + radius * math.sin(a)
        py = center[1] - radius * math.cos(a)
        canvas.alpha_composite(g, (int(px - size), int(py - size)))


def make_face(face, seed):
    W = S * SS
    c = W / 2
    # --- 1. disco base metálico
    base = metal(0.55 - radial(W, 0, 0.18, 1.6) + (brushed_noise(W, seed) - 0.5) * 0.08)
    base_img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    # --- 2. anillo exterior en relieve + cuentas
    ring = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    r_out = c - 4 * SS
    # borde elevado (anillo claro arriba-izq, oscuro abajo-der)
    for i in range(14 * SS):
        t = i / (14 * SS)
        rr = r_out - i
        col = (int(255 - 150 * t), int(226 - 130 * t), int(140 - 100 * t), 255)
        rd.ellipse((c - rr, c - rr, c + rr, c + rr), outline=col, width=1)
    # sombra interior del borde
    inner_r = r_out - 14 * SS
    rd.ellipse((c - inner_r, c - inner_r, c + inner_r, c + inner_r), outline=(60, 38, 6, 220), width=2 * SS)

    # campo del anillo de texto (ligeramente más oscuro/mate)
    field_o = inner_r
    field_i = c * 0.70
    field = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    fd = ImageDraw.Draw(field)
    fd.ellipse((c - field_o, c - field_o, c + field_o, c + field_o), fill=(150, 104, 28, 255))
    fd.ellipse((c - field_i, c - field_i, c + field_i, c + field_i), fill=(0, 0, 0, 0))
    field = field.filter(ImageFilter.GaussianBlur(0.6 * SS))
    nz = brushed_noise(W, seed + 7)
    # gradiente suave sobre el campo
    grad = metal(0.46 + (nz - 0.5) * 0.12 - radial(W, 0, 0.05))
    field_rgb = Image.fromarray(np.clip(grad, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    field_rgb.putalpha(field.split()[3])

    img = Image.alpha_composite(base_img, field_rgb)
    img = Image.alpha_composite(img, ring)

    # --- 3. texto del borde (con sombra para dar relieve)
    ring_mid = (field_o + field_i) / 2 - 2 * SS
    tsize = int(34 * SS)
    for off, col in [((2 * SS, 2 * SS), (50, 30, 4, 255)), ((-1 * SS, -1 * SS), (255, 240, 180, 255)), ((0, 0), (206, 152, 50, 255))]:
        layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        draw_arc_text(layer, face["text"], (c + off[0], c + off[1]), ring_mid, tsize, 0, 0, col)
        draw_arc_text(layer, "• ARGENTINA • " + face["sub"], (c + off[0], c + off[1]), ring_mid, int(tsize * 0.8), 180, 0, col, inverted=True)
        img = Image.alpha_composite(img, layer)

    # cuentas en el contorno interior del campo
    bead = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bead)
    nb = 96
    br = field_i + 5 * SS
    for k in range(nb):
        a = 2 * math.pi * k / nb
        bx, by = c + br * math.sin(a), c - br * math.cos(a)
        rr = 3.2 * SS
        bd.ellipse((bx - rr, by - rr, bx + rr, by + rr), fill=(80, 50, 8, 255))
        rr2 = 2.6 * SS
        bd.ellipse((bx - rr2 - SS * 0.4, by - rr2 - SS * 0.4, bx + rr2 - SS * 0.4, by + rr2 - SS * 0.4), fill=(255, 224, 140, 255))
    img = Image.alpha_composite(img, bead)

    # --- 4. foto acuñada en el centro
    diam = int(field_i * 2 - 14 * SS)
    lum = photo_relief(os.path.join(SRC, face["file"]), face["box"], diam)
    rgb = metal(lum * 0.92 + 0.02)
    photo = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    pm = circle_mask(diam, diam / 2 - 1, 1.2 * SS)
    # bisel de la foto (sombra y luz en el borde)
    photo.putalpha(pm)
    shadow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sr = diam / 2 + 5 * SS
    sd.ellipse((c - sr, c - sr + 3 * SS, c + sr, c + sr + 3 * SS), fill=(40, 24, 4, 190))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4 * SS))
    img = Image.alpha_composite(img, shadow)
    # aro de bisel
    bevel = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    bvd = ImageDraw.Draw(bevel)
    br2 = diam / 2 + 4 * SS
    bvd.ellipse((c - br2, c - br2, c + br2, c + br2), fill=(255, 226, 150, 255))
    bvd.ellipse((c - br2 + 2 * SS, c - br2 + 2 * SS, c + br2 + 2 * SS, c + br2 + 2 * SS), fill=(90, 58, 10, 255))
    bvd.ellipse((c - br2 + 3 * SS, c - br2 + 3 * SS, c + br2 - 2 * SS, c + br2 - 2 * SS), fill=(0, 0, 0, 0))
    img = Image.alpha_composite(img, bevel)
    img.alpha_composite(photo, (int(c - diam / 2), int(c - diam / 2)))

    # --- 5. brillo especular y viñeta de curvatura
    arr = np.asarray(img, dtype=np.float32)
    y, x = np.mgrid[0:W, 0:W].astype(np.float32)
    gl = np.exp(-(((x - c * 0.55) ** 2 + (y - c * 0.45) ** 2) / (2 * (c * 0.55) ** 2)))
    arr[..., :3] = arr[..., :3] + 38 * gl[..., None]
    vig = 1 - 0.22 * np.clip(np.sqrt((x - c) ** 2 + (y - c) ** 2) / c, 0, 1) ** 3
    arr[..., :3] *= vig[..., None]
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")

    # --- 6. recorte circular final
    mask = circle_mask(W, c - 1.5 * SS, 1.0 * SS)
    img.putalpha(ImageChops.multiply(img.split()[3], mask))
    return img.resize((S, S), Image.LANCZOS)


def make_icon(face_img, size, path, pad=0.0, bg=(18, 22, 38)):
    icon = Image.new("RGB", (size, size), bg)
    d = int(size * (1 - 2 * pad))
    f = face_img.resize((d, d), Image.LANCZOS)
    icon.paste(f, ((size - d) // 2, (size - d) // 2), f)
    icon.save(path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    imgs = {}
    for i, face in enumerate(FACES):
        im = make_face(face, seed=11 + i)
        im.save(os.path.join(OUT, f"coin-{face['name']}.png"), optimize=True)
        imgs[face["name"]] = im
        print("ok", face["name"])
    make_icon(imgs["milei"], 192, os.path.join(OUT, "icon-192.png"), pad=0.06)
    make_icon(imgs["milei"], 512, os.path.join(OUT, "icon-512.png"), pad=0.06)
    make_icon(imgs["milei"], 512, os.path.join(OUT, "icon-maskable-512.png"), pad=0.14)
    print("listo")
