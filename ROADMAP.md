# Hoja de ruta — Moneda y Batalla

**Dónde estamos: 1.0 ✅ lanzada.** Lo que sigue: ideas para 1.x (abajo). (ver el plan nuevo más abajo). Moneda 3D con apuestas, series y "se va temprano". Batalla de hasta 10 soldados con mapas grandes y cámara, puertas, vista y oído, armas con munición, recarga y botín, 3 personalidades, equipos, tabla de victorias y versión en un solo archivo.

**Cómo trabajamos:** por cada versión (1) te cuento el plan, (2) lo programo, (3) lo pruebo con simulaciones y capturas, (4) lo subo y (5) te pregunto si seguimos con la próxima.

---

## 0.2 — "Cerebros" (la gran lista: IA, comportamiento y mejoras) ✅

> **Hecho.** Notas: en el punto 19 los compañeros se avisan por radio y acuden a ayudar, pero todavía no "escoltan" a un herido (queda para pulir en 0.9.1). El balance fino entre personalidades se revisa de nuevo en 0.9.1 con más partidas simuladas.

### A. IA de combate
1. **Cobertura:** se pegan a esquinas y paredes, asoman, disparan y vuelven a esconderse. Recargan escondidos.
2. **Recarga inteligente:** no recargan con un enemigo cerca. Si el cargador se vacía en pleno tiroteo, cambian a la pistola. Recargan al ganar distancia o al cortar la línea de visión.
3. **Retirada y curación:** con poca vida y mala arma huyen, buscan vida o escudo, o se esconden. No pelean 1 contra 2 si pueden evitarlo.
4. **Elección de objetivo:** eligen a quién disparar según la amenaza (quién les dispara, quién está más débil, quién trae el arma más peligrosa) y cambian de blanco si conviene.
5. **Esquivar:** se mueven de costado al recibir fuego, se tapan con una columna y evitan quedar en línea recta frente a un sniper.
6. **Oportunistas:** si oyen que dos pelean entre sí, esperan y entran cuando uno cae, para robar el botín y la baja.
7. **Flanqueo y emboscada con predicción:** anticipan hacia dónde va el enemigo según cómo se movía. Cortan camino y esperan detrás de una puerta o esquina por donde va a pasar.
8. **Búsqueda sistemática:** revisan los cuartos de a uno, se asoman por las puertas y recuerdan lo ya revisado y dónde había botín.
9. **Francotirador de verdad:** busca los pasillos más largos del mapa, se instala ahí y cambia de lugar después de disparar.
10. **Cuchillo asesino:** se acercan por la espalda, rodean al enemigo y evitan pelear de frente.
11. **Más trucos con puertas:** abrir de golpe, cerrar para cortar una persecución y esperar a un costado de la puerta.

### B. Personalidad y psicología
12. **Cinco personalidades nuevas** (en total 8): *Asesino* (sigilo y cuchillo), *Táctico* (coordina al equipo), *Oportunista*, *Berserker* (cuanto menos vida, más agresivo) y *Cobarde* (huye y se esconde).
13. **Estados de ánimo:** miedo (pierde puntería y duda), furia (más rápido pero descuidado) y confianza. Cambian según lo que pasa: matar, ser herido, quedarse solo.
14. **Nivel de inteligencia por soldado:** Novato, Normal, Veterano o Maestro, que se elige al armar la partida. Sirve para dar ventaja o desventaja entre compañeros.
15. **Errores humanos:** tiempo de reacción, puntería que empeora corriendo, pánico y olvidos de recargar.
16. **Más charla:** frases con contexto (provocaciones según el arma, reacciones al ser herido o al fallar). Las frases se pueden apagar y editar.

### C. Equipos
17. Se cubren entre sí, avanzan de a pares, rodean y se reagrupan. El líder da órdenes.
18. Se pasan munición y vida, y no disparan con un compañero en la línea de fuego.
19. Empiezan juntos en formación y no abandonan al herido.

### D. Armas y combate
20. **Balance con datos:** simulaciones por arma, por mapa y por personalidad.
21. Retroceso y dispersión más visibles, ráfagas más reales y un punto láser opcional al apuntar.
22. El sonido de cada arma cambia con la distancia (más sordo si está lejos).

