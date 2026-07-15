package com.aetherhaven.eclipse.jcef;

import com.aetherhaven.eclipse.EclipseAetherScape3D;

/**
 * Adapter sketch for embedding AetherScape 3D in a JCEF panel.
 *
 * This class is intentionally free of JCEF imports so the glue jar compiles
 * without vendor jars. In your Eclipse module:
 *
 * <pre>
 * public final class RealCefAdapter implements EclipseAetherScape3D.JsBrowser {
 *   private final org.cef.browser.CefBrowser cef;
 *   public RealCefAdapter(CefBrowser cef) { this.cef = cef; }
 *   public void loadURL(String url) { cef.loadURL(url); }
 *   public void executeJavaScript(String code, String url, int line) {
 *     cef.executeJavaScript(code, url, line);
 *   }
 *   public String evaluateJavaScript(String code) {
 *     // Prefer CefQuery / DevTools protocol if available; many CEF embeds
 *     // only support fire-and-forget executeJavaScript.
 *     return null;
 *   }
 * }
 * </pre>
 */
public final class CefBrowserAdapterNotes {
    private CefBrowserAdapterNotes() {}

    public static String recommendedLiveUrl() {
        return "https://mellowambience.github.io/aetherscape-3d/";
    }

    public static String recommendedLocalDevUrl() {
        return "http://127.0.0.1:4174/";
    }

    /** Example lifecycle for an Eclipse game-state panel. */
    public static void exampleLifecycle(EclipseAetherScape3D.JsBrowser browser) {
        EclipseAetherScape3D game = new EclipseAetherScape3D(browser);
        game.open(recommendedLiveUrl(), false);
        // on panel hide: game.onHide();
        // on panel show: game.onShow();
        // on leave state: game.onExit();
    }
}
