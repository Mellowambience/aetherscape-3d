import { DIALOGUE, ITEM_CATALOG, RECIPES } from "../content/catalog";
import { PLAYER_SPAWN, WORLD_STATIONS, isWalkable } from "../content/world";
import { addItem, BANK_SLOTS, countItem, removeItem } from "./inventory";
import { findAdjacentPath, findPath } from "./pathfinding";
import { grantXp } from "./progression";
import type {
  DialogueState,
  EnemyState,
  GameSettings,
  GameState,
  ItemId,
  ItemStack,
  LogTone,
  RecipeId,
  SimulationAction,
  SkillId,
  Vector2,
} from "./types";
import { CYCLE_LENGTH_TICKS, DAY_LENGTH_TICKS } from "./types";

const MOVE_SPEED = 0.115;
const INTERACTION_RANGE = 1.65;
const ATTACK_RANGE = 1.55;

type PendingInteraction = { targetId: string } | null;

export interface ContextHint {
  targetId: string;
  label: string;
  kind: "npc" | "resource" | "station" | "enemy" | "loot";
}

export class Simulation {
  private readonly state: GameState;
  private moveIntent: Vector2 = { x: 0, z: 0 };
  private readonly actionQueue: SimulationAction[] = [];
  private pendingInteraction: PendingInteraction = null;
  private logSerial = 10;

  constructor(state: GameState) {
    this.state = state;
    this.normalizeState(state);
    this.state.dialogue = null;
    this.state.activeTask = null;
    this.state.craftingOpen = false;
    this.state.bankOpen = false;
    this.state.paused = false;
    this.state.player.path = [];
    this.state.player.combatTargetId = null;
    this.logSerial = Math.max(10, ...state.log.map((entry) => entry.id));
  }

  getState(): GameState {
    return this.state;
  }

  setMoveIntent(intent: Vector2): void {
    this.moveIntent = intent;
  }

  dispatch(action: SimulationAction): void {
    this.actionQueue.push(action);
  }

  tick(): void {
    this.processActions();
    if (this.state.paused || this.state.dialogue || this.state.craftingOpen || this.state.bankOpen) return;
    this.state.tick += 1;
    this.updateDayNight();
    this.updateCooldowns();
    this.updateRespawns();
    this.updateTask();
    this.updateMovement();
    this.resolvePendingInteraction();
    this.updateCombat();
    this.updateQuestProgress();
  }

  getContextHint(): ContextHint | null {
    const player = this.state.player.position;
    const candidates: Array<ContextHint & { distance: number }> = [];
    for (const loot of this.state.groundLoot) {
      candidates.push({
        targetId: loot.id,
        label: `Pick up ${this.itemLabel(loot.itemId)}`,
        kind: "loot",
        distance: distance(player, loot.position),
      });
    }
    for (const node of this.state.resourceNodes.filter((candidate) => candidate.available)) {
      const label = node.kind === "ley-crystal" ? "Mine Ley Crystal" : "Gather Glowreed";
      candidates.push({ targetId: node.id, label, kind: "resource", distance: distance(player, node.position) });
    }
    for (const npc of this.state.npcs) {
      candidates.push({ targetId: npc.id, label: `Talk to ${npc.name}`, kind: "npc", distance: distance(player, npc.position) });
    }
    for (const station of WORLD_STATIONS) {
      let label = "Inspect";
      if (station.kind === "shrine-loom") label = "Use Shrine Loom";
      else if (station.kind === "leyward") label = "Inspect Leyward";
      else if (station.kind === "bank-chest") label = "Open bank chest";
      candidates.push({ targetId: station.id, label, kind: "station", distance: distance(player, station.position) });
    }
    for (const enemy of this.state.enemies.filter((candidate) => candidate.alive)) {
      candidates.push({ targetId: enemy.id, label: "Attack Gloamtick", kind: "enemy", distance: distance(player, enemy.position) });
    }
    const closest = candidates.filter((candidate) => candidate.distance <= INTERACTION_RANGE + 0.2).sort((a, b) => a.distance - b.distance)[0];
    if (!closest) return null;
    const { distance: _distance, ...hint } = closest;
    return hint;
  }

