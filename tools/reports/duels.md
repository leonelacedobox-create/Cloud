# Duelos 1 contra 1: IA de la 0.9.8 contra la de la 0.9.7 (2026-11-24)

Misma personalidad en los dos lados, mapas chicos, 2 vidas, cambiando de lado. Margen de error ~±2%.

## Cuánto aporta cada mejora (500 duelos por fila)

| Variante | gana la IA nueva |
|---|---|
| Todo prendido | 52% |
| Sin apuntar antes a las esquinas | 45% |
| Sin sostener el ángulo | 52% |
| Sin frenar para disparar | 49% |
| Sin elegir mejor a quién dispararle | 50% |
| Sin revisar los costados al entrar | 53% |
| Sin salir de la puerta en un tiroteo | 55% → esta mejora restaba: quedó apagada |

## Resultado final (1000 duelos por fila)

| Variante | gana la IA nueva |
|---|---|
| IA nueva completa | **54%** |
| Control (todas las mejoras apagadas: las dos IA iguales) | 48% |

Lo que más pesa es apuntar antes a las esquinas: si el rival aparece donde ya estaba apuntando, reacciona en menos de la mitad de tiempo y arranca con el arma casi en su lugar.
