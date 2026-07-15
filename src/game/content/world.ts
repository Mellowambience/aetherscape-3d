import type { Vector2 } from "../simulation/types";

export type TileKind = "moss" | "path" | "water" | "stone" | "bridge" | "ley";

export interface TileDefinition {
  x: number;
  z: number;
  kind: TileKind;
  height: number;
  walkable: boolean;
}

export const WORLD_WIDTH = 32;
export const WORLD_HEIGHT = 24;
export const REGION_NAME = "Ley-Root Hollow";
export const HUB_NAME = "Emberfold";
export const PLAYER_SPAWN: Vector2 = { x: 9, z: 17 };

export const WORLD_NPCS = [
  { id: "curator", name: "The Curator", role: "Leyward Keeper", position: { x: 12, z: 13 } },
] as const;

export const WORLD_RESOURCE_NODES = [
  { id: "glowreed-1", kind: "glowreed" as const, position: { x: 21, z: 6 } },
  { id: "glowreed-2", kind: "glowreed" as const, position: { x: 23, z: 5 } },
  { id: "glowreed-3", kind: "glowreed" as const, position: { x: 25, z: 8 } },
  { id: "glowreed-4", kind: "glowreed" as const, position: { x: 27, z: 6 } },
  { id: "glowreed-5", kind: "glowreed" as const, position: { x: 22, z: 11 } },
  { id: "crystal-1", kind: "ley-crystal" as const, position: { x: 28, z: 3 } },
  { id: "crystal-2", kind: "ley-crystal" as const, position: { x: 29, z: 2 } },
  { id: "crystal-3", kind: "ley-crystal" as const, position: { x: 30, z: 4 } },
] as const;

export const WORLD_ENEMIES = [
  { id: "gloamtick-1", kind: "gloamtick" as const, position: { x: 24, z: 18 } },
  { id: "gloamtick-2", kind: "gloamtick" as const, position: { x: 28, z: 20 } },
  { id: "gloamtick-3", kind: "gloamtick" as const, position: { x: 26, z: 16 } },
] as const;

export const WORLD_STATIONS = [
  { id: "shrine-loom", kind: "shrine-loom" as const, position: { x: 15, z: 13 } },
  { id: "leyward", kind: "leyward" as const, position: { x: 6, z: 12 } },
  { id: "bank-chest", kind: "bank-chest" as const, position: { x: 5, z: 16 } },
] as const;

export const BUILDINGS = [
  { id: "curator-house", x: 11, z: 9, width: 4, depth: 3, wall: "#4a3a5c", roof: "#1e2a38" },
  { id: "storehouse", x: 4, z: 15, width: 3, depth: 3, wall: "#3d4a3a", roof: "#2a2230" },
] as const;

export const DECORATIONS = [
  { kind: "tree" as const, x: 2, z: 4, blocking: true },
  { kind: "tree" as const, x: 4, z: 3, blocking: true },
  { kind: "tree" as const, x: 7, z: 3, blocking: true },
  { kind: "tree" as const, x: 14, z: 4, blocking: true },
  { kind: "tree" as const, x: 19, z: 2, blocking: true },
  { kind: "tree" as const, x: 26, z: 3, blocking: false },
  { kind: "tree" as const, x: 2, z: 21, blocking: true },
  { kind: "tree" as const, x: 7, z: 22, blocking: true },
  { kind: "tree" as const, x: 14, z: 21, blocking: true },
  { kind: "tree" as const, x: 19, z: 22, blocking: true },
  { kind: "rock" as const, x: 29, z: 13, blocking: true },
  { kind: "rock" as const, x: 26, z: 15, blocking: true },
  { kind: "crystal" as const, x: 18, z: 19, blocking: true },
  { kind: "crystal" as const, x: 30, z: 17, blocking: true },
] as const;

const key = (x: number, z: number) => `${x},${z}`;

function makeTiles(): TileDefinition[] {
  const blocked = new Set<string>();
  for (const building of BUILDINGS) {
    for (let x = building.x; x < building.x + building.width; x += 1) {
      for (let z = building.z; z < building.z + building.depth; z += 1) blocked.add(key(x, z));
    }
  }
  for (const decoration of DECORATIONS) {
    if (decoration.blocking) blocked.add(key(decoration.x, decoration.z));
  }

  const tiles: TileDefinition[] = [];
  for (let z = 0; z < WORLD_HEIGHT; z += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const edge = x === 0 || z === 0 || x === WORLD_WIDTH - 1 || z === WORLD_HEIGHT - 1;
      const stream = (x === 17 || x === 18) && !(z >= 11 && z <= 13);
      const pool = x >= 1 && x <= 4 && z >= 8 && z <= 11;
      const bridge = (x === 17 || x === 18) && z >= 11 && z <= 13;
      const path =
        (z >= 12 && z <= 14 && x >= 5 && x <= 25) ||
        (x >= 8 && x <= 13 && z >= 12 && z <= 19);
      const leyPatch = x >= 20 && x <= 27 && z >= 4 && z <= 10 && !stream;
      const water = edge || stream || pool;
      const stone = (x >= 28 && z <= 4) || (x <= 2 && z >= 18);
      let kind: TileKind = "moss";
      if (water) kind = "water";
      else if (bridge) kind = "bridge";
      else if (stone) kind = "stone";
      else if (leyPatch) kind = "ley";
      else if (path) kind = "path";
      const walkable = !water && !blocked.has(key(x, z));
      const variation = kind === "moss" || kind === "ley" ? (((x * 19 + z * 29) % 9) - 4) * 0.008 : 0;
      tiles.push({ x, z, kind, walkable, height: water ? -0.18 : variation });
    }
  }
  return tiles;
}

export const WORLD_TILES = makeTiles();
const TILE_LOOKUP = new Map(WORLD_TILES.map((tile) => [key(tile.x, tile.z), tile]));

export function getTile(x: number, z: number): TileDefinition | undefined {
  return TILE_LOOKUP.get(key(x, z));
}

export function isWalkable(position: Vector2): boolean {
  const x = Math.round(position.x);
  const z = Math.round(position.z);
  return TILE_LOOKUP.get(key(x, z))?.walkable ?? false;
}
