# Créditos y licencias

El código del juego es propio. Desde la 0.9.6 el juego usa material descargado, todo con licencias libres
que permiten usarlo y compartirlo. Acá está de dónde sale cada cosa.

## Sonidos (`assets/sfx/`)

Todos se limpiaron, recortaron, normalizaron y pasaron a MP3 mono con `tools/make_sounds.py`.
Los disparos y las explosiones tienen además una versión "de lejos" hecha a partir del mismo sonido.

| Archivos | Origen | Autor | Licencia |
|---|---|---|---|
| `g_pistol`, `g_auto`, `g_shotgun`, `g_heavy` (y sus `_far`), `pump`, `mag_out`, `mag_in`, `shell`, `swing`, `stab`, `punch`, `hit_metal`, `tink`, `boom`, `boom_far`, `boom_big`, `pain`, `death`, `death2`, `oof`, `pick_item`, `pick_gun`, `power`, `switch`, `radio` | [Freedoom](https://github.com/freedoom/freedoom) (`sounds/*.wav`) | Colaboradores del proyecto Freedoom | BSD de 3 cláusulas (ver `assets/sfx/LICENSE-freedoom.txt`) |
| `hit_flesh`, `hit_hard`, `land`, `step`, `revive`, `coin`, `ui` | Paquetes de sonido de [Kenney](https://kenney.nl) (Impact Sounds, Interface Sounds, RPG Audio, Digital Audio), descargados del paquete npm `@netforge/asset-library-files` | Kenney | CC0 1.0 (dominio público; ver `assets/sfx/CC0-1.0.txt`) |
| `swap` | [Kenney Starter Kit FPS](https://github.com/KenneyNL/Starter-Kit-FPS) (`sounds/weapon_change.ogg`) | Kenney | CC0 1.0 |

## Música

| Archivo | Tema | Autor | Licencia |
|---|---|---|---|
| `assets/sfx/music_battle.mp3` | "Battle Theme A" ([OpenGameArt](https://opengameart.org/content/battle-theme-a)), descargado del paquete npm `@netforge/asset-library-files` | cynicmusic | CC0 1.0 |

La música sintetizada (la otra opción) y los ambientes de cada mapa se arman en el momento con código propio.

## Muebles, objetos y autos (`assets/art/`, desde la 0.9.8)

Modelos 3D convertidos en dibujos vistos desde arriba con `tools/make_art.js` (luz, sombra y tamaño real).

| Dibujos | Origen | Autor | Licencia |
|---|---|---|---|
| Escritorios, sillas, sillones, mesas, plantas, estanterías, góndolas, cajones, barriles, cajas, tachos, máquinas, generador, carro, barreras, hidrante, aire acondicionado, cama, auto tapado y más | [Poly Haven](https://polyhaven.com/models) (modelos glTF: metal_office_desk, modern_arm_chair_01, Sofa_01, sofa_02, potted_plant_01/02, CoffeeTable_01, WetFloorSign_01, CoffeeCart_01, drawer_cabinet, Shelf_01, steel_frame_shelves_01/02/03, wooden_bookshelf_worn, CashRegister_01, wooden_display_shelves_01, cardboard_box_01, metal_trash_can, wooden_crate_01/02, Barrel_01/02, barrel_03, ammo_box, metal_tool_chest, industrial_pastic_container, metal_jerrycan, covered_car, concrete_road_barrier, fire_hydrant, exterior_aircon_unit, utility_box_01, old_tyre, modular_street_seating, wooden_picnic_table, plastic_monobloc_chair_01, drill_press_01, industrial_storage_cart, hand_truck, old_military_compressor, portable_generator, dining_table, WoodenTable_01, round_wooden_table_01, metal_stool_01, old_bed_frame, boulder_01, SchoolDesk_01) | Artistas de Poly Haven | CC0 1.0 |
| Autos (sedán, camioneta, taxi, patrullero, utilitario, deportivos, ambulancia) y conos | [Car Kit 3.1](https://opengameart.org/content/car-kit) (bajado de OpenGameArt) | Kenney | CC0 1.0 (`assets/art/LICENSE-kenney-carkit.txt`) |

## Texturas de pisos y paredes (`assets/tex/`, desde la 0.9.8)

Fotos reales de materiales de [Poly Haven](https://polyhaven.com/textures), CC0 1.0: laminate_floor, herringbone_parquet, wood_floor, floor_tiles_06, grey_tiles, dirty_carpet, concrete_floor_02, concrete_floor_worn_001, asphalt_02, metal_plate, gravel_floor, anti_skid_tiles, rubber_tiles, plastered_wall, brick_wall_02, concrete_block_wall y painted_plaster_wall (achicadas a 256 px).

## Tipografías (`assets/fonts/`)

| Archivo | Tipografía | Autor | Licencia |
|---|---|---|---|
| `black-ops-one.woff2` | Black Ops One (vía `@fontsource/black-ops-one`) | James Grieshaber (Sorkin Type) | SIL Open Font License 1.1 (`OFL-black-ops-one.txt`) |
| `cinzel-700.woff2` | Cinzel (vía `@fontsource/cinzel`) | Natanael Gama y The Cinzel Project Authors | SIL Open Font License 1.1 (`OFL-cinzel.txt`) |

## Íconos (`js/icons.js`)

Íconos de [game-icons.net](https://game-icons.net) (vía `@iconify-json/game-icons`), de Lorc, Delapouite y otros
colaboradores, con licencia [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Se usan: pistol-gun, revolver,
uzi, ak47, machine-gun, minigun, shotgun, sawed-off-shotgun, rifle, crossbow, bowie-knife, coinflip, crossed-pistols,
open-book, trophy, skull-crossed-bones, podium, medal, crown y grenade.

## Fotos de la moneda

Las caras de la moneda salen de las fotos que pasó el dueño del juego, retocadas para que parezcan acuñadas.
