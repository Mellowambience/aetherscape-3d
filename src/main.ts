import "./styles.css";
import { InputController } from "./game/input/InputController";
import { SaveManager } from "./game/save/SaveManager";
import { createNewGame } from "./game/simulation/createState";
import { Simulation } from "./game/simulation/Simulation";
import type { GameState, PaletteId } from "./game/simulation/types";
import { WorldRenderer } from "./render/app/WorldRenderer";
import { UIController } from "./ui/UIController";

const FIXED_STEP_SECONDS = 1 / 20;
const saveManager = new SaveManager();
let simulation: Simulation | null = null;
let worldRenderer: WorldRenderer | null = null;
let lastFrame = performance.now();
let accumulator = 0;
let lastAutosaveTick = -1;
let hostPaused = false;
/** When true, host drives tick/render (Eclipse JCEF / external loop). */
let externalLoop = new URLSearchParams(window.location.search).has("externalLoop");
let rafId = 0;
let disposed = false;

const ui = new UIController({
  onStartCharacter: (name, palette) => startNewCharacter(name, palette),
  onContinue: () => continueCharacter(),
  onInteract: () => simulation?.dispatch({ type: "interact" }),
  onAdvanceDialogue: () => simulation?.dispatch({ type: "advance-dialogue" }),
  onCraft: (recipeId) => simulation?.dispatch({ type: "craft", recipeId }),
  onCloseCrafting: () => simulation?.dispatch({ type: "close-crafting" }),
  onCloseBank: () => simulation?.dispatch({ type: "close-bank" }),
  onBankDepositAll: () => simulation?.dispatch({ type: "bank-deposit-all" }),
  onBankWithdrawAll: () => simulation?.dispatch({ type: "bank-withdraw-all" }),
  onUseItem: (itemId) => simulation?.dispatch({ type: "use-item", itemId }),
  onSetting: (key, value) => simulation?.dispatch({ type: "set-setting", key, value }),
  onPauseChange: (paused) => simulation?.dispatch({ type: "set-pause", paused }),
  onSave: () => saveNow("Journey saved locally."),
  onLoad: () => loadLastSave(),
  onExport: () => exportSave(),
  onImport: (raw) => importSave(raw),
  onReset: () => resetCharacter(),
});

const input = new InputController({
  onInteract: () => simulation?.dispatch({ type: "interact" }),
  onToggleInventory: () => ui.toggleInventory(),
  onToggleJournal: () => ui.toggleJournal(),
  onToggleSettings: () => ui.toggleSettings(),
  onCameraReset: () => worldRenderer?.resetCamera(),
});

ui.configureBoot(saveManager.load());
if (!externalLoop) rafId = requestAnimationFrame(frame);

function startNewCharacter(name: string, palette: PaletteId): void {
  if (!name.trim()) {
    ui.showBootMessage("Choose a name before entering the hollow.");
    return;
  }
  const state = createNewGame(name, palette);
  saveManager.save(state);
  startGame(state);
}

function continueCharacter(): void {
  const state = saveManager.load();
  if (!state) {
    ui.showBootMessage("The local save could not be read. Create a new wayfarer below.");
    ui.configureBoot(null);
    return;
  }
  startGame(state);
}

function startGame(state: GameState): void {
  ui.closeAllOverlays();
  worldRenderer?.dispose();
  simulation = new Simulation(state);
  worldRenderer = new WorldRenderer(requiredElement("world"), state, {
    onGroundClick: (destination) => simulation?.dispatch({ type: "navigate", destination }),
    onEntityClick: (entityId, entityKind) => {
      if (entityKind === "enemy") simulation?.dispatch({ type: "attack", enemyId: entityId });
      else simulation?.dispatch({ type: "interact", targetId: entityId });
    },
    onZoomChange: (zoom) => simulation?.dispatch({ type: "set-setting", key: "cameraZoom", value: zoom }),
    onContextStatus: (message) => ui.showToast(message),
  });
  document.body.dataset.gameReady = "true";
  ui.enterGame();
  paint(state);
  lastFrame = performance.now();
  accumulator = 0;
  lastAutosaveTick = state.tick;
}

function frame(now: number): void {
  if (disposed || externalLoop) return;
  const delta = Math.min(0.2, (now - lastFrame) / 1000);
  lastFrame = now;
  stepSim(delta);
  rafId = requestAnimationFrame(frame);
}