### E. Juego y pantalla
23. **Ver por los ojos de un soldado:** solo se ve lo que él ve, para el modo suspenso.
24. **Estadísticas al final:** daño, puntería, bajas por arma, tiempo escondido, MVP y premios graciosos (el más cobarde, el más bocón).
25. **Panel previo a la partida:** ver y editar la personalidad y la inteligencia de cada soldado.
26. **Semilla de mapa:** repetir o compartir un mapa.
27. **Ajustes:** velocidad de partida, volumen por tipo de sonido y apagar los insultos.

### F. Calidad
28. **Banco de pruebas automático** (las simulaciones que ya uso) con reporte: duración, bajas por arma, tácticas usadas, empates y trabas.
29. **Detector de soldados trabados** y de bucles de la IA, con sus arreglos.

---

## 0.5 — "Más cosas para hacer" (objetos, mapas y ambiente) ✅

> **Hecho.** Notas: el editor de mapas es por texto (el editor visual queda para 1.x). Se agregó una ☠️ muerte súbita para evitar partidas estancadas. El balance fino con todo el equipo nuevo se revisa de nuevo en 0.9.1.
- **Granadas:** de fragmentación, de humo (tapa la vista) y aturdidora. La IA las usa (lanza por esquinas y puertas) y huye de ellas.
- **Protección:** chaleco, casco, botiquines de varios tamaños y mochila con más munición.
- **Accesorios:** silenciador, mira y cargador extendido.
- **Armas nuevas:** subfusil, rifle de asalto, revólver y ballesta silenciosa.
- **Mapas con cobertura:** cajones bajos (frenan balas pero no la vista), barriles explosivos, ventanas (se ve y se dispara pero no se pasa), vidrios que se rompen con ruido y zonas oscuras con linterna.
- **Mapas temáticos:** base militar, **oficina** (con los compañeros de trabajo), cárcel y depósito. Editor de mapas simple.
- **Eventos del mapa:** apagón, alarma y caída de suministros que avisa con sonido y hace que todos corran hacia ahí.
- **Superficies:** pisos que hacen más o menos ruido, y niebla.
- **IA nueva:** usa cajones como cobertura, cruza con humo, escucha las caídas de suministros y evita los barriles.

---

## 0.7 — "Modos de juego y diversión con los compañeros" ✅

> **Hecho.** Notas: el torneo es de duelos 1 contra 1 (se miran en vivo o se simulan); los apodos se resuelven con el nombre de cada soldado y las frases propias son por soldado; las repeticiones guardan solo las jugadas importantes (no toda la partida). El balance fino de los modos (bandera y bomba dependen mucho del mapa) y las pruebas en celulares reales quedan para 0.9.1.
- **Torneo** por rondas con cuadro de eliminatorias, para decidir "quién se va temprano".
- **Apostar por un soldado** antes de la batalla (conectado con la moneda) y ranking semanal de aciertos.
- **Modos nuevos:** capturar la bandera, rey de la colina, objetivo/bomba, oleadas contra bots, carrera de botín y "solo cuchillos".
- **Equipos avanzados:** roles, bases y reaparición opcional.
- **Modo manual:** controlás a tu soldado con un joystick en pantalla y el resto son bots.
- **Personalización:** gorros, apodos, frases propias y, si quieren, la **foto de cada compañero** como avatar (solo con su permiso).
- **Cámara:** repetición de las muertes, cámara lenta del final y "mejores momentos".
- **Logros e historial** por jugador.
- **La moneda mejorada:** más animaciones, más sonidos y un desempate con moneda dentro de la batalla.

---

## 0.9 — "Pulido y sentidos" ✅

> **Hecho.** Notas: la música es sintetizada (no hay archivos de audio) y la voz depende de que el celular tenga voces en español. Las armas siguen siendo las redibujadas de la 0.5 (no mandaste modelos para descargar). La calidad automática y el modo ahorro se probaron en la computadora; la medición en celulares viejos de verdad queda para 0.9.1.
- **Sonido:** música que sube con la tensión, sonido ubicado según la cámara, voz opcional para los insultos y pasos distintos según el piso.
- **Animaciones:** caminar, correr y recargar más detallados, muertes más expresivas, humo del cañón, casquillos y polvo.
- **Narrador automático** con frases de relator.
- **Armas:** las que elijas descargar (si querés) o una nueva ronda de mejoras al dibujo.
- **Accesibilidad:** texto más grande, ayuda para daltonismo, modo claro/oscuro afinado, vibración opcional y modo zurdo.
- **Rendimiento y batería:** 60 cuadros por segundo estables en celulares viejos y modo ahorro.
- **Tutorial interactivo** y pantalla de ayuda.

