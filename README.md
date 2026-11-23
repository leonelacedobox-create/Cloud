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

### Novedades de la 0.7 — modos de juego y diversión con los compañeros
- **7 modos de juego** (`js/modes.js`), con su propio marcador en pantalla:
  - ⚔️ **Duelo:** cada baja suma un punto, los caídos reaparecen en su base (con 3 s de protección). Gana el primero en llegar a la meta o quien va arriba a los 4 minutos.
  - 🚩 **Bandera:** dos equipos, cada uno con su bandera y su base. Hay que robar la ajena y llevarla a la propia (con la propia en su lugar). El que la lleva corre y dispara hacia atrás; si lo eliminan, la suelta.
  - 👑 **Colina:** una zona marcada que cambia de lugar. Suma el que la tiene solo (o su equipo); si hay enemigos adentro, nadie suma.
  - 💣 **Bomba:** atacantes (Rojo) contra defensores (Azul): hay que plantar (4 s) en el sitio A, y desactivarla (6 s) antes de que explote (35 s). Sin reapariciones.
  - 🌊 **Oleadas:** todos juntos contra bots, 5 oleadas (la última con un jefe). Entre oleadas se curan, recargan y reviven los caídos.
  - 🪙 **Botín:** lingotes de oro por el mapa; quien muere suelta la mitad de lo que llevaba.
  - 🔪 **Solo cuchillos:** sin armas ni botín.
  - Si un modo con tiempo empata, hay 90 s de **prórroga**, y si sigue el empate se puede **desempatar con la moneda** (Milei contra Cristina, con animación 3D) desde la pantalla del resultado.
- **Roles** (⚙️ de cada soldado): 💣 Asalto, 🩹 Médico, 🎯 Tirador y 🛡️ Tanque arrancan con equipo extra. En los modos con reaparición cada equipo tiene su **base** marcada en el mapa.
- **🎮 Modo manual:** en el ⚙️ de un soldado (o con el botón 🎮 durante la partida) lo manejás vos con un **joystick en pantalla** y botones (disparar, recargar, cambiar de arma, granada, botiquín); también con teclado (WASD, espacio, R, Q, G, H). Apunta solo al enemigo que ve; el resto son bots.
- **🎬 Repeticiones** (`js/replay.js`): al final, *Último tiro* y *Mejores momentos* (las jugadas más lindas: tiros lejanos, puñaladas, bajas seguidas, la baja final). Durante la partida, tocá la ficha de un caído para ver cómo murió. El final de la partida va en **cámara lenta** (se puede apagar en Ajustes).
- **Personalización:** gorro (🤠 vaquero, 👑 corona, 🎉 fiesta, 🎩 galera, 🎨 boina, 🎅 Papá Noel), **frases propias por soldado** y **foto opcional** del compañero (se recorta a un círculo de 96 px, queda solo en el celular y la app pide confirmar que esa persona está de acuerdo). La foto aparece en la ficha, sobre el soldado y en el podio.
- **🏟️ Torneo** (`js/tourney.js`): cuadro de eliminación directa con los soldados cargados, con "pasa" cuando sobra un lugar. Cada cruce es un duelo 1 contra 1 que se mira en vivo o se **simula** al instante. Termina con "🚪 *X* se va temprano". Los empates se resuelven con la moneda.
- **🎯 Apuestas:** cada compañero puede apostar a quién gana (⚙️ del soldado) o al campeón del torneo. Los aciertos suman a su marcador y hay un ranking semanal de **mejores apostadores**.
- **🏅 Logros e historial** (`js/hist.js`): 21 medallas (Ojo de lince, Carnicero, Intocable, Gallina, Ladrón de banderas…) y estadísticas por jugador (partidas, victorias, bajas, puntería, racha, torneos).
- **🪙 Moneda mejorada:** confeti, sonido de "tic" en cada giro, y 4 estilos de tirada (Clásica, Alta, Trompo y Loca).

### Novedades de la 0.9 — pulido y sentidos
- **🎵 Música que sube con la tensión** (`js/audio.js`): se arma en el momento con sintetizador (sin archivos). Arranca con un colchón suave y suma bombo, platillos, bajo, redoblante y una melodía nerviosa a medida que hay tiros cerca de la cámara, quedan pocos, se cierra la zona, hay muerte súbita o la bomba está por explotar. Tiene su propio volumen.
- **🔈 Sonido ubicado:** disparos, golpes, explosiones y vidrios suenan a la izquierda o a la derecha según dónde están en la pantalla, y más bajo si están lejos. **Pasos** distintos según el piso (normal, alfombra, metal, grava) cerca de la cámara.
- **🗣️ Voz opcional** (usa la voz del celular) para los insultos de los soldados que se ven y para el relator.
- **🎙️ Relator automático** (`js/narrator.js`): primera sangre, dobles y tripletes, rachas, tiros lejanos, puñaladas, venganzas, batacazos, “¡mano a mano!”, zona, muerte súbita, capturas, bomba y el final, con un cartel grande y sin repetirse.
- **Animaciones:** los soldados caen empujados por el último tiro y queda un charco; **casquillos** (y cartuchos rojos de escopeta) que saltan y quedan en el piso, el **cargador vacío** cae al recargar, **polvo** al correr y humo del caño.
- **♿ Accesibilidad** (en el menú): texto grande o enorme, **ayuda para daltonismo** (paleta segura y símbolos ● ▲ ■ ◆ por equipo), vibración on/off, **modo zurdo** (joystick a la derecha) y menos animaciones.
- **🔋 Rendimiento y batería:** calidad *Automática* (baja sola la resolución y los efectos si el celular no llega a 40 cuadros), *Alta* o *Ahorro* (30 cuadros por segundo, menos partículas, sin casquillos ni polvo, menor resolución). Medidor de cuadros opcional.
- **🎓 Práctica guiada:** 8 pasos con flechas en el mapa (caminar, disparar, recargar, agarrar un arma, cambiar de arma, tirar una granada, curarse y eliminar al muñeco de práctica). Aparece la primera vez que entrás a la batalla y desde ❓ Ayuda.
- **❓ Ayuda:** todo explicado por secciones (moneda, batalla, controles, modos, armas, torneo, sonido y consejos).