function stepSim(delta: number): void {
  if (!simulation || !worldRenderer || hostPaused) return;
  accumulator += delta;
  const movement = worldRenderer.cameraRelativeMovement(input.getMovement());
  simulation.setMoveIntent(movement);
  while (accumulator >= FIXED_STEP_SECONDS) {
    simulation.tick();
    accumulator -= FIXED_STEP_SECONDS;
  }
  const state = simulation.getState();
  if (state.settings.autosave && state.tick > 0 && state.tick % 100 === 0 && lastAutosaveTick !== state.tick) {
    lastAutosaveTick = state.tick;
    saveManager.save(state);
  }
  paint(state);
}

function paint(state: GameState): void {
  if (!simulation || !worldRenderer) return;
  ui.render(state, simulation.getContextHint(), simulation.getTaskProgress(), simulation.getObjectiveText());
  worldRenderer.render(state);
}

function saveNow(message: string): void {
  if (!simulation) return;
  saveManager.save(simulation.getState());
  ui.showToast(message);
}

function loadLastSave(): void {
  const state = saveManager.load();
  if (!state) {
    ui.showToast("No save found.");
    return;
  }
  startGame(state);
  ui.showToast("Save loaded.");
}

function exportSave(): void {
  if (!simulation) return;
  const blob = new Blob([saveManager.exportJson(simulation.getState())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "aetherscape-3d-save.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function importSave(raw: string): void {
  try {
    const state = saveManager.importJson(raw);
    startGame(state);
    ui.showToast("Save imported.");
  } catch {
    ui.showToast("Import failed — invalid save.");
  }
}

function resetCharacter(): void {
  if (!window.confirm("Delete the local character?")) return;
  saveManager.clear();
  worldRenderer?.dispose();
  worldRenderer = null;
  simulation = null;
  document.body.dataset.gameReady = "false";
  ui.configureBoot(null);
  ui.showToast("Local character deleted.");
}

function requiredElement(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && simulation) saveManager.save(simulation.getState());
});
window.addEventListener("beforeunload", () => {
  if (simulation) saveManager.save(simulation.getState());
});

/** Eclipse / host bridge — external-loop seam for JCEF. */
export const AetherScape3DHost = {
  pause(): void {
    hostPaused = true;
    simulation?.dispatch({ type: "set-pause", paused: true });
  },
  resume(): void {
    hostPaused = false;
    simulation?.dispatch({ type: "set-pause", paused: false });
  },
  /** Host-driven fixed-step sim. Pass dt in seconds. */
  tick(dt: number): void {
    if (disposed || !simulation || hostPaused) return;
    accumulator += Math.min(0.2, Math.max(0, dt));
    while (accumulator >= FIXED_STEP_SECONDS) {
      simulation.tick();
      accumulator -= FIXED_STEP_SECONDS;
    }
  },
  render(): void {
    if (disposed || !simulation || !worldRenderer) return;
    paint(simulation.getState());
  },
  save(): void {
    if (simulation) saveManager.save(simulation.getState());
  },
  load(): boolean {
    const state = saveManager.load();
    if (!state) return false;
    startGame(state);
    return true;
  },
  exportSave(): string | null {
    return simulation ? saveManager.exportJson(simulation.getState()) : null;
  },
  importSaveJson(raw: string): boolean {
    try {
      importSave(raw);
      return true;
    } catch {
      return false;
    }
  },
  setExternalLoop(enabled: boolean): void {
    externalLoop = enabled;
    if (enabled) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!disposed && !rafId) {
      lastFrame = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  },
  isExternalLoop(): boolean {
    return externalLoop;
  },
  dispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (simulation) saveManager.save(simulation.getState());
    worldRenderer?.dispose();
    input.dispose();
    worldRenderer = null;
    simulation = null;
  },
  state(): Record<string, unknown> | null {
    if (!simulation) return null;
    const s = simulation.getState();
    return {
      tick: s.tick,
      dayPhase: s.dayPhase,
      questStage: s.quest.stage,
      health: s.player.health,
      wardTicks: s.player.wardTicks,
      name: s.player.name,
      skills: s.player.skills,
      bankStacks: s.player.bank.length,
      inventoryStacks: s.player.inventory.length,
    };
  },
};

declare global {
  interface Window {
    AetherScape3DHost: typeof AetherScape3DHost;
  }
}

window.AetherScape3DHost = AetherScape3DHost;