---

## 0.9.1 — "Cacería de errores" ✅

> **Hecho.** Notas: las pruebas en celulares se hicieron **emulados** (pantallas, horizontal, tablet y CPU 3 a 8 veces más lenta); falta que lo pruebes en tu celular de verdad: si algo anda mal, en ❓ Ayuda → 🐞 se copia la información para mandármela. Los textos se revisaron a mano (no hay corrector ortográfico instalado).
- Pruebas en **celulares reales** (Android y iPhone, distintas pantallas, vertical y horizontal).
- Arreglo de trabas y bucles de la IA, soldados dormidos y casos raros con puertas.
- Balance final con cientos de partidas simuladas por configuración.
- Pruebas de datos guardados (que las versiones viejas no se rompan) y de límites (10 soldados, partidas largas).
- Revisión de textos y ortografía.

## Plan nuevo hasta la 1.0 (pedido después de la 0.9.1)

Antes de publicar, seis versiones grandes de mejoras: cuerpos y animaciones, inteligencia, estrategia en equipo, un mundo con más herramientas, sonido y presentación de verdad (con material descargado de licencia libre) y un afinado final. La publicación queda para la 1.0.

**Sobre las descargas:** desde este entorno puedo bajar de **GitHub** (repositorios públicos) y de los registros de paquetes (npm, PyPI). Los sitios de material directos (Kenney, OpenGameArt, Freesound) están bloqueados acá, pero muchos de sus paquetes **CC0** (uso libre, sin pedir permiso) están copiados en GitHub. Solo uso material **CC0 o CC-BY** (este último con crédito en la app), reviso la licencia de cada archivo y lo anoto en `CREDITOS.md`. Si algo que vale la pena solo está en un sitio bloqueado, te pido permiso para abrir ese sitio en la configuración.

---

## 0.9.2 — "Cuerpos de verdad" (animaciones y física de los cuerpos) ✅

> **Hecho.** Notas: el salto de cajones es solo para el soldado que manejás (la IA sigue rodeándolos; se suma en 0.9.3 con el mapa táctico). El "esquive" con cuchillo se ve como un tambaleo rápido. Para el dibujo no hizo falta descargar nada: los sonidos reales van en 0.9.6.
1. **Esqueleto 2D por soldado:** cadera, torso que gira por separado de las piernas, hombros, codos y manos que se calculan solas (cinemática inversa) para agarrar cada arma con una o dos manos, cabeza que mira hacia donde escucha.
2. **Caminar, correr, agacharse y caminar en sigilo** con ciclos distintos (pasos más largos al correr, cuerpo bajo y lento en sigilo), y frenadas y arranques con inercia.
3. **Asomarse de verdad:** inclinación del cuerpo al asomarse por una esquina y al volver a cubrirse.
4. **Recargas coreografiadas por arma:** sacar y meter el cargador, escopeta cartucho por cartucho, revólver con cargador rápido, ballesta tensada, sniper con cerrojo; y cambio de arma (enfundar y desenfundar).
5. **Cuchillo:** varios golpes (estocada, corte, apuñalada por la espalda) y esquive.
6. **Reacciones al daño:** sacudón según de dónde viene el tiro, tambaleo, retroceso por escopetazo, aturdido por explosión con estrellitas, cubrirse la cara con la aturdidora.
7. **Muertes con física (muñeco de trapo liviano):** el cuerpo cae según la fuerza y la dirección del golpe, choca con paredes y cajones, brazos y piernas que quedan sueltos; vuelos por explosiones.
8. **Detalles:** pelo y mochila que se balancean, mangas, sombra que acompaña, fogonazo con forma por arma, trazadoras, agujeros de bala en paredes y puertas, manchas y pisadas en charcos y barro, chispas en metal, astillas en madera.
9. **Animaciones de interacción:** abrir y cerrar puertas con la mano y el hombro, saltar sobre cajones bajos, juntar objetos agachándose, tirar granadas por arriba o rodando.
10. **Herramienta de prueba:** una pantalla oculta de "pasarela" para ver cada animación por separado y en cámara lenta.

## 0.9.3 — "Cerebros 2.0" (inteligencia individual) ✅

