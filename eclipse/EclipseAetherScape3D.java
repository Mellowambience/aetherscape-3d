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
 * Load the built site (dist/) or vite preview URL into the panel, then drive via
 * window.AetherScape3DHost.
 *
 * This file is reference glue — it is NOT compiled in this workspace (no JDK assumed).
 * Copy into your Eclipse module and wire to your real CefBrowser type.
 */
public final class EclipseAetherScape3D {

    /** Replace with your real JCEF browser handle. */
    public interface JsBrowser {
        void loadURL(String url);
        void executeJavaScript(String code, String url, int line);
        /** Optional: evaluate and return a string result if your CEF binding supports it. */
        String evaluateJavaScript(String code);
    }

    private final JsBrowser browser;
    private boolean open;

    public EclipseAetherScape3D(JsBrowser browser) {
        this.browser = browser;
    }

    /**
     * Open the game panel.
     * @param pageUrl e.g. file:///.../aetherscape-3d/dist/index.html
     *                or http://127.0.0.1:4174/
     * @param externalLoop if true, appends ?externalLoop=1 and YOU must call tick/render
     */
    public void open(String pageUrl, boolean externalLoop) {
        String url = pageUrl;
        if (externalLoop) {
            url = pageUrl.contains("?") ? pageUrl + "&externalLoop=1" : pageUrl + "?externalLoop=1";
        }
        browser.loadURL(url);
        open = true;
    }

    public void open(String pageUrl) {
        open(pageUrl, false);
    }

    /** Call when the panel loses focus / is hidden. */
    public void onHide() {
        if (!open) return;
        exec("window.AetherScape3DHost && AetherScape3DHost.save(); AetherScape3DHost.pause();");
    }

    /** Call when the panel is shown again. */
    public void onShow() {
        if (!open) return;
        exec("window.AetherScape3DHost && AetherScape3DHost.resume();");
    }

    /** Call when leaving the game state / disposing the panel. */
    public void onExit() {
        if (!open) return;
        exec("window.AetherScape3DHost && AetherScape3DHost.dispose();");
        open = false;
    }

    /** Optional host-driven loop (only if open(..., true)). dtSeconds e.g. 1/60. */
    public void tick(double dtSeconds) {
        if (!open) return;
        exec("window.AetherScape3DHost && AetherScape3DHost.tick(" + dtSeconds + ");");
    }

    public void render() {
        if (!open) return;
        exec("window.AetherScape3DHost && AetherScape3DHost.render();");
    }

    public void save() {
        exec("window.AetherScape3DHost && AetherScape3DHost.save();");
    }

    public boolean load() {
        String result = browser.evaluateJavaScript(
            "(function(){ return window.AetherScape3DHost && AetherScape3DHost.load() ? '1' : '0'; })();"
        );
        return "1".equals(result);
    }

    /** JSON snapshot string, or null. Requires evaluateJavaScript support. */
    public String exportSave() {
        return browser.evaluateJavaScript(
            "(function(){ var h=window.AetherScape3DHost; return h && h.exportSave ? (h.exportSave()||'') : ''; })();"
        );
    }

    public String stateJson() {
        return browser.evaluateJavaScript(
            "(function(){ var h=window.AetherScape3DHost; return h && h.state ? JSON.stringify(h.state()) : 'null'; })();"
        );
    }

    private void exec(String code) {
        browser.executeJavaScript(code, "aetherscape-3d-host", 0);
    }
}
