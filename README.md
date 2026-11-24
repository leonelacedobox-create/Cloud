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

### Mapas (14 opciones)
- **Clásicos:** Laberinto, Habitaciones y Arena (ahora con cajones, barriles y ventanas).
- **Temáticos:** 🪖 **Base militar** (barracas con puertas, patio de grava, sacos de arena y búnkeres oscuros), 🏢 **Oficina** (escritorios, vidrios entre oficinas, alfombra que silencia los pasos, cocina y sala de reuniones con carteles), ⛓️ **Cárcel** (celdas con barrotes, torre de vigilancia, patio y celdas de castigo a oscuras) y 📦 **Depósito** (estantes largos formando pasillos, muelle de metal ruidoso, barriles y una oficina).
- **Nuevos de la 0.9.5:** Estación de tren, Supermercado, Estacionamiento, Fábrica (con cintas) y Oficina de noche, más el **Complejo** para equipos (0.9.4).
- **✏️ Propio:** dibujalo con el dedo en el **🖌️ Editor visual** o con texto (`#` pared, `.` piso, `D` puerta, `C` cajón, `B` barril, `W` ventana, `c` alfombra, `m` metal, `g` grava, `o` oscuro, `T` mesa, `L` lámpara, `> < v ^` cintas, `N` de noche) y el botón *Revisar* lo valida.
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

### Novedades de la 0.9.3 — Cerebros 2.0
- **Decide por puntajes** (`js/brain2.js`): con un enemigo a la vista cada soldado puntúa atacar, cubrirse, huir, flanquear y acercarse por la espalda según su vida, su miedo y furia, su arma, si lo están tirando, si el rival recarga o está herido, y su personalidad; con "inercia" para no cambiar de idea a cada rato.
- **Mapa táctico** que se arma al empezar: qué casilleros tapan y de qué lado, pasillos angostos y puertas (cuellos de botella), pasillos de tiro largos y cajones que se pueden saltar.
- **Mapa de peligro:** tiros, muertes y explosiones marcan zonas calientes que se van enfriando; los prudentes las evitan al explorar y los bravos van hacia el ruido.
- **Supresión:** las balas que pasan cerca asustan, bajan la puntería y empujan a cubrirse. Los tácticos y las ametralladoras **"aprietan"** con ráfagas donde se escondió el rival.
- **Mejor oído:** si oyen varias veces al mismo, **triangulan** su posición; reconocen el arma por el sonido, y los atrevidos **aprovechan cuando el rival recarga** (el asesino saca el cuchillo).
- **Memoria:** recuerdan dónde suele quedarse cada rival y van a revisar ahí.
- **Puntería humana:** al ver a alguien, el arma tarda en "llegar" y se va corrigiendo (más rápido cuanto más hábil y peor bajo fuego); **adelantan el tiro** a quien corre y los más hábiles controlan mejor el retroceso.
- **Jugadas propias:** el agresivo corre al que recarga, el cauteloso **apunta al pasillo o la puerta** por donde va a aparecer el rival y se esconde a recargar antes de quedarse seco, el táctico tira **humo y después flanquea**, el cobarde busca **el rincón más tapado** y el berserker siempre va al frente.
- **🦅 Nivel Leyenda** por encima de Maestro.
- **La IA también salta cajones** cuando le conviene para acortar camino.
- **🧠 Modo depuración** (Ajustes): sobre cada soldado se ve qué decidió y las barras de puntaje de cada opción, y en el mapa las zonas de peligro y los cuellos de botella.
- **Banco de pruebas** con una tabla nueva "Cerebro": tiempo de reacción, tiempo bajo supresión, recargas a la vista del rival, tiempo sin balas en pelea, saltos de cajón y en qué se reparten las decisiones.

