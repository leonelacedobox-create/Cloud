# Hoja de ruta — Moneda y Batalla

**Dónde estamos: 0.9 ✅ terminada** (0.2, 0.5, 0.7 y 0.9 están hechas). Moneda 3D con apuestas, series y "se va temprano". Batalla de hasta 10 soldados con mapas grandes y cámara, puertas, vista y oído, armas con munición, recarga y botín, 3 personalidades, equipos, tabla de victorias y versión en un solo archivo.

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

## 0.9.1 — "Cacería de errores"
- Pruebas en **celulares reales** (Android y iPhone, distintas pantallas, vertical y horizontal).
- Arreglo de trabas y bucles de la IA, soldados dormidos y casos raros con puertas.
- Balance final con cientos de partidas simuladas por configuración.
- Pruebas de datos guardados (que las versiones viejas no se rompan) y de límites (10 soldados, partidas largas).
- Revisión de textos y ortografía.

## 0.9.2 — "Listo para compartir"
- Publicación en una dirección web fija (GitHub Pages u otra), instalable como app y con funcionamiento sin conexión.
- Nombre e ícono finales, licencia y créditos.
- Versión de archivo único actualizada para mandar por WhatsApp.

---

## 1.0 — "Lanzamiento"
Versión estable, publicada, instalable, con tutorial, tabla de victorias del grupo y documentación.

## Más adelante (1.x, ideas)
- **Multijugador en el mismo wifi:** cada uno desde su celular, y uno hace de pantalla.
- Controlar a tu soldado en tiempo real contra los de tus compañeros.
- Editor de mapas visual.
- Modo campaña.
- Armas y personalidades editables.
- Estadísticas del grupo a lo largo de los meses.
