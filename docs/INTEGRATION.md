# Eclipse host glue is now a real compileable package.

## Build (verified)

```bash
# needs JDK 11+ on PATH (Temurin LTS via scoop: scoop install temurin-lts-jdk)
export PATH="$HOME/scoop/apps/temurin-lts-jdk/current/bin:$PATH"
bash eclipse/build.sh
# or: eclipse\build.bat
```

Produces:

- `eclipse/out/aetherscape-eclipse-glue.jar`
- runs `FakeBrowserHarness` → `ECLIPSE_GLUE_OK` + `eclipse/out/harness-log.txt`

## Layout

```
eclipse/
  build.sh / build.bat
  src/com/aetherhaven/eclipse/EclipseAetherScape3D.java
  src/com/aetherhaven/eclipse/jcef/CefBrowserAdapterNotes.java
  src/com/aetherhaven/eclipse/test/FakeBrowserHarness.java
  out/   (generated — gitignored)
```

## Wire real JCEF

Implement `EclipseAetherScape3D.JsBrowser` against your `CefBrowser` (see
`CefBrowserAdapterNotes`). Then:

```java
EclipseAetherScape3D game = new EclipseAetherScape3D(adapter);
game.open("https://mellowambience.github.io/aetherscape-3d/", false);
// hide → onHide(); show → onShow(); exit → onExit();
```

## Host API (JS)

`window.AetherScape3DHost`: pause/resume/tick/render/save/load/exportSave/
importSaveJson/setExternalLoop/dispose/state

## Assumptions

1. JCEF/CEF panel with own Chromium + GL.
2. Lifecycle events (not free per-frame JS inject) — default self-animating page.
3. three.js bundled in page — do not share Java GL with it.