### Novedades de la 0.9.4 — Escuadras
- **Líder y plan por equipo** (`js/squad.js`): el más táctico manda y elige **buscar** (sin alejarse del grupo), **atacar** o **defender**, según cuántos quedan y cuántos enemigos conocen entre todos. Se ve en pantalla (★ líder y plan).
- **Fuego y movimiento:** al atacar se turnan cada ~3 s: uno cubre (y aprieta con ráfagas si ve la zona) mientras el otro avanza un tramo.
- **Entrar a un cuarto en equipo:** si el camino al rival pasa por una puerta cerrada, se juntan a los costados, uno la abre y tira una aturdidora (o una granada) y entran todos.
- **Fuego cruzado:** al defender eligen un punto por donde va a pasar el rival y se ubican a distintos ángulos, bien tapados.
- **Avisos por radio** (globos sin ruido): "¡Recargando!", "¡Granada!", "¡Me cubro!", "¡Contacto!", "¡Me dieron!", "¡Te levanto!", "¡Al ataque!"…
- **Roles con habilidades:** el **médico** cura a los compañeros heridos y levanta más rápido; el **tanque** aguanta un 18% más pero es un poco más lento; nuevos **🔭 explorador** (más rápido, ve más lejos y **marca** a los enemigos para todo su equipo) y **🔧 ingeniero** (pone **minas** en pasillos y puertas). Opción de **roles automáticos** para los que no tienen rol.
- **Derribados** (opción en equipos): en vez de morir quedan en el piso, se arrastran hacia sus compañeros y tienen 28 s para que alguien los levante (el médico más rápido). Las balas perdidas les pasan por arriba y solo algunos "rematadores" los terminan. Un equipo con todos derribados pierde.
- **Órdenes en modo manual:** con 👣 📍 ⚔️ 🫂 les decís a tus bots que te sigan, cubran un lugar, ataquen o se agrupen.
- **Planes por modo:** en **Colina** se reparten alrededor mirando cada uno hacia afuera; en **Bomba** hay **dos sitios (A y B)**: los atacantes sortean a cuál van, los defensores se reparten y **rotan** cuando ven venir al de la bomba.
- **Mapa nuevo "Complejo":** seis edificios con varias entradas, calles con cobertura y los dos sitios de bomba en el medio.

### Novedades de la 0.9.5 — Mundo vivo y herramientas
- **Paredes finas y puertas que se rompen** (`js/world2.js`): a tiros una pared fina se **agujerea** (se ve y se dispara a través, pero no se pasa) y con explosivos se **derrumba** y queda un hueco con escombros. Las puertas se rompen a tiros o con explosiones. El mapa táctico de la IA se recalcula solo.
- **Herramientas** (salen en el botín con el equipo extra, y el ingeniero arranca con algunas): 🧨 **carga explosiva** (la IA la pone en la pared o puerta que la separa del rival, se aleja y entra por sorpresa), 💥 **mina**, 🪤 **trampa con alarma** (avisa y aturde al que la pisa), 📡 **sensor de movimiento** (marca a los que pasan cerca), 🛡️ **escudo portátil** (una placa que frena balas) y 🔭 **binoculares** (ven mucho más lejos mientras esperan quietos). En modo manual se usan con el botón 🧰.
- **Mesas que se dan vuelta:** si no hay cobertura cerca, la IA va hasta una mesa, la da vuelta y se tira atrás.
- **Noche y luz de verdad:** opción **🌙 De noche** (y el mapa *Oficina de noche*): solo se ve donde hay **lámparas** (con sombras que proyectan las paredes), linternas y **fogonazos**, que iluminan y delatan al que dispara. Las lámparas se rompen a los tiros.
- **Clima:** 🌧️ **lluvia** (tapa los sonidos y deja **barro** con las pisadas, con sonido de lluvia de fondo), ⛈️ **tormenta** (relámpagos que iluminan todo un instante y truenos), 🌫️ **niebla** más densa, o 🎲 al azar.
- **Mapas nuevos:** 🚉 **Estación de tren** (vagones con puertas y ventanas, andenes y vías de grava), 🛒 **Supermercado** (góndolas, cajas, depósito a oscuras y bar con mesas), 🅿️ **Estacionamiento**, 🏭 **Fábrica** con **cintas transportadoras** que te llevan y charcos de agua que frenan, y 🌙 **Oficina de noche**.
- **Eventos nuevos:** en el **apagón** aparece un **generador** que alguien puede prender para volver la luz, **inundación** de un sector (frena a todos), **helicóptero** con reflector que ilumina y delata, y **alarma de humo** que tapa los ruidos.
- **🖌️ Editor de mapas visual:** pintás con el dedo paredes, pisos, puertas, ventanas, cajones, barriles, mesas, lámparas, cintas (tocando otra vez giran) y zonas oscuras, con **pincel, rectángulo, relleno**, deshacer, zoom, noche, **partir de un mapa del juego**, revisión en vivo y hasta **6 mapas guardados**. Se sigue guardando como texto, así que lo podés copiar y pasarlo por mensaje.

