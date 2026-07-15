package com.aetherhaven.eclipse;

/**
 * RunTek Eclipse / JCEF host glue for AetherScape 3D.
 *
 * Assumptions (flagged — confirm against your real Eclipse shell):
 *   A1 — Host embeds a Chromium panel (JCEF / CEF) with its own GL context.
 *   A2 — Lifecycle is event-driven (open / hide / show / exit), NOT a cheap per-frame JS inject.
 *         Prefer letting the page self-animate (default). Optional externalLoop=1 + tick/render
 *         only if your shell has a shared frame pump that can call executeJavaScript cheaply.
 *   A3 — three.js is bundled in the page; do NOT share a Java-side GL context with it.
 *
 * Wire your real CefBrowser via {@link JsBrowser} (see jcef/CefBrowserAdapter.java).
 * Compile: {@code eclipse/build.bat} or {@code eclipse/build.sh}
 */
public final class EclipseAetherScape3D {

    /** Replace with your real JCEF browser handle via an adapter. */
    public interface JsBrowser {
        void loadURL(String url);

        void executeJavaScript(String code, String url, int line);

        /**
         * Optional: evaluate and return a string result if your CEF binding supports it.
         * May return null when unsupported.
         */
        String evaluateJavaScript(String code);
    }

    private final JsBrowser browser;
    private boolean open;
    private boolean externalLoop;

    public EclipseAetherScape3D(JsBrowser browser) {
        if (browser == null) {
            throw new IllegalArgumentException("browser must not be null");
        }
        this.browser = browser;
    }

    public boolean isOpen() {
        return open;
    }

    public boolean isExternalLoop() {
        return externalLoop;
    }

    /**
     * Open the game panel (self-animating page — recommended for JCEF).
     *
     * @param pageUrl e.g. https://mellowambience.github.io/aetherscape-3d/
     *                or http://127.0.0.1:4174/ or file:///.../dist/index.html
     */
    public void open(String pageUrl) {
        open(pageUrl, false);
    }

    /**
     * Open the game panel.
     *
     * @param pageUrl      game URL
     * @param externalLoop if true, appends ?externalLoop=1 and YOU must call tick/render
     */
    public void open(String pageUrl, boolean externalLoop) {
        if (pageUrl == null || pageUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("pageUrl required");
        }
        this.externalLoop = externalLoop;
        String url = pageUrl.trim();
        if (externalLoop) {
            url = url.contains("?") ? url + "&externalLoop=1" : url + "?externalLoop=1";
        }
        browser.loadURL(url);
        open = true;
    }

    /** Call when the panel loses focus / is hidden. */
    public void onHide() {
        if (!open) {
            return;
        }
        exec("window.AetherScape3DHost && (AetherScape3DHost.save(), AetherScape3DHost.pause());");
    }

    /** Call when the panel is shown again. */
    public void onShow() {
        if (!open) {
            return;
        }
        exec("window.AetherScape3DHost && AetherScape3DHost.resume();");
    }

    /** Call when leaving the game state / disposing the panel. */
    public void onExit() {
        if (!open) {
            return;
        }
        exec("window.AetherScape3DHost && AetherScape3DHost.dispose();");
        open = false;
        externalLoop = false;
    }

    /** Optional host-driven loop (only if open(..., true)). dtSeconds e.g. 1.0/60. */
    public void tick(double dtSeconds) {
        if (!open || !externalLoop) {
            return;
        }
        if (dtSeconds < 0) {
            dtSeconds = 0;
        }
        if (dtSeconds > 0.25) {
            dtSeconds = 0.25;
        }
        exec("window.AetherScape3DHost && AetherScape3DHost.tick(" + dtSeconds + ");");
    }

    public void render() {
        if (!open || !externalLoop) {
            return;
        }
        exec("window.AetherScape3DHost && AetherScape3DHost.render();");
    }

    public void save() {
        if (!open) {
            return;
        }
        exec("window.AetherScape3DHost && AetherScape3DHost.save();");
    }

    public boolean load() {
        if (!open) {
            return false;
        }
        String result = browser.evaluateJavaScript(
            "(function(){ try { return (window.AetherScape3DHost && AetherScape3DHost.load()) ? '1' : '0'; } catch(e) { return '0'; } })();"
        );
        return "1".equals(result);
    }

    /** JSON snapshot string, or empty/null. Requires evaluateJavaScript support. */
    public String exportSave() {
        if (!open) {
            return null;
        }
        return browser.evaluateJavaScript(
            "(function(){ try { var h=window.AetherScape3DHost; return h && h.exportSave ? (h.exportSave()||'') : ''; } catch(e) { return ''; } })();"
        );
    }

    public String stateJson() {
        if (!open) {
            return "null";
        }
        String raw = browser.evaluateJavaScript(
            "(function(){ try { var h=window.AetherScape3DHost; return h && h.state ? JSON.stringify(h.state()) : 'null'; } catch(e) { return 'null'; } })();"
        );
        return raw == null ? "null" : raw;
    }

    private void exec(String code) {
        browser.executeJavaScript(code, "aetherscape-3d-host", 0);
    }
}