> **Hecho.** Notas: la decisión por puntajes se usa cuando hay un enemigo a la vista (el resto de las decisiones siguen el orden de prioridades de la 0.2, ahora con peligro, memoria y jugadas propias). La aturdidora antes de entrar a un cuarto queda para 0.9.4 (entrada en equipo).
1. **Decisión por utilidad:** cada medio segundo el soldado puntúa todas sus opciones (pelear, cubrirse, flanquear, curarse, buscar armas, emboscar, huir, ir al objetivo) según la situación y su personalidad, con "inercia" para no cambiar de idea a cada rato. Se puede ver qué piensa con un modo de depuración.
2. **Mapa táctico precalculado:** puntos de cobertura (y desde dónde cubren), esquinas para asomarse, pasillos de tiro largos, cuellos de botella y zonas peligrosas. Se arma al empezar cada partida.
3. **Mapa de peligro vivo:** dónde hubo tiros, muertes y granadas en los últimos segundos; lo evitan o lo atacan según la personalidad.
4. **Supresión:** el fuego cercano baja la puntería y empuja a cubrirse; las ametralladoras sirven para "apretar" al rival mientras otro avanza.
5. **Mejor oído:** triangular de dónde vienen los disparos oyendo varias veces, distinguir el arma por el sonido y saber si un rival está recargando para atacar en ese momento.
6. **Memoria y aprendizaje dentro de la partida:** recordar dónde suele esconderse cada rival, por dónde llegó la última vez y dónde quedó el botín; cebos (hacer ruido de un lado y atacar del otro).
7. **Puntería más humana:** el arma va "llegando" al blanco, se corrige tiro a tiro, controla el retroceso según la inteligencia y dispara a donde el rival va a estar.
8. **Uso de todo el equipo:** granadas para sacar a alguien de una cobertura, humo para cruzar, aturdidora antes de entrar a un cuarto, botiquines en el momento justo, cambiar de arma según la distancia.
9. **Personalidades más marcadas** (cada una con 2 o 3 jugadas propias) y **nivel Leyenda** por encima de Maestro.
10. **Banco de pruebas nuevo** que mide decisiones, tiempos de reacción, supresión, uso de cobertura y "errores tontos" (pararse a la vista, quedarse sin balas en el peor momento).

## 0.9.4 — "Escuadras" (estrategia en equipo) ✅

> **Hecho.** Notas: en peleas parejas los derribados a menudo caen antes de que los levanten (en las simulaciones se levanta aproximadamente 1 de cada 9); se ajusta en 0.9.7. La Bandera ya tenía escolta y recuperación desde la 0.7; las minas solo las pone el ingeniero (las trampas y el resto de las herramientas van en 0.9.5).
1. **Fuego y movimiento:** uno cubre disparando mientras el compañero avanza, y se van turnando.
2. **Entrar a un cuarto en equipo:** se juntan a los lados de la puerta, uno tira la aturdidora, entran y cada uno revisa un lado.
3. **Fuego cruzado y emboscadas en equipo:** se reparten esquinas para que el rival quede entre dos.
4. **Roles con habilidades:** el médico cura a los compañeros, el tanque va adelante y aguanta, el tirador cubre desde atrás, el de asalto entra primero; además **explorador** (más rápido y marca enemigos) e **ingeniero** (pone minas y trampas).
5. **Derribados y reanimación** (opcional en equipos): con poca vida quedan en el piso arrastrándose y un compañero los puede levantar mientras otros lo cubren.
6. **Líder y órdenes:** el táctico decide el plan del equipo (atacar, defender, flanquear por la izquierda, esperar) y se ve en pantalla.
7. **Comunicación:** marcan enemigos para todo el equipo, avisan "recargando", "granada" o "me cubro", y se cuidan las espaldas.
8. **En modo manual, das órdenes** a tus compañeros bots con botones (seguime, cubrí esta zona, atacá, agrupense).
9. **Planes por modo:** en Bandera escoltan al que la lleva y van a buscarla; en Bomba los defensores rotan entre sitios; en Colina se reparten las entradas.
10. **Nuevo mapa por equipos** pensado para esto (dos sitios de bomba, edificios con varias entradas) y **Bomba con 2 sitios**.

## 0.9.5 — "Mundo vivo y herramientas" ✅

