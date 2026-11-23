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
- Mapas aleatorios grandes: Laberinto, Habitaciones y Arena, en tres tamaños (Chico, Medio, Grande). Una **cámara sigue la acción** (o a un soldado si tocás su nombre arriba), hay **minimapa** y un botón 🎥 para alternar entre *Auto*, *Siguiendo* y *Todo el mapa*.
- Máximo **3 vidas** por soldado (cada vida son 100 puntos de vida; cada arma hace un daño distinto), power-ups (escudo, velocidad, vida extra) y zona que se achica. Con 10 soldados una partida dura de 1 a 1,5 minutos en Medio y unos 3 en Grande.

### Mapas (8 opciones)
- **Clásicos:** Laberinto, Habitaciones y Arena (ahora con cajones, barriles y ventanas).
- **Temáticos:** 🪖 **Base militar** (barracas con puertas, patio de grava, sacos de arena y búnkeres oscuros), 🏢 **Oficina** (escritorios, vidrios entre oficinas, alfombra que silencia los pasos, cocina y sala de reuniones con carteles), ⛓️ **Cárcel** (celdas con barrotes, torre de vigilancia, patio y celdas de castigo a oscuras) y 📦 **Depósito** (estantes largos formando pasillos, muelle de metal ruidoso, barriles y una oficina).
- **✏️ Propio:** dibujá tu mapa con texto (`#` pared, `.` piso, `D` puerta, `C` cajón, `B` barril, `W` ventana, `c` alfombra, `m` metal, `g` grava, `o` oscuro) y el botón *Revisar* lo valida.
- **Cobertura y objetos:** los **cajones** frenan balas pero no la vista (se puede disparar por encima si estás pegado) y se rompen; los **barriles** explotan en cadena; las **ventanas** dejan ver y disparar pero no pasar, y el vidrio roto delata el tiroteo.
- **Pisos:** alfombra (pasos casi mudos), metal y grava (pasos fuertes). **Zonas oscuras:** a oscuras solo se ve de cerca o con linterna; el que la prende se delata.
- **Eventos:** ⚡ apagón, 🌫️ niebla, 🚨 alarma (todos saben más o menos dónde están los demás) y 📦 cargamento que cae con paracaídas y se anuncia con sonido. Si una partida se estanca entra la ☠️ muerte súbita.

### Armas y equipo
- Todos empiezan con **pistola** (con munición y recarga) y **cuchillo**, y tienen un tercer espacio para un arma del piso.
- **9 armas del piso:** sniper, ametralladora ligera y pesada, escopeta, escopeta automática, subfusil, rifle de asalto, revólver y **ballesta silenciosa**. Cada una con su cargador, recarga, alcance, ruido y velocidad.
- **Granadas:** de fragmentación, de humo (tapa la vista) y aturdidora. La IA las tira simulando la trayectoria (rebotan: doblan esquinas y puertas), huye de las que están por explotar y les dispara a los barriles que están junto al rival.
- **Protección:** chaleco, casco, **botiquines** de tres tamaños (se usan quietos y en silencio, y se interrumpen si los lastiman) y mochila (más munición y granadas).
- **Accesorios:** silenciador, mira y cargador extendido.
- Al morir un soldado **suelta todo** lo que llevaba. Sin balas, pelean con el cuchillo (por la espalda pega mucho más).

### Personajes
Cada soldado es una persona distinta vista desde arriba (dibujada con código, `js/art.js`): piel, peinado (corto, largo, pelado, gorra, gorro, afro, colita, cresta), barba, lentes y ropa del color que elijas. Caminan con las piernas, apuntan con los dos brazos, retroceden al disparar y **estiran la mano para abrir y cerrar puertas**.

### Inteligencia (`js/ai.js`, `js/personas.js`)
- **No saben dónde está el rival.** Ven con un cono de visión (no por la espalda ni a través de paredes) y **oyen**: pasos, disparos, gritos, puertas. Las paredes apagan el sonido y la ubicación que oyen es aproximada. Un “?” sobre la cabeza es que oyó algo, un “!” que vio a alguien, y 😨 / 😡 que están asustados o furiosos.
- **Tácticas:** se cubren tras una esquina, asoman, disparan y vuelven a esconderse (y recargan escondidos); huyen y buscan vida cuando están mal; eligen a quién disparar según la amenaza; esquivan balas; flanquean y predicen hacia dónde va el rival; revisan los cuartos de a uno; esperan detrás de una puerta; disparan a ciegas a través de ellas; el **francotirador** busca los pasillos más largos y cambia de lugar después de cada disparo; el **asesino** se acerca por la espalda con el cuchillo; el **oportunista** espera a que otros se peleen y entra cuando uno cae.
- **8 personalidades:** 🔥 Agresivo, 🛡️ Cauteloso, 🎯 Francotirador, 🗡️ Asesino, 🧭 Táctico, 🦊 Oportunista, 😡 Berserker y 🐔 Cobarde. Cada soldado además varía al azar cuánto usa cada táctica. Se pueden elegir a mano con el ⚙️ de cada soldado.
- **4 niveles de inteligencia** (🐣 Novato, 🙂 Normal, 🎖️ Veterano, 🧠 Maestro): cambian el tiempo de reacción, la puntería, cuánto usan las tácticas, cuánto esquivan y cuántos errores cometen. Sirven para dar ventaja o desventaja entre compañeros.
- **Estados de ánimo:** el miedo y la furia suben con lo que pasa (ser herido, matar, ver caer a un compañero) y cambian la puntería, la velocidad y las decisiones.
- **Equipos:** se avisan por radio, se reagrupan, se pasan munición y, si activás el **fuego amigo**, no disparan cuando hay un compañero en la línea.
- **Insultos** de los agresivos con globos de texto (apagables, y podés escribir los tuyos); los silenciosos no dicen nada.

### Herramientas de la 0.2
- **Semilla del mapa:** el mismo número da el mismo mapa, puertas, botín y puntos de partida (queda anotada en la pantalla de pausa y en el resultado).
- **POV:** el botón 👁 muestra la partida solo con lo que ve (y recuerda) un soldado.
- **Punto láser y abanico de dispersión** (opcional), **sonido que baja y se apaga con la distancia** y volúmenes separados para todo y para los disparos.
- **Al final:** estadísticas por soldado (bajas, daño, puntería) y premios graciosos (el más cobarde, el más bocón…).

### Banco de pruebas
```sh
node tools/bench.js --runs 12    # simula cientos de partidas sin dibujar y genera un reporte
```
Mide la duración, trabas, tácticas usadas, bajas por arma y el balance entre personalidades y niveles de inteligencia.

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

## Descargar como un solo archivo
Para tener todo en un archivo `.html` que se abre directo en el celular (sin servidor ni internet):

```sh
python3 tools/build_single.py        # crea dist/moneda-y-batalla.html y un .zip del proyecto
```