  getObjectiveText(): { title: string; detail: string } {
    const quest = this.state.quest;
    const phase = this.state.dayPhase === "night" ? " · Night" : "";
    switch (quest.stage) {
      case "not-started":
        return { title: "First steps", detail: `Speak with The Curator in Emberfold${phase}` };
      case "gather":
        return {
          title: quest.title,
          detail: `Glowreed ${Math.min(quest.glowreedGathered, 3)}/3 · Gloamticks ${Math.min(quest.gloamticksDefeated, 1)}/1${phase}`,
        };
      case "craft":
        return { title: quest.title, detail: `Craft Leycord at the Shrine Loom${phase}` };
      case "return":
        return { title: quest.title, detail: `Bring the Leycord to The Curator${phase}` };
      case "complete":
        return { title: "Leyward restored", detail: `Explore · mine crystals · craft Ward Charms${phase}` };
    }
  }

  getTaskProgress(): number | null {
    const task = this.state.activeTask;
    if (!task) return null;
    return clamp((this.state.tick - task.startedAtTick) / (task.endsAtTick - task.startedAtTick), 0, 1);
  }

  private normalizeState(state: GameState): void {
    if (!Array.isArray(state.player.bank)) state.player.bank = [];
    if (typeof state.player.wardTicks !== "number") state.player.wardTicks = 0;
    if (typeof state.worldClock !== "number") state.worldClock = 0;
    if (state.dayPhase !== "day" && state.dayPhase !== "night") state.dayPhase = "day";
    if (typeof state.bankOpen !== "boolean") state.bankOpen = false;
    const skills = state.player.skills as Record<string, { xp: number; level: number }>;
    if (!skills["crystal-mining"]) skills["crystal-mining"] = { xp: 0, level: 1 };
    if (!skills.foraging) skills.foraging = { xp: 0, level: 1 };
    if (!skills.combat) skills.combat = { xp: 0, level: 1 };
    if (!skills.attunement) skills.attunement = { xp: 0, level: 1 };
  }

  private processActions(): void {
    while (this.actionQueue.length > 0) {
      const action = this.actionQueue.shift() as SimulationAction;
      switch (action.type) {
        case "navigate":
          if (this.inputBlocked()) break;
          this.state.activeTask = null;
          this.state.player.combatTargetId = null;
          this.pendingInteraction = null;
          this.state.player.path = findPath(this.state.player.position, action.destination);
          break;
        case "interact":
          if (!this.inputBlocked()) this.beginInteraction(action.targetId ?? this.getContextHint()?.targetId);
          break;
        case "attack":
          if (!this.inputBlocked()) this.beginAttack(action.enemyId);
          break;
        case "advance-dialogue":
          this.advanceDialogue();
          break;
        case "craft":
          this.craft(action.recipeId);
          break;
        case "use-item":
          this.useItem(action.itemId);
          break;
        case "close-crafting":
          this.state.craftingOpen = false;
          break;
        case "close-bank":
          this.state.bankOpen = false;
          break;
        case "bank-deposit-all":
          this.bankDepositAll();
          break;
        case "bank-withdraw-all":
          this.bankWithdrawAll();
          break;
        case "toggle-pause":
          if (!this.state.dialogue && !this.state.craftingOpen && !this.state.bankOpen) this.state.paused = !this.state.paused;
          break;
        case "set-pause":
          if (!this.state.dialogue && !this.state.craftingOpen && !this.state.bankOpen) this.state.paused = action.paused;
          break;
        case "set-setting":
          this.setSetting(action.key, action.value);
          break;
      }
    }
  }

  private inputBlocked(): boolean {
    return this.state.paused || Boolean(this.state.dialogue) || this.state.craftingOpen || this.state.bankOpen;
  }

  private updateDayNight(): void {
    const prev = this.state.dayPhase;
    this.state.worldClock = (this.state.worldClock + 1) % CYCLE_LENGTH_TICKS;
    this.state.dayPhase = this.state.worldClock < DAY_LENGTH_TICKS ? "day" : "night";
    if (prev !== this.state.dayPhase) {
      if (this.state.dayPhase === "night") {
        this.addLog("Night settles on Ley-Root Hollow. Gloamticks grow bold.", "system");
        for (const enemy of this.state.enemies) {
          if (enemy.alive) enemy.aggro = true;
        }
      } else {
        this.addLog("Dawn returns. The hollow softens.", "system");
      }
    }
  }