### Novedades de la 0.9.1 — cacería de errores
- **Probada en 9 pantallas emuladas** (celulares chicos de 320 px, iPhone SE, Galaxy S8, Pixel 5, iPhone grande, tablet, computadora y dos celulares acostados). Arreglos: el panel ⚙️ de cada soldado ya no se sale en pantallas angostas, la barra de controles entra en celulares de 360 px, con el celular acostado las fichas van a un costado y el mapa se ve más grande, y el joystick ya no tapa la pantalla del resultado.
- **Celulares lentos:** la calidad automática ahora sí baja sola (antes esperaba tiempo de juego, que en un celular lento casi no corre). Los objetos del piso se dibujan una vez y se copian, y no se dibuja lo que queda fuera de la pantalla: en un celular 3 veces más lento pasó de ~14 a ~45 cuadros por segundo.
- **IA:** los soldados que esperaban (emboscada, escuchando) ya no se quedan clavados cuando les cambia el plan o la zona los alcanza; no insisten con un objeto que no pueden agarrar ni con un ruido al que no se puede llegar; entre oleadas siguen juntando cosas. Soldados quietos sin motivo: menos del 3,5% del tiempo en todos los mapas y modos.
- **Justicia:** los soldados "piensan" en orden alternado (nadie reacciona siempre después que su rival) y qué equipo arranca en cada punta se sortea.
- **Balance** con 120 partidas por tabla: cada personalidad gana entre 8% y 19% (antes entre 0% y 21%); las inteligencias quedan escalonadas (Novato 8%, Normal 23%, Veterano 33%, Maestro 37%). En Bandera, si hay empate después de la prórroga desempatan las bajas.
- **Datos guardados:** ahora tienen versión y se revisan al abrir (sirven los de cualquier versión vieja; los valores raros se corrigen). Se arregló un error por el que los jugadores cambiaban de número al reabrir la app y las apuestas apuntaban a otro. Si los datos están dañados se arranca de cero guardando una copia, y si el celular se queda sin lugar (por ejemplo, por muchas fotos) avisa.
- **Límites:** 10 soldados en todos los modos y en mapas grandes; en partidas largas con reaparición los objetos viejos del piso desaparecen.
- **Errores:** si algo falla aparece un aviso; tocándolo (o desde ❓ Ayuda → 🐞) se copia la información del celular para mandármela.

### Novedades de la 0.9.2 — cuerpos de verdad
- **Esqueleto animado** (`js/rig.js`): piernas con muslo, rodilla y bota que siguen hacia dónde camina, cadera, torso que gira aparte, hombros y **brazos que se acomodan solos** (cinemática inversa) para agarrar cada arma; cabeza que mira hacia donde escucha; pelo largo y mochila que se balancean al girar.
- **Moverse:** caminar, correr (el arma baja y se cruza) y **sigilo agachado**; se agachan detrás de la cobertura y **se inclinan para asomarse** por la esquina.
- **Recargas por arma:** cargador (sacar, buscar en el cinturón, meter y tirar de la corredera), escopeta **cartucho por cartucho**, **cerrojo** del sniper, revólver con **cargador rápido** y ballesta que se **tensa**. Al cambiar de arma la nueva sube desde la funda.
- **Cuchillo:** estocada, corte en arco y **puñalada por la espalda**, con estela.
- **Granadas** por arriba (lejos) o **rodando** (cerca), abrir puertas con la mano, **agacharse a juntar** cosas, **botiquín** con las dos manos.
- **Reacciones:** sacudón según de dónde viene el tiro (más fuerte con escopeta o explosión), y **aturdido con estrellitas** tapándose la cara.
- **Muertes con física (muñeco de trapo):** el cuerpo sale despedido según el arma y la dirección del último golpe, choca con paredes, brazos y piernas quedan sueltos, y las explosiones lo hacen volar.
- **Detalles:** fogonazo distinto por arma (estrella en pistolas, tres puntas en automáticas, cono en escopetas, llamarada larga en el sniper, humito si tiene silenciador), **agujeros de bala** en paredes, puertas y cajones, polvo de pared y astillas, **manchas** donde pega el tiro y **pisadas rojas** si alguien pisa un charco.
- **Saltar cajones** en modo manual: empujá el joystick contra un cajón con lugar libre del otro lado.
- **Más liviano:** las armas y las cabezas se dibujan una vez y se copian.
- **🎬 Pasarela de animaciones:** tocá 5 veces el número de versión en el menú (o entrá con `#pasarela`) para ver las 40 animaciones por separado y en cámara lenta.

### Banco de pruebas
```sh
node tools/bench.js --runs 12    # simula cientos de partidas sin dibujar y genera un reporte
node tools/bench.js --modes --runs 6   # solo los modos de juego de la 0.7
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
