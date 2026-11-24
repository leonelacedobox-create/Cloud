# Ajuste por evolución (2026-11-23)

Partidas jugadas: unas 7904 (14 generaciones de 5 candidatos, cada uno con 64 partidas de personalidades y 40 de inteligencia; más la confirmación final con 312 partidas nuevas para el antes y otras tantas para el después).

Puntos medios: 100 = siempre gana, 0 = siempre sale último; parejo sería 50 para todas las personalidades.

## Personalidades

| Personalidad | aguante antes | aguante después | puntos antes | puntos después |
|---|---|---|---|---|
| agresivo | 0.8 | 0.65 | 50 | 53 |
| cauteloso | 1.06 | 1.276 | 51 | 46 |
| francotirador | 1 | 1.14 | 53 | 51 |
| asesino | 0.85 | 0.726 | 45 | 46 |
| tactico | 1 | 0.964 | 49 | 53 |
| oportunista | 1 | 1.096 | 56 | 53 |
| berserker | 0.85 | 0.756 | 48 | 49 |
| cobarde | 1.2 | 1.339 | 50 | 50 |

Desvío entre personalidades: antes 3 puntos, después 3.

## Inteligencia

| Nivel | puntería antes | puntería después | buscado | puntos antes | puntos después |
|---|---|---|---|---|---|
| Novato | 1.28 | 1.6 | 32 | 42 | 41 |
| Normal | 1 | 1.598 | 44 | 50 | 49 |
| Veterano | 0.93 | 0.813 | 52 | 50 | 49 |
| Maestro | 0.88 | 0.566 | 59 | 53 | 54 |
| Leyenda | 0.72 | 0.55 | 66 | 55 | 56 |

Partidas que no terminaron: antes 0, después 0.

## Qué se hizo con esto

- **Personalidades:** ya estaban parejas (todas entre 45 y 56 puntos) y el ajuste no logró emparejarlas más: las diferencias que quedan son del orden del azar. Se dejaron los valores originales.
- **Inteligencia:** la puntería sola casi no mueve el resultado (el ajuste la llevó a valores extremos sin lograr la escalera). Por eso se probaron escaleras completas (reflejos + puntería + esquive + rapidez para pensar) con `tools/iqgrid.js`, y se eligió la que deja cada nivel claramente arriba del anterior: ver `iqgrid.md`.
