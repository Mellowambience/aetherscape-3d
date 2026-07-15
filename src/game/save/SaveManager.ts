import { DEFAULT_SETTINGS } from "../simulation/createState";
import { createSkills } from "../simulation/progression";
import type { GameState, ItemId, QuestStage, SkillId } from "../simulation/types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = "aetherscape-3d.save.v1";

const ITEM_IDS = new Set<ItemId>(["glowreed", "leycord", "shellshard", "hearthloaf", "raw-crystal", "ward-charm"]);
const SKILL_IDS = new Set<SkillId>(["combat", "foraging", "crystal-mining", "attunement"]);
const QUEST_STAGES = new Set<QuestStage>(["not-started", "gather", "craft", "return", "complete"]);

export class SaveManager {
  constructor(private storage: StorageLike = window.localStorage) {}

  hasSave(): boolean {
    return this.storage.getItem(SAVE_KEY) !== null;
  }

  save(state: GameState): void {
    const snapshot: GameState = structuredClone(state);
    stripTransients(snapshot);
    this.storage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  }

  load(): GameState | null {
    const raw = this.storage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      return this.parse(raw);
    } catch {
      return null;
    }
  }

  parse(raw: string): GameState {
    const candidate: unknown = JSON.parse(raw);
    if (!isGameState(candidate)) throw new Error("Save data is not a supported AetherScape 3D save.");
    const defaults = createSkills();
    const skills = { ...defaults, ...candidate.player.skills };
    return {
      ...candidate,
      worldClock: typeof candidate.worldClock === "number" ? candidate.worldClock : 0,
      dayPhase: candidate.dayPhase === "night" ? "night" : "day",
      settings: { ...DEFAULT_SETTINGS, ...candidate.settings },
      dialogue: null,
      activeTask: null,
      craftingOpen: false,
      bankOpen: false,
      paused: false,
      player: {
        ...candidate.player,
        path: [],
        combatTargetId: null,
        bank: Array.isArray(candidate.player.bank) ? candidate.player.bank : [],
        wardTicks: typeof candidate.player.wardTicks === "number" ? candidate.player.wardTicks : 0,
        skills,
      },
    };
  }

  exportJson(state: GameState): string {
    const snapshot = structuredClone(state);
    stripTransients(snapshot);
    return JSON.stringify(snapshot, null, 2);
  }

  importJson(raw: string): GameState {
    const state = this.parse(raw);
    this.save(state);
    return state;
  }

  clear(): void {
    this.storage.removeItem(SAVE_KEY);
  }
}

function stripTransients(snapshot: GameState): void {
  snapshot.dialogue = null;
  snapshot.activeTask = null;
  snapshot.craftingOpen = false;
  snapshot.bankOpen = false;
  snapshot.paused = false;
  snapshot.player.path = [];
  snapshot.player.combatTargetId = null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value.saveVersion !== 1 || typeof value.tick !== "number") return false;
  if (!isRecord(value.player) || typeof value.player.name !== "string" || !isRecord(value.player.position)) return false;
  if (!Array.isArray(value.player.inventory) || !isRecord(value.player.skills)) return false;
  for (const stack of value.player.inventory) {
    if (!isRecord(stack) || !ITEM_IDS.has(stack.itemId as ItemId) || typeof stack.quantity !== "number") return false;
  }
  if (Array.isArray(value.player.bank)) {
    for (const stack of value.player.bank) {
      if (!isRecord(stack) || !ITEM_IDS.has(stack.itemId as ItemId) || typeof stack.quantity !== "number") return false;
    }
  }
  for (const skillId of SKILL_IDS) {
    const skill = (value.player.skills as Record<string, unknown>)[skillId];
    if (skill === undefined) continue; // migrate missing skills
    if (!isRecord(skill) || typeof skill.xp !== "number" || typeof skill.level !== "number") return false;
  }
  if (!Array.isArray(value.npcs) || !Array.isArray(value.resourceNodes) || !Array.isArray(value.enemies)) return false;
  if (!Array.isArray(value.groundLoot) || !Array.isArray(value.log) || !isRecord(value.quest)) return false;
  if (value.quest.id !== "relight-leyward" || !QUEST_STAGES.has(value.quest.stage as QuestStage)) return false;
  return isRecord(value.settings);
}
