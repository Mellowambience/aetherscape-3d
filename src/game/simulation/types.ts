export type Vector2 = { x: number; z: number };

export type PaletteId = "lume" | "capkin" | "ember" | "milo";
export type SkillId = "combat" | "foraging" | "crystal-mining" | "attunement";
export type ItemId = "glowreed" | "leycord" | "shellshard" | "hearthloaf" | "raw-crystal" | "ward-charm";
export type QuestStage = "not-started" | "gather" | "craft" | "return" | "complete";
export type LogTone = "system" | "quest" | "loot" | "combat" | "skill";
export type RecipeId = "leycord" | "ward-charm";
export type ResourceKind = "glowreed" | "ley-crystal";
export type DayPhase = "day" | "night";

export interface SkillProgress {
  xp: number;
  level: number;
}

export interface ItemStack {
  itemId: ItemId;
  quantity: number;
}

export interface PlayerState {
  id: "player";
  name: string;
  palette: PaletteId;
  position: Vector2;
  health: number;
  maxHealth: number;
  path: Vector2[];
  combatTargetId: string | null;
  attackCooldown: number;
  inventory: ItemStack[];
  bank: ItemStack[];
  skills: Record<SkillId, SkillProgress>;
  /** Temporary combat defense from ward-charm (ticks remaining). */
  wardTicks: number;
}

export interface NpcState {
  id: string;
  name: string;
  role: string;
  position: Vector2;
}

export interface ResourceNodeState {
  id: string;
  kind: ResourceKind;
  position: Vector2;
  available: boolean;
  respawnAtTick: number;
}

export interface EnemyState {
  id: string;
  kind: "gloamtick";
  position: Vector2;
  spawn: Vector2;
  health: number;
  maxHealth: number;
  alive: boolean;
  respawnAtTick: number;
  attackCooldown: number;
  aggro: boolean;
}

export interface GroundLootState {
  id: string;
  position: Vector2;
  itemId: ItemId;
  quantity: number;
  expiresAtTick: number;
}

export interface QuestState {
  id: "relight-leyward";
  title: "Relight the Leyward";
  stage: QuestStage;
  glowreedGathered: number;
  gloamticksDefeated: number;
}

export interface DialogueState {
  speaker: string;
  pages: string[];
  page: number;
  outcome: "accept-quest" | "finish-quest" | "none";
}

export interface ActiveTaskState {
  kind: "gather";
  targetId: string;
  startedAtTick: number;
  endsAtTick: number;
}

export interface LogEntry {
  id: number;
  tick: number;
  text: string;
  tone: LogTone;
}

export interface GameSettings {
  autosave: boolean;
  showGrid: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  uiScale: number;
  cameraZoom: number;
}

export interface GameState {
  saveVersion: 1;
  tick: number;
  seed: number;
  /** Progress through day/night cycle (ticks). */
  worldClock: number;
  dayPhase: DayPhase;
  player: PlayerState;
  npcs: NpcState[];
  resourceNodes: ResourceNodeState[];
  enemies: EnemyState[];
  groundLoot: GroundLootState[];
  quest: QuestState;
  dialogue: DialogueState | null;
  activeTask: ActiveTaskState | null;
  craftingOpen: boolean;
  bankOpen: boolean;
  paused: boolean;
  settings: GameSettings;
  log: LogEntry[];
}

export type SimulationAction =
  | { type: "navigate"; destination: Vector2 }
  | { type: "interact"; targetId?: string }
  | { type: "attack"; enemyId: string }
  | { type: "advance-dialogue" }
  | { type: "craft"; recipeId: RecipeId }
  | { type: "use-item"; itemId: ItemId }
  | { type: "close-crafting" }
  | { type: "close-bank" }
  | { type: "bank-deposit-all" }
  | { type: "bank-withdraw-all" }
  | { type: "toggle-pause" }
  | { type: "set-pause"; paused: boolean }
  | { type: "set-setting"; key: keyof GameSettings; value: boolean | number };

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  icon: string;
  stackLimit: number;
}

/** Day/night lengths at 20 Hz (~30s day, ~20s night). */
export const DAY_LENGTH_TICKS = 600;
export const NIGHT_LENGTH_TICKS = 400;
export const CYCLE_LENGTH_TICKS = DAY_LENGTH_TICKS + NIGHT_LENGTH_TICKS;