  private updateMovement(): void {
    const player = this.state.player;
    const magnitude = Math.hypot(this.moveIntent.x, this.moveIntent.z);
    if (magnitude > 0.05) {
      player.path = [];
      player.combatTargetId = null;
      this.pendingInteraction = null;
      if (this.state.activeTask) {
        this.state.activeTask = null;
        this.addLog("Gathering interrupted.", "system");
      }
      this.tryMove(this.moveIntent.x / magnitude, this.moveIntent.z / magnitude, MOVE_SPEED);
      return;
    }
    if (this.state.activeTask || player.path.length === 0) return;
    const next = player.path[0];
    const dx = next.x - player.position.x;
    const dz = next.z - player.position.z;
    const remaining = Math.hypot(dx, dz);
    if (remaining <= MOVE_SPEED + 0.025) {
      player.position = { ...next };
      player.path.shift();
    } else {
      this.tryMove(dx / remaining, dz / remaining, MOVE_SPEED);
    }
  }

  private tryMove(dx: number, dz: number, amount: number): void {
    const position = this.state.player.position;
    const proposed = { x: position.x + dx * amount, z: position.z + dz * amount };
    if (isWalkable(proposed)) {
      position.x = proposed.x;
      position.z = proposed.z;
      return;
    }
    const xOnly = { x: proposed.x, z: position.z };
    const zOnly = { x: position.x, z: proposed.z };
    if (isWalkable(xOnly)) position.x = xOnly.x;
    else if (isWalkable(zOnly)) position.z = zOnly.z;
  }

  private beginInteraction(targetId?: string): void {
    if (!targetId) return;
    const targetPosition = this.findTargetPosition(targetId);
    if (!targetPosition) return;
    if (distance(this.state.player.position, targetPosition) > INTERACTION_RANGE) {
      this.pendingInteraction = { targetId };
      this.state.player.combatTargetId = null;
      this.state.player.path = findAdjacentPath(this.state.player.position, targetPosition);
      if (this.state.player.path.length === 0) this.pendingInteraction = null;
      return;
    }
    this.performInteraction(targetId);
  }

  private resolvePendingInteraction(): void {
    if (!this.pendingInteraction || this.state.player.path.length > 0) return;
    const { targetId } = this.pendingInteraction;
    this.pendingInteraction = null;
    this.performInteraction(targetId);
  }

  private performInteraction(targetId: string): void {
    const npc = this.state.npcs.find((candidate) => candidate.id === targetId);
    if (npc) {
      this.openCuratorDialogue();
      return;
    }
    const node = this.state.resourceNodes.find((candidate) => candidate.id === targetId);
    if (node) {
      if (!node.available) {
        this.addLog(node.kind === "ley-crystal" ? "The seam needs time to regrow." : "The cut reeds need time to regrow.", "system");
        return;
      }
      this.state.player.path = [];
      const duration = node.kind === "ley-crystal" ? 36 : 28;
      this.state.activeTask = {
        kind: "gather",
        targetId: node.id,
        startedAtTick: this.state.tick,
        endsAtTick: this.state.tick + duration,
      };
      this.addLog(node.kind === "ley-crystal" ? "You begin mining ley-crystal…" : "You begin gathering Glowreed…", "skill");
      return;
    }
    const station = WORLD_STATIONS.find((candidate) => candidate.id === targetId);
    if (station?.kind === "shrine-loom") {
      this.state.craftingOpen = true;
      return;
    }
    if (station?.kind === "bank-chest") {
      this.state.bankOpen = true;
      return;
    }
    if (station?.kind === "leyward") {
      const message =
        this.state.quest.stage === "complete"
          ? "The restored Leyward hums with a steady violet-gold glow."
          : "The Leyward is cold. Its channel is missing a Leycord.";
      this.addLog(message, "quest");
      return;
    }
    const loot = this.state.groundLoot.find((candidate) => candidate.id === targetId);
    if (loot) {
      if (addItem(this.state.player.inventory, loot.itemId, loot.quantity)) {
        this.state.groundLoot = this.state.groundLoot.filter((candidate) => candidate.id !== loot.id);
        this.addLog(`Loot: ${this.itemLabel(loot.itemId)} ×${loot.quantity}.`, "loot");
      } else {
        this.addLog("Your inventory is full.", "system");
      }
      return;
    }
    const enemy = this.state.enemies.find((candidate) => candidate.id === targetId && candidate.alive);
    if (enemy) this.beginAttack(enemy.id);
  }

