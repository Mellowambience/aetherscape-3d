import { getTile, WORLD_HEIGHT, WORLD_WIDTH } from "../content/world";
import type { Vector2 } from "./types";

type Node = Vector2 & { g: number; f: number };

const key = (position: Vector2) => `${position.x},${position.z}`;
const heuristic = (a: Vector2, b: Vector2) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

function closestWalkable(destination: Vector2): Vector2 | null {
  const start = { x: Math.round(destination.x), z: Math.round(destination.z) };
  if (getTile(start.x, start.z)?.walkable) return start;
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const candidate = { x: start.x + dx, z: start.z + dz };
        if (getTile(candidate.x, candidate.z)?.walkable) return candidate;
      }
    }
  }
  return null;
}

export function findPath(from: Vector2, destination: Vector2): Vector2[] {
  const start = { x: Math.round(from.x), z: Math.round(from.z) };
  const goal = closestWalkable(destination);
  if (!goal || !getTile(start.x, start.z)?.walkable) return [];
  if (start.x === goal.x && start.z === goal.z) return [];

  const open = new Map<string, Node>();
  const closed = new Set<string>();
  const cameFrom = new Map<string, string>();
  const positions = new Map<string, Vector2>();
  const gScore = new Map<string, number>();
  const startKey = key(start);
  open.set(startKey, { ...start, g: 0, f: heuristic(start, goal) });
  positions.set(startKey, start);
  gScore.set(startKey, 0);

  const directions = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];

  while (open.size > 0) {
    let current: Node | undefined;
    let currentKey = "";
    for (const [candidateKey, candidate] of open) {
      if (!current || candidate.f < current.f || (candidate.f === current.f && candidate.g > current.g)) {
        current = candidate;
        currentKey = candidateKey;
      }
    }
    if (!current) break;
    if (current.x === goal.x && current.z === goal.z) {
      const path: Vector2[] = [goal];
      let trace = currentKey;
      while (cameFrom.has(trace)) {
        trace = cameFrom.get(trace) as string;
        const position = positions.get(trace);
        if (position && trace !== startKey) path.push(position);
      }
      return path.reverse();
    }

    open.delete(currentKey);
    closed.add(currentKey);
    for (const direction of directions) {
      const neighbor = { x: current.x + direction.x, z: current.z + direction.z };
      if (neighbor.x < 0 || neighbor.z < 0 || neighbor.x >= WORLD_WIDTH || neighbor.z >= WORLD_HEIGHT) continue;
      if (!getTile(neighbor.x, neighbor.z)?.walkable) continue;
      const neighborKey = key(neighbor);
      if (closed.has(neighborKey)) continue;
      const tentativeG = current.g + 1;
      if (tentativeG >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighborKey, currentKey);
      positions.set(neighborKey, neighbor);
      gScore.set(neighborKey, tentativeG);
      open.set(neighborKey, { ...neighbor, g: tentativeG, f: tentativeG + heuristic(neighbor, goal) });
    }
  }
  return [];
}

export function findAdjacentPath(from: Vector2, target: Vector2): Vector2[] {
  const options = [
    { x: target.x + 1, z: target.z },
    { x: target.x - 1, z: target.z },
    { x: target.x, z: target.z + 1 },
    { x: target.x, z: target.z - 1 },
  ].filter((candidate) => getTile(candidate.x, candidate.z)?.walkable);
  let best: Vector2[] = [];
  for (const option of options) {
    const candidate = findPath(from, option);
    if (candidate.length > 0 && (best.length === 0 || candidate.length < best.length)) best = candidate;
  }
  return best;
}