> **Hecho.** Todo en `js/world2.js` (más `js/editor.js` para el editor visual). Notas: los **cajones que se empujan** quedaron afuera (las mesas que se dan vuelta sí están); se evalúan en 0.9.7. Las linternas con cono ya venían de antes y ahora conviven con lámparas con sombras, fogonazos, relámpagos y el reflector del helicóptero. Las herramientas son poco comunes en el botín a propósito (el ingeniero arranca con carga, trampa y sensor). Con todo lo nuevo, el rendimiento en celulares lentos queda igual que en los mapas viejos (la calidad automática baja sola).
1. **Paredes finas y puertas que se rompen** con explosivos o a tiros; agujeros por los que se puede ver y disparar.
2. **Herramientas nuevas:** carga explosiva para abrir paredes, minas, trampas de alambre con alarma, sensor de movimiento, escudo portátil y binoculares. La IA las usa con criterio.
3. **Coberturas que se mueven:** mesas que se dan vuelta para cubrirse, cajones que se empujan.
4. **Luz y oscuridad de verdad:** sombras que proyectan las paredes, linternas con cono de luz, fogonazos que iluminan, partidas de noche y lámparas que se pueden romper.
5. **Clima:** lluvia (tapa los sonidos y hace barro con pisadas), niebla más densa, tormenta con relámpagos que iluminan todo un instante.
6. **Mapas nuevos:** estación de tren, supermercado, estacionamiento, fábrica con cintas transportadoras, y la oficina en versión "fin de semana" a oscuras.
7. **Editor de mapas visual** (dibujar con el dedo paredes, puertas y objetos) en lugar del de texto.
8. **Eventos nuevos:** apagón con generador para volver a prender, inundación de un sector, helicóptero que ilumina y alarma de humo.

## 0.9.6 — "Sonido y presentación a lo grande" ✅

> **Hecho.** Notas: los sitios grandes de sonidos libres (freesound, opengameart, kenney.nl) no se pueden descargar desde acá, así que los sonidos salen de **Freedoom** (BSD) y de paquetes de **Kenney** (CC0) que están en GitHub y npm; los de Freedoom son de 8 bits y se limpiaron. Las voces son quejidos y gritos (las frases siguen saliendo con la voz del celular). La "cámara de la muerte" sigue al que te eliminó (no es en primera persona: el juego es visto desde arriba). Las pantallas se mejoraron con tipografía, íconos, la mesa de la moneda, las cartas y el resultado animado, sin rehacer todo el diseño. Todo lo descargado está en `CREDITOS.md`.
1. **Sonidos reales descargados** (licencia libre): cada arma con disparo cercano y lejano, recargas, casquillos cayendo según el piso, pasos por superficie, impactos en carne, metal, madera y vidrio, explosiones con eco, puertas, vidrios.
2. **Ambiente por mapa** (oficina con aire acondicionado y teléfonos, cárcel con ecos, depósito con viento y chapas, base militar con radio) y **eco según el lugar** (pasillos y cuartos grandes).
3. **Música mejor:** temas de licencia libre o compuestos para el juego, que cambian de intensidad sin cortes.
4. **Voces:** gritos, quejidos y frases grabadas o sintetizadas mejor, y el relator con más frases y emoción.
5. **Efectos visuales:** luz de los disparos, humo de verdad, explosiones con onda de choque, partículas mejores, sacudón y "golpe" de cámara al recibir daño.
6. **Cámara de cine:** cámara de la muerte (desde los ojos del que te eliminó), presentación de los soldados al empezar (cartas con foto, personalidad y arma) y final con resumen animado.
7. **Pantallas rediseñadas:** menú, armado de partida y resultado más lindos, con iconos e ilustraciones (descargados de licencia libre o dibujados) y tipografía propia.
8. **La moneda** con sonidos reales de moneda y una mesa donde cae.

## 0.9.7 — "Afinado final" ✅

