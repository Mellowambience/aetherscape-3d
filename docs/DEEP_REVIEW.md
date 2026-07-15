# Deep Review: Codex "RuneTek Eclipse" (untrusted)

Source: `Documents/Codex/2026-07-15/referenced-chatgpt-conversation-this-is-untrusted/outputs/runetek-eclipse`

Trust: **untrusted ChatGPT/Codex export**. Patterns only — never promote as Amara canon under that name/IP.

## Verdict

| Axis | Grade | Notes |
| --- | --- | --- |
| Architecture | **A-** | Clean intent → sim → events → view split. Fixed 20 Hz. Worth absorbing. |
| Simulation completeness | **B+** | Full gather/combat/craft/quest loop in one class; works, not modular. |
| Pathfinding | **B** | 4-dir A* + adjacent path + snap-to-walkable. Correct for OSRS-feel. |
| Persistence | **B** | Version flag, strip transients, shallow validator, export/import. |
| Rendering | **B+** | Ortho Three.js, shadows, pick, camera-relative WASD — true 3D OSRS camera. |
| Content/IP | **B** | Self-aware originality charter; title "RuneTek" still Jagex-adjacent risk. |
| Tests | **A-** | 16 tests; quest E2E + deterministic nav + pause. Gold standard for us. |
| Ship packaging | **C** | Multi-file npm (fine for eng); not single-file Eclipse drop-in. |
| Security | **N/A local** | Client-authoritative by design; no network. |

**Overall:** Best structural reference we have for a local 3D OSRS-feel slice. Absorb **engine patterns**, reject **names, map, dialogue, quest text, item IDs**.

## What to KEEP (patterns)

1. **Fixed tick + accumulator** (`FIXED_STEP_SECONDS = 1/20`) decoupled from rAF.
2. **Action queue** (`dispatch` → process at tick start) so input never mutates mid-system.
3. **Intent types** (`navigate | interact | attack | …`) instead of raw DOM in sim.
4. **Walk-to-interact** (`pendingInteraction` + `findAdjacentPath`).
5. **4-direction A\*** with `closestWalkable` and Manhattan heuristic.
6. **Camera-relative movement** (rotate WASD by `cameraAngle`).
7. **Stack inventory** with stack limits + capacity check before grant.
8. **XP curve** `level = floor(sqrt(xp / BASE)) + 1`.
9. **Timed gather task** on tick clock (interruptible by move).
10. **Save strips transients** (path, combat target, dialogue, active task).
11. **Quest E2E unit test** that teleports into range and asserts full loop.
12. **Ortho Three.js** + ground plane pick + entity userData pick.
13. **Dispose** on renderer (listeners, geometries, materials).

## What to REJECT / remint

| Codex | Reason | Aether remint |
| --- | --- | --- |
| RuneTek Eclipse (title) | Trademark/adjacency risk | **AetherScape 3D** |
| Starfall Vale / Cinderwatch / Aethra underweave | Their original setting | **Ley-Root Hollow / Emberfold / Aether** |
| Keeper Sova | Character IP | **The Curator** |
| Sunthread / Dawncord / Threadstone / Waylight | Item/station IP | **Glowreed / Leycord / Shrine Loom / Leyward** |
| Hollowmite / Miteplate Flake | Creature/loot IP | **Gloamtick / Shellshard** |
| Threadcraft skill | Skill name IP | **Attunement** (weave at loom) |
| Quest "A Light Against the Gloam" | Quest IP | **"Relight the Leyward"** |
| Save key `runetek-eclipse.save.v1` | Brand leak | `aetherscape-3d.save.v1` |
| Exact 32×24 river/path layout | Coordinate expression | New authored grid |
| Dialogue pages | Prose expression | Fresh Curator lines |

## Weaknesses (do better when absorbing)

1. **`seed` is dead** — combat uses `tick + id` hash, not a seeded PRNG. Add explicit `rng` for true replay.
2. **Shallow save validation** — only checks arrays/types exist. Validate item IDs, skill keys, quest stages.
3. **Monolithic `Simulation`** — quest + craft + combat hardcoded. Prefer data-driven quest stages + generic `craft` action.
4. **A\* open set is O(n) scan** — fine for 32×24; switch to binary heap if maps grow.
5. **Continuous position + tile walkability** — round-to-tile can wall-clip corners; keep for OSRS feel, document it.
6. **Enemy full A\* every 4 ticks** — scale risk; later use direct step or flow fields.
7. **No host bridge** — not Eclipse-ready. Add `AetherScape3DHost` (pause/resume/tick/render/save/load/dispose).
8. **No single-file ship path** — optional later drop-in build.
9. **Mutation of live state from tests** (`state.player.position = …`) — OK for harness, not for multiplayer later.
10. **Hardcoded craft action** `craft-dawncord` — use `craft { recipeId }`.

## Legal / trust notes

- Source is **untrusted** third-party LLM output under Codex folder name.
- Their MIT license applies to *their* tree only; we do **not** copy-paste source files.
- We re-implement patterns clean-room under Aether brand.
- Do not ship anything named RuneTek / Starfall / Sova / Hollowmite.

## Absorb status

Implemented in sibling project: `aether-garden-tex/aetherscape-3d/` (this directory).
