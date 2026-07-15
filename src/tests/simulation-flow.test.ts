import { describe, expect, it } from "vitest";
import { WORLD_NPCS, WORLD_RESOURCE_NODES, WORLD_STATIONS } from "../game/content/world";
import { createNewGame } from "../game/simulation/createState";
import { addItem, countItem } from "../game/simulation/inventory";
import { Simulation } from "../game/simulation/Simulation";
import { CYCLE_LENGTH_TICKS, DAY_LENGTH_TICKS } from "../game/simulation/types";

function runTicks(simulation: Simulation, count: number): void {
  for (let index = 0; index < count; index += 1) simulation.tick();
}

function finishDialogue(simulation: Simulation): void {
  let remainingPages = 10;
  while (simulation.getState().dialogue && remainingPages > 0) {
    simulation.dispatch({ type: "advance-dialogue" });
    simulation.tick();
    remainingPages -= 1;
  }
  expect(remainingPages).toBeGreaterThan(0);
  expect(simulation.getState().dialogue).toBeNull();
}

function gatherNode(simulation: Simulation, nodeId: string): void {
  const state = simulation.getState();
  const node = state.resourceNodes.find((candidate) => candidate.id === nodeId);
  expect(node).toBeDefined();
  state.player.position = { ...node!.position };
  simulation.dispatch({ type: "interact", targetId: nodeId });
  simulation.tick();
  expect(state.activeTask?.targetId).toBe(nodeId);

  let remainingTicks = 50;
  while (state.activeTask && remainingTicks > 0) {
    simulation.tick();
    remainingTicks -= 1;
  }
  expect(remainingTicks).toBeGreaterThan(0);
  expect(node!.available).toBe(false);
}

describe("deterministic simulation", () => {
  it("replays identical navigation inputs to identical state", () => {
    const first = new Simulation(createNewGame("Mira", "milo"));
    const second = new Simulation(createNewGame("Mira", "milo"));

    for (const simulation of [first, second]) {
      simulation.dispatch({ type: "navigate", destination: { x: 12, z: 17 } });
      runTicks(simulation, 60);
    }

    expect(first.getState().player.position).toEqual({ x: 12, z: 17 });
    expect(first.getState().player.path).toEqual([]);
    expect(second.getState()).toEqual(first.getState());
  });

  it("freezes world ticks while paused and resumes direct movement deterministically", () => {
    const simulation = new Simulation(createNewGame("Mira", "lume"));
    const state = simulation.getState();

    simulation.dispatch({ type: "set-pause", paused: true });
    simulation.tick();
    const pausedTick = state.tick;
    const pausedPosition = { ...state.player.position };
    simulation.setMoveIntent({ x: 1, z: 0 });
    runTicks(simulation, 5);

    expect(state.tick).toBe(pausedTick);
    expect(state.player.position).toEqual(pausedPosition);

    simulation.dispatch({ type: "set-pause", paused: false });
    simulation.tick();
    expect(state.tick).toBe(pausedTick + 1);
    expect(state.player.position.x).toBeGreaterThan(pausedPosition.x);
  });
});

