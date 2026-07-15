import { PLAYER_SPAWN, WORLD_ENEMIES, WORLD_NPCS, WORLD_RESOURCE_NODES } from "../content/world";
import { createSkills } from "./progression";
import type { GameSettings, GameState, PaletteId } from "./types";

export const DEFAULT_SETTINGS: GameSettings = {
  autosave: true,
  showGrid: false,
  reducedMotion: false,
  highContrast: false,
  uiScale: 1,
  cameraZoom: 1,
};

export function createNewGame(name: string, palette: PaletteId): GameState {
  const safeName = name.trim().replace(/[^a-zA-Z0-9 '\-]/g, "").slice(0, 18) || "Wayfarer";
  return {
    saveVersion: 1,
    tick: 0,
    seed: 0xa37e12,
    worldClock: 0,
    dayPhase: "day",
    player: {
      id: "player",
      name: safeName,
      palette,
      position: { ...PLAYER_SPAWN },
      health: 40,
      maxHealth: 40,
      path: [],
      combatTargetId: null,
      attackCooldown: 0,
      inventory: [],
      bank: [],
      skills: createSkills(),
      wardTicks: 0,
    },
    npcs: WORLD_NPCS.map((npc) => ({ ...npc, position: { ...npc.position } })),
    resourceNodes: WORLD_RESOURCE_NODES.map((node) => ({
      ...node,
      position: { ...node.position },
      available: true,
      respawnAtTick: 0,
    })),
    enemies: WORLD_ENEMIES.map((enemy) => ({
      ...enemy,
      position: { ...enemy.position },
      spawn: { ...enemy.position },
      health: 18,
      maxHealth: 18,
      alive: true,
      respawnAtTick: 0,
      attackCooldown: 0,
      aggro: false,
    })),
    groundLoot: [],
    quest: {
      id: "relight-leyward",
      title: "Relight the Leyward",
      stage: "not-started",
      glowreedGathered: 0,
      gloamticksDefeated: 0,
    },
    dialogue: null,
    activeTask: null,
    craftingOpen: false,
    bankOpen: false,
    paused: false,
    settings: { ...DEFAULT_SETTINGS },
    log: [
      { id: 1, tick: 0, tone: "system", text: `Welcome to Ley-Root Hollow, ${safeName}.` },
      { id: 2, tick: 0, tone: "system", text: "Find The Curator in Emberfold. Press E near people and objects." },
      { id: 3, tick: 0, tone: "system", text: "Tip: mine ley-crystals on the north ridge; bank chest by the storehouse." },
    ],
  };
}
