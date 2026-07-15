import { describe, expect, it } from "vitest";
import { addItem, canAddItem, countItem, INVENTORY_SLOTS, removeItem } from "../game/simulation/inventory";
import { grantXp, levelFromXp, xpForLevel } from "../game/simulation/progression";
import type { ItemStack } from "../game/simulation/types";

describe("inventory", () => {
  it("stacks and counts items", () => {
    const inv: ItemStack[] = [];
    expect(addItem(inv, "glowreed", 5)).toBe(true);
    expect(countItem(inv, "glowreed")).toBe(5);
    expect(addItem(inv, "glowreed", 3)).toBe(true);
    expect(inv).toHaveLength(1);
    expect(countItem(inv, "glowreed")).toBe(8);
  });

  it("respects slot capacity", () => {
    const inv: ItemStack[] = [];
    for (let i = 0; i < INVENTORY_SLOTS; i += 1) addItem(inv, "shellshard", 1);
    // force unique stacks already full of different items isn't possible with 4 items;
    // fill with maxed glowreed stacks instead
    inv.length = 0;
    for (let i = 0; i < INVENTORY_SLOTS; i += 1) inv.push({ itemId: "glowreed", quantity: 99 });
    expect(canAddItem(inv, "leycord", 1)).toBe(false);
    expect(addItem(inv, "leycord", 1)).toBe(false);
  });

  it("removes from the end of stacks", () => {
    const inv: ItemStack[] = [
      { itemId: "glowreed", quantity: 2 },
      { itemId: "hearthloaf", quantity: 1 },
      { itemId: "glowreed", quantity: 3 },
    ];
    expect(removeItem(inv, "glowreed", 4)).toBe(true);
    expect(countItem(inv, "glowreed")).toBe(1);
  });
});

describe("progression", () => {
  it("maps xp to levels with the absorbed curve", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(49)).toBe(1);
    expect(levelFromXp(50)).toBe(2);
    expect(xpForLevel(2)).toBe(50);
  });

  it("grants xp and levels in place", () => {
    const skill = { xp: 40, level: 1 };
    const result = grantXp(skill, 20);
    expect(skill.xp).toBe(60);
    expect(skill.level).toBe(2);
    expect(result).toEqual({ previous: 1, current: 2 });
  });

  it("ignores negative grants", () => {
    const skill = { xp: 10, level: 1 };
    grantXp(skill, -5);
    expect(skill.xp).toBe(10);
  });
});