describe("playable quest vertical slice", () => {
  it("accepts the quest, gathers, fights, loots, crafts, and earns the final reward", () => {
    const simulation = new Simulation(createNewGame("Aster", "ember"));
    const state = simulation.getState();
    const curator = WORLD_NPCS[0];

    state.player.position = { ...curator.position };
    simulation.dispatch({ type: "interact", targetId: curator.id });
    simulation.tick();
    expect(state.dialogue?.speaker).toBe("The Curator");
    finishDialogue(simulation);
    expect(state.quest.stage).toBe("gather");

    for (const node of WORLD_RESOURCE_NODES.filter((n) => n.kind === "glowreed").slice(0, 3)) {
      gatherNode(simulation, node.id);
    }
    expect(countItem(state.player.inventory, "glowreed")).toBe(3);
    expect(state.quest.glowreedGathered).toBe(3);
    expect(state.player.skills.foraging).toEqual({ xp: 48, level: 1 });

    const enemy = state.enemies[0];
    state.player.position = { ...enemy.position };
    simulation.dispatch({ type: "attack", enemyId: enemy.id });
    let combatTicks = 100;
    while (enemy.alive && combatTicks > 0) {
      simulation.tick();
      combatTicks -= 1;
    }

    expect(combatTicks).toBeGreaterThan(0);
    expect(enemy.alive).toBe(false);
    expect(state.quest.gloamticksDefeated).toBe(1);
    expect(state.player.skills.combat.xp).toBe(28);
    expect(state.quest.stage).toBe("craft");
    expect(state.groundLoot).toHaveLength(1);

    const lootId = state.groundLoot[0].id;
    simulation.dispatch({ type: "interact", targetId: lootId });
    simulation.tick();
    expect(countItem(state.player.inventory, "shellshard")).toBe(1);
    expect(state.groundLoot).toHaveLength(0);

    const loom = WORLD_STATIONS.find((station) => station.id === "shrine-loom");
    expect(loom).toBeDefined();
    state.player.position = { ...loom!.position };
    simulation.dispatch({ type: "interact", targetId: loom!.id });
    simulation.tick();
    expect(state.craftingOpen).toBe(true);

    simulation.dispatch({ type: "craft", recipeId: "leycord" });
    simulation.tick();
    expect(countItem(state.player.inventory, "glowreed")).toBe(0);
    expect(countItem(state.player.inventory, "leycord")).toBe(1);
    expect(state.player.skills.attunement).toEqual({ xp: 30, level: 1 });
    expect(state.quest.stage).toBe("return");

    simulation.dispatch({ type: "close-crafting" });
    simulation.tick();
    state.player.position = { ...curator.position };
    simulation.dispatch({ type: "interact", targetId: curator.id });
    simulation.tick();
    finishDialogue(simulation);

    expect(state.quest.stage).toBe("complete");
    expect(countItem(state.player.inventory, "leycord")).toBe(0);
    expect(countItem(state.player.inventory, "hearthloaf")).toBe(2);
    expect(state.player.skills.attunement).toEqual({ xp: 80, level: 2 });
    expect(state.log.some((entry) => entry.text === "Quest complete: the Leyward burns again!")).toBe(true);
  });
});

describe("evolved systems", () => {
  it("mines ley-crystal for raw-crystal and crystal-mining XP", () => {
    const simulation = new Simulation(createNewGame("Miner", "capkin"));
    const state = simulation.getState();
    const crystal = WORLD_RESOURCE_NODES.find((n) => n.kind === "ley-crystal");
    expect(crystal).toBeDefined();
    gatherNode(simulation, crystal!.id);
    expect(countItem(state.player.inventory, "raw-crystal")).toBe(1);
    expect(state.player.skills["crystal-mining"].xp).toBe(18);
  });

  it("crafts ward-charm and applies ward ticks on use", () => {
    const simulation = new Simulation(createNewGame("Warder", "lume"));
    const state = simulation.getState();
    addItem(state.player.inventory, "shellshard", 1);
    addItem(state.player.inventory, "raw-crystal", 1);
    state.craftingOpen = true;
    simulation.dispatch({ type: "craft", recipeId: "ward-charm" });
    simulation.tick();
    expect(countItem(state.player.inventory, "ward-charm")).toBe(1);
    simulation.dispatch({ type: "close-crafting" });
    simulation.tick();
    simulation.dispatch({ type: "use-item", itemId: "ward-charm" });
    simulation.tick();
    expect(countItem(state.player.inventory, "ward-charm")).toBe(0);
    expect(state.player.wardTicks).toBeGreaterThan(0);
  });

  it("banks deposit and withdraw all", () => {
    const simulation = new Simulation(createNewGame("Banker", "milo"));
    const state = simulation.getState();
    addItem(state.player.inventory, "glowreed", 5);
    const bank = WORLD_STATIONS.find((s) => s.id === "bank-chest");
    state.player.position = { ...bank!.position };
    simulation.dispatch({ type: "interact", targetId: "bank-chest" });
    simulation.tick();
    expect(state.bankOpen).toBe(true);
    simulation.dispatch({ type: "bank-deposit-all" });
    simulation.tick();
    expect(countItem(state.player.inventory, "glowreed")).toBe(0);
    expect(countItem(state.player.bank, "glowreed")).toBe(5);
    simulation.dispatch({ type: "bank-withdraw-all" });
    simulation.tick();
    expect(countItem(state.player.inventory, "glowreed")).toBe(5);
    expect(countItem(state.player.bank, "glowreed")).toBe(0);
  });

  it("transitions day to night after DAY_LENGTH_TICKS", () => {
    const simulation = new Simulation(createNewGame("Night", "ember"));
    const state = simulation.getState();
    expect(state.dayPhase).toBe("day");
    runTicks(simulation, DAY_LENGTH_TICKS);
    expect(state.dayPhase).toBe("night");
    runTicks(simulation, CYCLE_LENGTH_TICKS - DAY_LENGTH_TICKS);
    expect(state.dayPhase).toBe("day");
  });
});
