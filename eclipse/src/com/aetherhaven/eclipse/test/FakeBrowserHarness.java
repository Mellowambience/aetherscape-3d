package com.aetherhaven.eclipse.test;

import com.aetherhaven.eclipse.EclipseAetherScape3D;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * Headless compile-time + runtime smoke for EclipseAetherScape3D without JCEF.
 * Records all browser calls and asserts lifecycle order.
 */
public final class FakeBrowserHarness implements EclipseAetherScape3D.JsBrowser {

    private final List<String> log = new ArrayList<String>();
    private String lastUrl;
    private String evalResult = "null";

    public void setEvalResult(String value) {
        this.evalResult = value;
    }

    public List<String> getLog() {
        return log;
    }

    public String getLastUrl() {
        return lastUrl;
    }

    @Override
    public void loadURL(String url) {
        lastUrl = url;
        log.add("loadURL " + url);
    }

    @Override
    public void executeJavaScript(String code, String url, int line) {
        log.add("js " + code.replace('\n', ' '));
    }

    @Override
    public String evaluateJavaScript(String code) {
        log.add("eval " + code.replace('\n', ' '));
        return evalResult;
    }

    public static void main(String[] args) throws Exception {
        FakeBrowserHarness browser = new FakeBrowserHarness();
        EclipseAetherScape3D game = new EclipseAetherScape3D(browser);

        game.open("https://mellowambience.github.io/aetherscape-3d/", false);
        assertTrue(game.isOpen(), "open");
        assertTrue(!game.isExternalLoop(), "default self-loop");
        assertTrue(browser.getLastUrl().endsWith("aetherscape-3d/"), "url");

        game.onHide();
        game.onShow();
        game.save();

        browser.setEvalResult("{\"tick\":1,\"questStage\":\"gather\"}");
        String state = game.stateJson();
        assertTrue(state.contains("questStage"), "stateJson");

        browser.setEvalResult("1");
        assertTrue(game.load(), "load true");

        // external loop path
        game.onExit();
        game.open("http://127.0.0.1:4174/", true);
        assertTrue(game.isExternalLoop(), "external");
        assertTrue(browser.getLastUrl().contains("externalLoop=1"), "query");
        game.tick(1.0 / 60.0);
        game.render();
        game.onExit();
        assertTrue(!game.isOpen(), "closed");

        Path out = Paths.get("eclipse", "out", "harness-log.txt");
        Files.createDirectories(out.getParent());
        BufferedWriter w = Files.newBufferedWriter(out, StandardCharsets.UTF_8);
        try {
            for (String line : browser.getLog()) {
                w.write(line);
                w.newLine();
            }
        } finally {
            w.close();
        }

        System.out.println("ECLIPSE_GLUE_OK calls=" + browser.getLog().size());
        System.out.println("log=" + out.toAbsolutePath());
        for (String line : browser.getLog()) {
            System.out.println("  " + line);
        }
    }

    private static void assertTrue(boolean cond, String name) {
        if (!cond) {
            throw new AssertionError("FAIL: " + name);
        }
    }
}
