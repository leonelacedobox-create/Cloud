# Moneda y Batalla

Mini app para el celular (HTML + JavaScript, sin dependencias) con dos juegos para pasar el rato con los compañeros de trabajo.

## 🪙 La Moneda
- Moneda 3D con canto estriado, brillo, rebotes, sonido y vibración. Un lado Milei, el otro Cristina.
- **Libre**, **Apuestas** (cada uno elige su cara y suma 🏆 si acierta) y **Se va temprano** (reparte a todos de un lado u otro; se va el que gana o el que pierde, a elección).
- **Series**: 1 tirada, mejor de 3, 5 o 7.
- Estadísticas e historial guardados en el celular.

## 🔫 Batalla en el laberinto
- 2 a 10 soldados, cada uno con nombre y color. Se mueven y disparan solos; gana el último en pie.
- Todos contra todos o **por equipos** (2 a 4, con reparto al azar).
- Mapas aleatorios: Laberinto, Habitaciones y Arena. Tres tamaños, adaptados a la forma de la pantalla.
- 1 a 5 vidas, power-ups (escudo, triple disparo, velocidad, vida), zona que se achica, personalidades (agresivo, cauteloso, francotirador).
- Velocidad 1×/2×/4×, pausa, cuenta regresiva, podio final, revancha y **tabla de victorias** (semana / total).

## Cómo usarla
Abrí `index.html` desde cualquier servidor estático, por ejemplo:

```sh
python3 -m http.server 8000   # y entrar a http://localhost:8000
```

Para jugar desde el celular tiene que estar publicada en algún hosting (GitHub Pages, Netlify, etc.) o abrirse desde la misma red wifi. Una vez abierta, en el menú del navegador elegí **“Agregar a pantalla de inicio”** y funciona como una app, incluso sin conexión.

Si cambiás archivos, subí `VERSION` en `sw.js` para que los celulares actualicen.

## Cambiar las fotos de la moneda
Las fotos originales están en `assets/src/`. Para regenerar las caras (y los íconos) después de cambiarlas:

```sh
pip install pillow numpy
python3 tools/make_coins.py
```

El recorte de cada foto y el texto del borde se ajustan en la lista `FACES` de ese script.