  private beginAttack(enemyId: string): void {
    const enemy = this.state.enemies.find((candidate) => candidate.id === enemyId && candidate.alive);
    if (!enemy) return;
    this.state.activeTask = null;
    this.pendingInteraction = null;
    this.state.player.combatTargetId = enemy.id;
    enemy.aggro = true;
    if (distance(this.state.player.position, enemy.position) > ATTACK_RANGE) {
      this.state.player.path = findAdjacentPath(this.state.player.position, enemy.position);
    }
  }

  private updateCombat(): void {
    const player = this.state.player;
    const night = this.state.dayPhase === "night";
    const aggroRange = night ? 4.4 : 3.2;
    const deaggroRange = night ? 8 : 6;

    const target = this.state.enemies.find((enemy) => enemy.id === player.combatTargetId && enemy.alive);
    if (target) {
      const range = distance(player.position, target.position);
      if (range <= ATTACK_RANGE) {
        player.path = [];
        if (player.attackCooldown <= 0) this.playerAttack(target);
      } else if (player.path.length === 0) {
        player.path = findAdjacentPath(player.position, target.position);
      }
    }

    for (const enemy of this.state.enemies.filter((candidate) => candidate.alive)) {
      const range = distance(player.position, enemy.position);
      if (range <= aggroRange) enemy.aggro = true;
      if (!enemy.aggro) continue;
      if (range > deaggroRange) {
        enemy.aggro = false;
        continue;
      }
      if (range > ATTACK_RANGE) {
        if (this.state.tick % 4 === 0) this.moveEnemyToward(enemy, player.position);
      } else if (enemy.attackCooldown <= 0) {
        let damage = 2 + ((this.state.tick + enemy.id.length) % 3) + (night ? 1 : 0);
        if (player.wardTicks > 0) damage = Math.max(1, damage - 2);
        player.health = Math.max(0, player.health - damage);
        enemy.attackCooldown = night ? 20 : 24;
        this.addLog(`The Gloamtick strikes for ${damage}.`, "combat");
        if (player.health <= 0) {
          this.respawnPlayer();
          break;
        }
      }
    }
  }

  private playerAttack(enemy: EnemyState): void {
    const damage = 4 + ((this.state.tick + enemy.id.charCodeAt(enemy.id.length - 1)) % 3);
    enemy.health = Math.max(0, enemy.health - damage);
    this.state.player.attackCooldown = 14;
    this.addLog(`You hit the Gloamtick for ${damage}.`, "combat");
    if (enemy.health > 0) return;
    enemy.alive = false;
    enemy.aggro = false;
    enemy.respawnAtTick = this.state.tick + 260;
    this.state.player.combatTargetId = null;
    this.state.quest.gloamticksDefeated += 1;
    this.grantSkillXp("combat", 28);
    this.state.groundLoot.push({
      id: `loot-${enemy.id}-${this.state.tick}`,
      position: { ...enemy.position },
      itemId: "shellshard",
      quantity: 1,
      expiresAtTick: this.state.tick + 600,
    });
    this.addLog("Gloamtick defeated. It dropped a Shellshard.", "loot");
  }

  private moveEnemyToward(enemy: EnemyState, target: Vector2): void {
    const path = findPath(enemy.position, target);
    const next = path[0];
    if (!next) return;
    const dx = next.x - enemy.position.x;
    const dz = next.z - enemy.position.z;
    const magnitude = Math.hypot(dx, dz) || 1;
    const amount = this.state.dayPhase === "night" ? 0.22 : 0.19;
    const proposed = { x: enemy.position.x + (dx / magnitude) * amount, z: enemy.position.z + (dz / magnitude) * amount };
    if (isWalkable(proposed)) enemy.position = proposed;
  }

  private updateTask(): void {
    const task = this.state.activeTask;
    if (!task || this.state.tick < task.endsAtTick) return;
    this.state.activeTask = null;
    const node = this.state.resourceNodes.find((candidate) => candidate.id === task.targetId);
    if (!node?.available) return;
    if (node.kind === "ley-crystal") {
      if (!addItem(this.state.player.inventory, "raw-crystal", 1)) {
        this.addLog("Your inventory is full.", "system");
        return;
      }
      node.available = false;
      node.respawnAtTick = this.state.tick + 220;
      this.grantSkillXp("crystal-mining", 18);
      this.addLog("You chip free a Raw Crystal.", "loot");
      return;
    }
    if (!addItem(this.state.player.inventory, "glowreed", 1)) {
      this.addLog("Your inventory is full.", "system");
      return;
    }
    node.available = false;
    node.respawnAtTick = this.state.tick + 180;
    this.state.quest.glowreedGathered += 1;
    this.grantSkillXp("foraging", 16);
    this.addLog("You gather a strand of Glowreed.", "loot");
  }

