import { describe, expect, it } from "vitest";
import { SaveManager } from "../game/save/SaveManager";
import { createNewGame } from "../game/simulation/createState";
import { addItem } from "../game/simulation/inventory";

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe("SaveManager", () => {
  it("round-trips a save and strips transients", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const state = createNewGame("Nova", "capkin");
    state.player.path = [{ x: 1, z: 1 }];
    state.player.combatTargetId = "gloamtick-1";
    state.dialogue = { speaker: "x", pages: ["y"], page: 0, outcome: "none" };
    state.activeTask = { kind: "gather", targetId: "glowreed-1", startedAtTick: 1, endsAtTick: 10 };
    state.craftingOpen = true;
    addItem(state.player.inventory, "glowreed", 2);

    manager.save(state);
    const loaded = manager.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.name).toBe("Nova");
    expect(loaded!.player.path).toEqual([]);
    expect(loaded!.player.combatTargetId).toBeNull();
    expect(loaded!.dialogue).toBeNull();
    expect(loaded!.activeTask).toBeNull();
    expect(loaded!.craftingOpen).toBe(false);
    expect(loaded!.player.inventory[0]).toEqual({ itemId: "glowreed", quantity: 2 });
  });

  it("rejects invalid JSON shape", () => {
    const manager = new SaveManager(new MemoryStorage());
    expect(() => manager.parse("{}")).toThrow();
  });

  it("export and import preserve quest stage", () => {
    const manager = new SaveManager(new MemoryStorage());
    const state = createNewGame("Rin", "lume");
    state.quest.stage = "craft";
    const raw = manager.exportJson(state);
    const imported = manager.importJson(raw);
    expect(imported.quest.stage).toBe("craft");
  });
});
