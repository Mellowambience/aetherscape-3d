import { describe, expect, it } from "vitest";
import { findPath } from "../game/simulation/pathfinding";
import { PLAYER_SPAWN } from "../game/content/world";

describe("pathfinding", () => {
  it("finds a path from spawn toward the curator area", () => {
    const path = findPath(PLAYER_SPAWN, { x: 12, z: 13 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)).toEqual({ x: 12, z: 13 });
  });

  it("returns empty when already at destination tile", () => {
    expect(findPath({ x: 9, z: 17 }, { x: 9, z: 17 })).toEqual([]);
  });

  it("snaps blocked destinations to nearby walkable tiles", () => {
    const path = findPath(PLAYER_SPAWN, { x: 0, z: 0 });
    expect(path.length).toBeGreaterThan(0);
  });

  it("does not path into water columns", () => {
    const path = findPath({ x: 15, z: 12 }, { x: 20, z: 12 });
    expect(path.every((step) => !(step.x === 17 && step.z < 11))).toBe(true);
    expect(path.at(-1)?.x).toBeGreaterThan(17);
  });
});
