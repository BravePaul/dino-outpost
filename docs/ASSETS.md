# Assets

Large binary assets (3D models, textures) are excluded from this repo to keep clone size manageable. They are all freely available CC0 / similar permissive licenses from upstream sources. Re-download them as below to make the scene fully render.

## What's missing from a fresh clone

- `public/assets/models/` (entire folder, ~450 MB) — GLB files for dinosaurs, plants, mountains, fence, props
- `public/assets/textures/` (entire folder, ~10 MB) — Poly Haven texture packs (ground)

## What's included

- `public/assets/hdris/blue_grotto_1k.hdr` — Poly Haven HDR skybox (kept because small + central to atmosphere)
- `public/reference-images/*.png` — visual reference targets used by `docs/VISUAL_REFERENCES.md`

## Sources

### Quaternius (CC0)

Download these packs from <https://quaternius.com/>:

| Pack | Local path expected | Used for |
|---|---|---|
| Animated Dinosaurs | `public/assets/models/quaternius/animated-dinosaur-bundle/` | All 6 enemy types |
| Stylized Nature Megakit | `public/assets/models/quaternius/stylized-nature-megakit/` | `Pine.glb` + variants for distant forest |
| Survival Pack | `public/assets/models/quaternius/survival-pack/` | Radio, Gas Can, Wood Log, First Aid Kit, Tent, Wooden Torch |
| Medieval Village Pack | `public/assets/models/quaternius/medieval-village-pack/` | `Fence.glb`, Barrel, Crate |
| Sci-Fi Modular Gun Pack | `public/assets/models/quaternius/sci-fi-modular-gun-pack/` | (Available but not currently wired; previous iterations tested it) |
| Ultimate Fantasy RTS | `public/assets/models/quaternius/ultimate-fantasy-rts/` | (Available but not currently wired) |

### Poly Haven (CC0)

Download from <https://polyhaven.com/> (3D Models tab):

| Asset | Local path expected | Used for |
|---|---|---|
| `mountainside` | `public/assets/models/polyhaven/dino-habitat/mountainside.glb` | Far ridge silhouettes |
| `rock_face_01` / `rock_face_02` | same folder | Distant rock features |
| `pachira_aquatica_01` | same folder | Mid-field trees |
| `calathea_orbifolia_01`, `anthurium_botany_01` | same folder | Decorative plants |
| `fern_02`, `shrub_02/03/04`, `grass_bermuda_01`, `moss_01` | same folder | Undergrowth |
| `boulder_01`, `rock_07`, `rock_09` | same folder | Rocks |
| `tree_stump_01`, `dead_tree_trunk`, `dry_branches_medium_01`, `single_root` | same folder | Forest debris |
| `modular_fort_01`, `modular_wooden_pier` | same folder | Outpost structures |
| `wooden_crate_01/02`, `machete`, `service_pistol` | `public/assets/models/polyhaven/game-upgrade/<asset>/` | Foreground props |
| `island_tree_02`, `coast_rocks_01`, `shrub_01`, `grass_medium_01/02` | same folder | Forest details |
| `brown_mud_leaves_01` texture pack | `public/assets/textures/polyhaven/dino-habitat/brown_mud_leaves_01/` | Ground material |

The Poly Haven 3D Models come bundled with PBR textures — keep the folder structure as listed.

## Quick start without assets

The code will still build and run, but the scene will look bare:

- Sky + ground material missing texture → magenta placeholders or solid colors
- No dinosaurs, no GLB plants, no fence → only procedural lollipop trees, lamps, water discs, lane guides, weapon
- HUD, gameplay logic, regression scripts all unaffected

Code-only readers can ignore the assets entirely. The repo is meant primarily as a showcase of AI-driven iteration on a browser game; `docs/OPTIMIZATION_LOG.md` documents every change.
