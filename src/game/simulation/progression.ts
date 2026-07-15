import type { SkillId, SkillProgress } from "./types";

export const XP_BASE = 50;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / XP_BASE)) + 1);
}

export function xpForLevel(level: number): number {
  const normalized = Math.max(1, Math.floor(level));
  return (normalized - 1) ** 2 * XP_BASE;
}

export function createSkills(): Record<SkillId, SkillProgress> {
  return {
    combat: { xp: 0, level: 1 },
    foraging: { xp: 0, level: 1 },
    "crystal-mining": { xp: 0, level: 1 },
    attunement: { xp: 0, level: 1 },
  };
}

export function grantXp(skill: SkillProgress, amount: number): { previous: number; current: number } {
  const previous = skill.level;
  skill.xp += Math.max(0, amount);
  skill.level = levelFromXp(skill.xp);
  return { previous, current: skill.level };
}
