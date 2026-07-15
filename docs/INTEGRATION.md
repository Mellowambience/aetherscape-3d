# AetherScape 3D ↔ RunTek Eclipse integration

## Status

Playable local 3D vertical slice with evolved systems + host bridge.
Java glue is **reference source** (not compiled here — no JDK in agent env).

## Files

| Path | Role |
| --- | --- |
| `src/main.ts` | `window.AetherScape3DHost` bridge |
| `eclipse/EclipseAetherScape3D.java` | JCEF lifecycle wrapper |
| `dist/` | Production static site after `npm run build` |

## Assumptions (confirm for your Eclipse shell)

1. **A1 — JCEF/CEF panel** with its own Chromium + GL context.
2. **A2 — Lifecycle events**, not a free per-frame JS inject. Default: page self-animates with rAF; you only `pause`/`resume`/`save`/`dispose` on hide/show/exit.
3. **A3 — three.js is bundled in the page.** Do not share a Java GL context.

If your host *does* have a shared frame pump, open with `externalLoop=1` and call `tick(dt)` + `render()` each frame.

## Host API (`window.AetherScape3DHost`)

| Method | Purpose |
| --- | --- |
| `pause()` / `resume()` | Freeze / unfreeze sim |
| `tick(dtSeconds)` | Host-driven sim step (external loop) |
| `render()` | Paint current state |
| `save()` / `load()` | localStorage slot |
| `exportSave()` / `importSaveJson(raw)` | JSON snapshot |
| `setExternalLoop(bool)` | Stop/start internal rAF |
| `dispose()` | Teardown + save |
| `state()` | `{ tick, dayPhase, questStage, health, skills, ... }` |

## Recommended Eclipse wiring

```java
// Pseudocode
EclipseAetherScape3D game = new EclipseAetherScape3D(cefBrowser);

// Prefer built dist for shipping, vite preview for dev:
game.open("http://127.0.0.1:4174/", /* externalLoop */ false);
// or: game.open("file:///C:/Users/nator/aether-garden-tex/aetherscape-3d/dist/index.html");

// On panel hide:
game.onHide();   // save + pause

// On panel show:
game.onShow();   // resume

// On leave game state:
game.onExit();   // dispose
```

## Local commands

```bash
cd aetherscape-3d
npm install
npm test
npm run build
npm run preview   # http://127.0.0.1:4174/
```

## Evolved gameplay (v0.2)

- **Crystal Mining** skill + ley-crystal nodes (north ridge)
- **Ward Charm** recipe (shellshard + raw-crystal) → temporary damage reduction
- **Bank chest** (storehouse) deposit/withdraw all
- **Day/night** cycle (~30s / ~20s at 20 Hz); night aggro/damage up
- 3 Gloamticks; richer Curator dialogue after quest

## Caveats

- Java glue uncompiled — paste into Eclipse module and adapt `JsBrowser` to your CEF types.
- `file://` may block ES modules depending on CEF flags; prefer `http://127.0.0.1` or custom scheme.
- Client-authoritative local slice — not multiplayer-safe.