> **Hecho.** Más de 12.000 partidas simuladas (reportes en `tools/reports/`). Notas: el ajuste por evolución confirmó que las personalidades ya estaban parejas, así que no se cambiaron; la escalera de inteligencia se rehízo con reflejos, puntería, esquive y rapidez para pensar juntos. Bomba quedó pareja y los derribados se levantan bastante más. En Oleadas los compañeros sobreviven a las 5 oleadas un tercio de las veces (se dejó así: es un desafío). En Bandera, en el Laberinto y en Habitaciones apareció una ventaja de un equipo con pocas partidas (15): puede ser azar del mapa, queda para mirar. El punto 4 (pruebas en tu celular) queda abierto: cuando me mandes lo que copia el botón 🐞 lo arreglo.
1. **Ajuste automático por evolución:** el banco de pruebas prueba miles de combinaciones de parámetros y se queda con las que dejan parejas a las personalidades, a los equipos y a los modos.
2. **Miles de partidas** por mapa y modo: duración, trabas, empates y ventajas.
3. **Rendimiento con todo lo nuevo:** que siga andando fluido en celulares viejos (dibujar a caché, menos cálculos de IA por cuadro, calidad automática afinada).
4. **Pruebas en tu celular:** me mandás lo que copia el botón 🐞 y lo arreglo.
5. **Revisión de textos, ayuda y práctica guiada** actualizadas con todo lo nuevo.

---

## 0.9.8 — "Mundo de verdad" (aspecto + IA) ✅

> **Hecho.** Texturas fotográficas, sombras, 53 modelos 3D de Poly Haven y los autos del Car Kit de Kenney (todo CC0) convertidos en dibujos vistos desde arriba, mapas amueblados según el lugar, cobertura baja y alta, una sola inteligencia para todos y una IA nueva que mira las esquinas, revisa los cuartos, sostiene ángulos y elige mejor a quién disparar. Notas: la IA nueva le gana a la anterior el 54% de 1000 duelos (en equipos y todos contra todos la diferencia es menor, cerca de 50–53%): es una mejora real pero moderada, y el trabajo fuerte de IA sigue en la 0.9.9. Los mapas no se rediseñaron de cero: se amueblan sobre el trazado de antes. Kenney no permite descargas automáticas desde su sitio; el Car Kit se bajó de OpenGameArt, donde Kenney lo publica.

## 0.9.9 — "Soldados de verdad" (aspecto + IA) ✅

> **Hecho.** Armas realistas (Quaternius, CC0), uniformes camuflados, chaleco táctico, mochila, insignias de rol, rodada al esquivar, charcos con lluvia; IA que recuerda por dónde viene cada rival y cobra las bajas de los compañeros. Notas honestas: contra la IA de la 0.9.8 la diferencia está dentro del margen de error (51% en 600 partidas); el fuego concentrado y adaptarse al marcador se probaron y restaban, así que se apagaron. No se hicieron: la distribución nueva de oficinas y súper (siguen amuebladas sobre el trazado de antes), "asomarse/agacharse" nuevos (ya existían de la 0.9.2) ni personalidades con un plan de partida propio.
**Aspecto:** personajes con más detalle (uniforme por equipo y rol, el equipo que llevan a la vista: casco, chaleco, mochila), armas dibujadas a partir de modelos reales, animaciones nuevas (agacharse detrás de la cobertura, asomarse, rodar, caer al recibir un golpe fuerte), charcos con lluvia, marcas y escombros más realistas, y oficinas y súper con distribución más real.
**IA:** aprende de cada rival durante la partida (por dónde suele venir, si recarga a la vista), personalidades más marcadas y humanas (plan de partida, miedo, venganza, cambio de estrategia si va perdiendo), equipos más coordinados (pinzas, cada uno cubre un ángulo, avanzar de a turnos), y la prueba de miles de partidas contra la IA de la 0.9.8.

## 1.0 — "Lanzamiento" ✅

> **Hecho.** Cuartos amueblados según lo que son (oficina y súper), pantalla Acerca de con créditos y licencias, botón para instalar como app, versión para PC (menús en columnas, mouse, atajos), archivo único en `descargas/` y pruebas finales sin alertas. Nota: publicar con GitHub Pages lo tiene que activar el dueño del repositorio en Settings → Pages (los pasos están en el README); desde acá no se puede cambiar esa opción.

### Lo que estaba planeado para la 1.0
- Publicación en una dirección web fija (GitHub Pages u otra), instalable como app y con funcionamiento sin conexión.
- Nombre e ícono finales, licencia y **créditos** (incluye el material descargado).
- Versión de archivo único actualizada para mandar por WhatsApp.
- Versión estable con tutorial, tabla de victorias del grupo y documentación.

## Más adelante (1.x, ideas)
- **Multijugador en el mismo wifi:** cada uno desde su celular, y uno hace de pantalla.
- Controlar a tu soldado en tiempo real contra los de tus compañeros.
- Modo campaña.
- Armas y personalidades editables.
- Estadísticas del grupo a lo largo de los meses.
