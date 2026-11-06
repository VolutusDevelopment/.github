"""Arma profile/assets/portada.gif con los cuadros que deja scripts/assets.mjs.

Uso: python scripts/portada-gif.py <carpeta de cuadros> <salida.gif>

La nube es una sola foto (fondo.png) y lo único que cambia es la franja de la
palabra que rota: cada cuadro es esa franja, en transparente, sobre el fondo.

Un GIF tiene 256 colores, así que el cielo se trama. La paleta es una sola para
todos los cuadros y el fondo se trama una vez: cada cuadro trama solo su
franja. Si se tramara el cuadro entero, el error de la palabra correría por
toda la nube y la haría chispear de un cuadro a otro.
"""

import json
import sys
from pathlib import Path

from PIL import Image

carpeta, salida = Path(sys.argv[1]), Path(sys.argv[2])
datos = json.loads((carpeta / "cuadros.json").read_text(encoding="utf-8"))
fondo = Image.open(carpeta / "fondo.png").convert("RGB")
x, y = datos["zona"]["x"], datos["zona"]["y"]


def franja(archivo):
    palabra = Image.open(carpeta / archivo).convert("RGBA")
    debajo = fondo.crop((x, y, x + palabra.width, y + palabra.height)).convert("RGBA")
    debajo.alpha_composite(palabra)
    return debajo.convert("RGB")


franjas = [(cuadro["ms"], franja(cuadro["archivo"])) for cuadro in datos["cuadros"]]

# La paleta sale del fondo y de cada palabra quieta, con su color.
quietas = [imagen for ms, imagen in franjas if ms > 100]
alto = quietas[0].height
muestra = Image.new("RGB", (fondo.width, fondo.height + alto * len(quietas)))
muestra.paste(fondo, (0, 0))
for i, imagen in enumerate(quietas):
    muestra.paste(imagen, (x, fondo.height + alto * i))
paleta = muestra.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

fondo_tramado = fondo.quantize(palette=paleta, dither=Image.Dither.FLOYDSTEINBERG)
cuadros = []
for ms, imagen in franjas:
    cuadro = fondo_tramado.copy()
    cuadro.paste(imagen.quantize(palette=paleta, dither=Image.Dither.FLOYDSTEINBERG), (x, y))
    cuadros.append(cuadro)

cuadros[0].save(
    salida,
    save_all=True,
    append_images=cuadros[1:],
    duration=[ms for ms, _ in franjas],
    loop=0,
    disposal=1,
)
print(f"{salida.name}: {len(cuadros)} cuadros, {salida.stat().st_size / 1e6:.2f} MB")