  private updateRespawns(): void {
    for (const node of this.state.resourceNodes) {
      if (!node.available && this.state.tick >= node.respawnAtTick) node.available = true;
    }
    for (const enemy of this.state.enemies) {
      if (!enemy.alive && this.state.tick >= enemy.respawnAtTick) {
        enemy.alive = true;
        enemy.health = enemy.maxHealth;
        enemy.position = { ...enemy.spawn };
        enemy.aggro = this.state.dayPhase === "night";
      }
    }
    this.state.groundLoot = this.state.groundLoot.filter((loot) => loot.expiresAtTick > this.state.tick);
  }

  private updateCooldowns(): void {
    this.state.player.attackCooldown = Math.max(0, this.state.player.attackCooldown - 1);
    if (this.state.player.wardTicks > 0) this.state.player.wardTicks -= 1;
    for (const enemy of this.state.enemies) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - 1);
  }

  private updateQuestProgress(): void {
    if (
      this.state.quest.stage === "gather" &&
      this.state.quest.glowreedGathered >= 3 &&
      this.state.quest.gloamticksDefeated >= 1
    ) {
      this.state.quest.stage = "craft";
      this.addLog("Quest updated: craft Leycord at the Shrine Loom.", "quest");
    }
  }

  private openCuratorDialogue(): void {
    const stage = this.state.quest.stage;
    let pages: readonly string[] = DIALOGUE.complete;
    let outcome: DialogueState["outcome"] = "none";
    if (stage === "not-started") {
      pages = DIALOGUE.introduction;
      outcome = "accept-quest";
    } else if (stage === "gather") pages = DIALOGUE.gathering;
    else if (stage === "craft") pages = DIALOGUE.readyToCraft;
    else if (stage === "return") {
      pages = DIALOGUE.readyToReturn;
      outcome = "finish-quest";
    }
    this.state.dialogue = { speaker: "The Curator", pages: [...pages], page: 0, outcome };
    this.state.player.path = [];
  }

  private advanceDialogue(): void {
    const dialogue = this.state.dialogue;
    if (!dialogue) return;
    if (dialogue.page < dialogue.pages.length - 1) {
      dialogue.page += 1;
      return;
    }
    this.state.dialogue = null;
    if (dialogue.outcome === "accept-quest" && this.state.quest.stage === "not-started") {
      this.state.quest.stage = "gather";
      this.addLog("Quest started: Relight the Leyward.", "quest");
    } else if (dialogue.outcome === "finish-quest" && this.state.quest.stage === "return") {
      if (!removeItem(this.state.player.inventory, "leycord", 1)) return;
      this.state.quest.stage = "complete";
      addItem(this.state.player.inventory, "hearthloaf", 2);
      this.grantSkillXp("attunement", 50);
      this.addLog("Quest complete: the Leyward burns again!", "quest");
      this.addLog("Reward: 2 Hearthloaf and 50 Attunement XP.", "loot");
    }
  }

  private craft(recipeId: RecipeId): void {
    if (!this.state.craftingOpen) return;
    const recipe = RECIPES[recipeId];
    if (!recipe) return;
    for (const input of recipe.inputs) {
      if (countItem(this.state.player.inventory, input.itemId) < input.quantity) {
        this.addLog(`${recipe.name} requires ${input.quantity} ${this.itemLabel(input.itemId)}.`, "system");
        return;
      }
    }
    for (const input of recipe.inputs) {
      if (!removeItem(this.state.player.inventory, input.itemId, input.quantity)) return;
    }
    if (!addItem(this.state.player.inventory, recipe.output.itemId, recipe.output.quantity)) {
      for (const input of recipe.inputs) addItem(this.state.player.inventory, input.itemId, input.quantity);
      this.addLog("Your inventory is full.", "system");
      return;
    }
    this.grantSkillXp(recipe.skillId, recipe.xp);
    this.addLog(`You craft ${recipe.name}.`, "skill");
    if (this.state.quest.stage === "craft" && recipeId === "leycord") {
      this.state.quest.stage = "return";
      this.addLog("Quest updated: return to The Curator.", "quest");
    }
  }

  private useItem(itemId: ItemId): void {
    if (itemId === "hearthloaf") {
      if (this.state.player.health >= this.state.player.maxHealth) return;
      if (!removeItem(this.state.player.inventory, itemId, 1)) return;
      const restored = Math.min(10, this.state.player.maxHealth - this.state.player.health);
      this.state.player.health += restored;
      this.addLog(`You eat Hearthloaf and restore ${restored} health.`, "system");
      return;
    }
    if (itemId === "ward-charm") {
      if (!removeItem(this.state.player.inventory, itemId, 1)) return;
      this.state.player.wardTicks = 300; // 15s at 20 Hz
      this.addLog("Ward Charm activates — blows land softer for a while.", "skill");
    }
  }

  private bankDepositAll(): void {
    if (!this.state.bankOpen) return;
    const moved: ItemStack[] = [];
    for (const stack of [...this.state.player.inventory]) {
      if (addItem(this.state.player.bank, stack.itemId, stack.quantity, BANK_SLOTS)) {
        moved.push(stack);
        removeItem(this.state.player.inventory, stack.itemId, stack.quantity);
      }
    }
    this.addLog(moved.length ? `Deposited ${moved.length} stack(s) to the bank.` : "Bank is full or inventory empty.", "system");
  }

  private bankWithdrawAll(): void {
    if (!this.state.bankOpen) return;
    const moved: ItemStack[] = [];
    for (const stack of [...this.state.player.bank]) {
      if (addItem(this.state.player.inventory, stack.itemId, stack.quantity)) {
        moved.push(stack);
        removeItem(this.state.player.bank, stack.itemId, stack.quantity);
      }
    }
    this.addLog(moved.length ? `Withdrew ${moved.length} stack(s) from the bank.` : "Inventory full or bank empty.", "system");
  }

  private grantSkillXp(skillId: SkillId, amount: number): void {
    const skill = this.state.player.skills[skillId];
    if (!skill) return;
    const result = grantXp(skill, amount);
    this.addLog(`+${amount} ${titleCase(skillId)} XP`, "skill");
    if (result.current > result.previous) this.addLog(`${titleCase(skillId)} reached level ${result.current}!`, "skill");
  }

  private respawnPlayer(): void {
    this.state.player.health = this.state.player.maxHealth;
    this.state.player.position = { ...PLAYER_SPAWN };
    this.state.player.path = [];
    this.state.player.combatTargetId = null;
    this.pendingInteraction = null;
    for (const enemy of this.state.enemies) enemy.aggro = false;
    this.addLog("You wake beside the Emberfold hearth. Nothing was lost.", "system");
  }

  private setSetting(key: keyof GameSettings, value: boolean | number): void {
    if (key === "uiScale" || key === "cameraZoom") {
      this.state.settings[key] = clamp(Number(value), key === "uiScale" ? 0.8 : 0.7, key === "uiScale" ? 1.25 : 1.45);
      return;
    }
    if (typeof value === "boolean") this.state.settings[key] = value as never;
  }

  private findTargetPosition(targetId: string): Vector2 | null {
    const npc = this.state.npcs.find((candidate) => candidate.id === targetId);
    if (npc) return npc.position;
    const node = this.state.resourceNodes.find((candidate) => candidate.id === targetId);
    if (node) return node.position;
    const station = WORLD_STATIONS.find((candidate) => candidate.id === targetId);
    if (station) return station.position;
    const loot = this.state.groundLoot.find((candidate) => candidate.id === targetId);
    if (loot) return loot.position;
    const enemy = this.state.enemies.find((candidate) => candidate.id === targetId);
    if (enemy) return enemy.position;
    return null;
  }

  private itemLabel(itemId: ItemId): string {
    return ITEM_CATALOG[itemId]?.name ?? itemId;
  }

  private addLog(text: string, tone: LogTone): void {
    this.logSerial += 1;
    this.state.log.unshift({ id: this.logSerial, tick: this.state.tick, text, tone });
    if (this.state.log.length > 80) this.state.log.length = 80;
  }
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
