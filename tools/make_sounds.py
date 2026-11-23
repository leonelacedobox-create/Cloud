#!/usr/bin/env python3
"""Prepara los sonidos reales del juego (0.9.6) a partir de los paquetes descargados.

Fuentes (ver CREDITOS.md):
  - Freedoom (https://github.com/freedoom/freedoom), licencia BSD de 3 cláusulas: carpeta sounds/*.wav
  - Kenney (CC0) vía @netforge/asset-library-files (npm): library/audio/sfx/*.ogg
  - Kenney Starter Kit FPS (https://github.com/KenneyNL/Starter-Kit-FPS), sonidos CC0: sounds/*.ogg
  - "Battle Theme A" de cynicmusic (CC0) vía @netforge/asset-library-files: library/audio/music/battle_theme_a.mp3

Cada sonido se limpia (los de Freedoom son de 8 bits y tienen soplido), se recorta el silencio,
se normaliza y se pasa a MP3 mono liviano. Los disparos y explosiones tienen además una versión
"de lejos" (sin agudos y con eco), así suenan distinto según la distancia.

Uso:  python3 tools/make_sounds.py <freedoom/sounds> <netforge/library/audio> <kenney-fps/sounds>
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sfx")
FD, NF, KF = sys.argv[1:4]

CLEAN8 = "highpass=f=70,afftdn=nf=-32:nr=14,lowpass=f=9000"          # para los de 8 bits
TRIM = "silenceremove=start_periods=1:start_threshold=-45dB"
FAR = "lowpass=f=1400,aecho=0.8:0.6:90|210|380:0.35|0.22|0.12,volume=0.9"

# clave -> (archivo de origen, filtros extra, versión de lejos?)
JOBS = {
    # armas
    "g_pistol": (f"{FD}/dspistol.wav", CLEAN8, True),
    "g_shotgun": (f"{FD}/dsshotgn.wav", CLEAN8, True),
    "g_heavy": (f"{FD}/dsdshtgn.wav", CLEAN8, True),
    "g_auto": (f"{FD}/dspistol.wav", CLEAN8 + ",atrim=0:0.22,afade=t=out:st=0.1:d=0.12", True),
    "pump": (f"{FD}/dssgcock.wav", CLEAN8, False),
    "mag_out": (f"{FD}/dsdbopn.wav", CLEAN8, False),
    "mag_in": (f"{FD}/dsdbcls.wav", CLEAN8, False),
    "shell": (f"{FD}/dsdbload.wav", CLEAN8, False),
    "swap": (f"{KF}/weapon_change.ogg", "", False),
    # cuchillo y golpes
    "swing": (f"{FD}/dsskeswg.wav", CLEAN8, False),
    "stab": (f"{FD}/dsclaw.wav", CLEAN8 + ",atrim=0:0.3,afade=t=out:st=0.18:d=0.12", False),
    "punch": (f"{FD}/dspunch.wav", CLEAN8, False),
    # impactos
    "hit_flesh": (f"{NF}/sfx/hit.ogg", "", False),
    "hit_hard": (f"{NF}/sfx/impact.ogg", "", False),
    "hit_metal": (f"{FD}/dsmetal.wav", CLEAN8 + ",atrim=0:0.35,afade=t=out:st=0.2:d=0.15", False),
    "tink": (f"{FD}/dstink.wav", CLEAN8, False),
    "land": (f"{NF}/sfx/land.ogg", "", False),
    "step": (f"{NF}/sfx/step.ogg", "", False),
    # explosiones
    "boom": (f"{FD}/dsbarexp.wav", CLEAN8, True),
    "boom_big": (f"{FD}/dsrxplod.wav", CLEAN8 + ",atrim=0:2.6,afade=t=out:st=1.6:d=1", False),
    # voces
    "pain": (f"{FD}/dsplpain.wav", CLEAN8, False),
    "death": (f"{FD}/dspldeth.wav", CLEAN8, False),
    "death2": (f"{FD}/dspdiehi.wav", CLEAN8, False),
    "oof": (f"{FD}/dsoof.wav", CLEAN8, False),
    # objetos e interfaz
    "pick_item": (f"{FD}/dsitemup.wav", CLEAN8, False),
    "pick_gun": (f"{FD}/dswpnup.wav", CLEAN8, False),
    "power": (f"{FD}/dsgetpow.wav", CLEAN8, False),
    "switch": (f"{FD}/dsswtchn.wav", CLEAN8, False),
    "radio": (f"{FD}/dsradio.wav", CLEAN8 + ",atrim=0:0.45,afade=t=out:st=0.3:d=0.15", False),
    "revive": (f"{NF}/sfx/revive.ogg", "", False),
    "coin": (f"{NF}/sfx/coin.ogg", "", False),
    "ui": (f"{NF}/sfx/ui.ogg", "", False),
}


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args, check=True)


def peak_gain(src, chain):
    """Cuánto subir el volumen para que el pico quede en -1 dB (sin aplastar el golpe del sonido)."""
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", src, "-af", chain + ",volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    mx = float(re.search(r"max_volume: (-?[\d.]+) dB", r.stderr).group(1))
    return -1.0 - mx


def build(key, src, extra, far):
    base = ",".join(x for x in [extra, TRIM] if x)
    chain = base + f",volume={peak_gain(src, base):.2f}dB,alimiter=limit=0.95"
    dst = os.path.join(OUT, key + ".mp3")
    run(["-i", src, "-af", chain, "-ac", "1", "-ar", "32000", "-c:a", "libmp3lame", "-b:a", "56k", dst])
    if far:
        run(["-i", src, "-af", chain + "," + FAR + ",apad=pad_dur=0.4", "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "40k", os.path.join(OUT, key + "_far.mp3")])


def main():
    os.makedirs(OUT, exist_ok=True)
    for key, (src, extra, far) in JOBS.items():
        build(key, src, extra, far)
    # música: tema de batalla, mono y liviano (en el archivo único va en base64)
    run(["-i", f"{NF}/music/battle_theme_a.mp3", "-af", "dynaudnorm=p=0.9", "-ac", "1", "-ar", "32000", "-c:a", "libmp3lame", "-b:a", "48k",
         os.path.join(OUT, "music_battle.mp3")])
    total = 0
    for fn in sorted(os.listdir(OUT)):
        sz = os.path.getsize(os.path.join(OUT, fn)); total += sz
        print(f"{fn:22s} {sz / 1024:6.1f} KB")
    print(f"total {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