### Novedades de la 0.9.6 — Sonido y presentación a lo grande
- **Sonidos reales** (`js/sfxbank.js`, `js/fx.js`): cada arma con su disparo **de cerca y de lejos** (de lejos suena sordo y con eco), **recargas por partes** (sacar y meter el cargador, cartucho por cartucho en la escopeta y el revólver, la bomba de la escopeta y el cerrojo del sniper), **casquillos** que suenan según el piso, **pasos** grabados, **impactos** distintos en carne, pared, madera y metal, **explosiones** con golpe grave y eco, **puertas**, **cuchillo**, **rebote de granadas**, **radio** de las escuadras, quejidos y gritos al morir con **la voz de cada soldado** (cada uno tiene su tono). Si un sonido no carga se usa el sintetizado de antes.
- **Eco según el lugar:** los pasillos y cuartos chicos retumban más que un patio abierto.
- **Ambiente por mapa** (`js/ambience.js`): aire acondicionado, teléfonos e impresora en la oficina; goteras, ecos y rejas en la cárcel; viento y chapas en el depósito; radio en la base; trenes y bocinas en la estación; heladeras y lector de códigos en el súper; prensas en la fábrica; autos en el estacionamiento; sirenas en el complejo; **grillos de noche**. Baja solo cuando hay tiroteo.
- **Música grabada:** “Battle Theme A” de cynicmusic (CC0), que se **abre y sube con la tensión** sin cortes. Se puede volver a la sintetizada en Ajustes.
- **Relator** con muchas más frases y más emoción en la voz según lo importante de la jugada.
- **Efectos:** humo de verdad (nubes que giran), **onda expansiva** en las explosiones, **luz de los disparos** también de día, **sacudón y viñeta roja** cuando le pegan al que seguís.
- **Cámara de cine:** **cartas de presentación** de cada soldado al empezar (foto, personalidad, inteligencia y rol; "VS" en equipos), **cámara del que te eliminó** con franjas de cine, y **resultado animado** (podio que sube, filas que entran).
- **Pantallas:** tipografías propias (**Black Ops One** para la batalla y **Cinzel** para la moneda), **íconos dibujados** de game-icons.net en el menú y en las fichas de los soldados (el arma que tienen en la mano), y la moneda ahora cae sobre una **mesa de madera** con su sonido.
- **Créditos** de todo lo descargado en `CREDITOS.md` (y resumidos en la Ayuda).

### Novedades de la 0.9.9 — Soldados de verdad
- **Armas realistas:** 9 armas dibujadas de perfil a partir de modelos 3D (Ultimate Gun Pack de Quaternius, CC0): pistola, revólver, subfusil, rifle tipo AK, ametralladora, ametralladora pesada, sniper con mira, escopeta y escopeta corta. Se ven así en la mano y tiradas en el piso.
- **Uniformes y equipo a la vista:** tela camuflada del color de cada uno (en equipos, del color del equipo con el color propio en el pecho), **chaleco táctico** con bolsillos para cargadores cuando lo tienen, **mochila grande** si juntaron una, casco, e **insignia del rol** en el hombro (médico, tirador, tanque, explorador, ingeniero, asalto).
- **Animaciones:** al esquivar se tiran al costado (antes solo temblaban).
- **Charcos con la lluvia** que van creciendo, con ondas de las gotas.
- **IA** (`js/brain4.js`): recuerda por dónde le aparece cada rival y vigila hacia ahí; si cae un compañero, los de al lado saben dónde está el que lo bajó y van a cobrársela. Se probaron también el fuego concentrado y adaptarse al marcador, pero en miles de partidas restaban y quedaron apagados. Contra la IA de la 0.9.8 queda prácticamente pareja (51% en 600 partidas, `tools/reports/ab099.md`): son comportamientos que se ven, pero no cambian los resultados de forma medible.

### Novedades de la 0.9.8 — Mundo de verdad
- **Pisos y paredes con texturas fotográficas** (Poly Haven, CC0): parquet, laminado, cerámica, alfombra, cemento, asfalto, chapa, grava, revoque, ladrillo y bloque. Cada mapa tiene sus materiales.
- **Sombras:** las paredes tiran sombra hacia abajo a la derecha (el sol viene de arriba a la izquierda) y los rincones se oscurecen.
- **Muebles, objetos y autos de verdad** (`js/world3.js`): 53 modelos 3D de Poly Haven y los autos del Car Kit de Kenney (CC0), convertidos en dibujos vistos desde arriba con luz y sombra (`tools/make_art.js`). Los cajones, barriles y mesas también usan dibujos realistas.
- **Mapas amueblados según el lugar:** escritorios con sillas, plantas, armarios y sillones en la oficina; góndolas de verdad en el súper; estanterías de metal en el depósito; autos en el estacionamiento y el complejo; camas y mesas en la cárcel; máquinas en la fábrica; bancos en la estación. Nunca tapan un camino.
- **Cobertura baja y alta:** escritorios, autos y sillones frenan balas pero se dispara por encima estando pegado; las estanterías tapan todo como una pared. La IA los usa para cubrirse.
- **Una sola inteligencia:** ya no se elige Novato/Normal/Veterano/Maestro/Leyenda; todos juegan con el mismo nivel alto y lo que cambia es la **personalidad** (forma de jugar).
- **IA nueva** (`js/brain3.js`): apunta antes a las esquinas y puertas mientras camina (si el rival aparece ahí reacciona el doble de rápido y con el arma casi en su lugar), revisa los costados al entrar a un cuarto, sostiene el ángulo cuando oye a alguien cerca en vez de ir a buscarlo, frena para disparar cuando el rival no lo está apuntando y elige mejor a quién tirarle (al que recarga, al que pelea con otro, al herido; no al que está detrás de un mueble). En 1000 duelos contra la IA de la 0.9.7 gana el 54% (`tools/reports/duels.md`).

### Novedades de la 0.9.7 — Afinado final
- **Miles de partidas en paralelo** (`tools/simpool.js`): varios navegadores sin ventana juegan a la vez, sin dibujar ni sonar. En total se jugaron más de 12.000 partidas para afinar esta versión.
- **Ajuste por evolución** (`tools/tune.js`): generaciones de candidatos con distinto aguante por personalidad y puntería por nivel, todos jugando las mismas partidas; se queda con el más parejo. Confirmó que las **personalidades ya estaban parejas** (todas entre 45 y 56 puntos sobre 100).
- **Escalera de inteligencia nueva** (`tools/iqgrid.js`): reflejos, puntería, esquive y rapidez para pensar ajustados juntos. Ahora cada nivel gana más que el de abajo: Novato 6% · Normal 15% · Veterano 21% · Maestro 27% · Leyenda 32% (antes el Veterano ganaba menos que el Normal).
- **Reporte por mapa y modo** (`tools/mass.js`, en `tools/reports/mass.md`): duración, partidas que no terminan, empates, trabas y qué equipo gana más en los 13 mapas y 9 modos.
- **Bomba pareja:** los atacantes ganaban 65% (87% en el Depósito). Ahora plantar tarda 5 s, desactivar 5 s, los defensores rotan antes y arrancan con casco: queda cerca de 50%.
- **Derribados:** ahora se levanta a 4 de cada 10 (antes 1 de cada 9). Ayudan también los que tienen un rival lejos del caído y se desangran en 34 s.
- **Cajones que se empujan:** caminando contra un cajón un ratito lo empujás (si atrás hay lugar); la IA, si no tiene dónde cubrirse, empuja uno hacia el rival y queda atrás.
- **Más rápido:** la línea de visión se calcula sin pasos repetidos (las simulaciones van 2,5 veces más rápido y la IA gasta menos en el celular); de noche los conos de linterna se recalculan solo si el soldado se mueve y la sombra se dibuja a media resolución en calidad media/ahorro; en celulares lentos cada soldado mira 30 veces por segundo en vez de 60. Con la CPU 4 veces más lenta, una partida de noche con tormenta pasó de ~34 a ~40 cuadros por segundo sin tener que bajar a ahorro.
- **Ayuda** al día (empujar cajones, cámara del que te eliminó, música y ambiente).

### Banco de pruebas
```sh
node tools/tune.js --gens 14      # ajuste por evolución del balance (personalidades e inteligencia)
node tools/iqgrid.js --games 300  # compara escaleras de inteligencia completas
node tools/mass.js --runs 15      # miles de partidas: todos los mapas × todos los modos
node tools/duels.js --games 1000  # duelos IA nueva contra la anterior (y cuánto aporta cada mejora)
node tools/abtest.js --games 500  # IA nueva contra la anterior en equipos y todos contra todos
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
