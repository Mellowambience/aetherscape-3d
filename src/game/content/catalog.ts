import type { ItemDefinition, ItemId, PaletteId, RecipeId, SkillId } from "../simulation/types";

export const ITEM_CATALOG: Record<ItemId, ItemDefinition> = {
  glowreed: {
    id: "glowreed",
    name: "Glowreed",
    description: "A soft reed that drinks ley-light from the hollow soil.",
    icon: "✦",
    stackLimit: 99,
  },
  leycord: {
    id: "leycord",
    name: "Leycord",
    description: "Three Glowreed strands braided into a ward-ready cord.",
    icon: "⌁",
    stackLimit: 20,
  },
  shellshard: {
    id: "shellshard",
    name: "Shellshard",
    description: "A chitin flake shed by a Gloamtick.",
    icon: "◆",
    stackLimit: 99,
  },
  hearthloaf: {
    id: "hearthloaf",
    name: "Hearthloaf",
    description: "The Curator's dense travel loaf. Restores 10 health when used.",
    icon: "◒",
    stackLimit: 10,
  },
  "raw-crystal": {
    id: "raw-crystal",
    name: "Raw Crystal",
    description: "Uncut ley-glass chipped from a ridge seam.",
    icon: "◇",
    stackLimit: 99,
  },
  "ward-charm": {
    id: "ward-charm",
    name: "Ward Charm",
    description: "Shellshard set in crystal. Use for ~15s of reduced damage.",
    icon: "◎",
    stackLimit: 10,
  },
};

export const PALETTES: Record<PaletteId, { label: string; cloth: string; accent: string }> = {
  lume: { label: "Lume", cloth: "#3a6f9f", accent: "#9ad7ff" },
  capkin: { label: "Capkin", cloth: "#9f6a4a", accent: "#f0c49a" },
  ember: { label: "Ember", cloth: "#9f493f", accent: "#f1b65d" },
  milo: { label: "Milo", cloth: "#456f55", accent: "#b8e07a" },
};

export const DIALOGUE = {
  introduction: [
    "The Leyward is dimming, traveler. Something is eating the light that binds Emberfold to the hollow.",
    "Cut three Glowreed strands east of the stream, and quiet one Gloamtick. The loom will not answer empty hands.",
    "Braid the strands into a Leycord at the Shrine Loom, then return it to me. We will feed the ward again.",
  ],
  gathering: [
    "Glowreed thrives on the amber ley-patch beyond the bridge. Gloamticks circle the southern ridge. Crystal seams glitter on the north stone.",
  ],
  readyToCraft: [
    "You hold enough light. Sit at the Shrine Loom and braid three Glowreed into a Leycord.",
  ],
  readyToReturn: [
    "That is fresh Leycord — I can feel the hum. Let me seat it in the ward housing.",
    "There. The hollow remembers itself. Take this bread, and walk the paths while the light holds. The bank chest by the storehouse will keep what you cannot carry.",
  ],
  complete: [
    "The Leyward burns because you chose to stay and work. When night falls, Gloamticks grow bold — a Ward Charm from crystal and shell helps.",
  ],
} as const;

export interface RecipeDef {
  id: RecipeId;
  name: string;
  inputs: Array<{ itemId: ItemId; quantity: number }>;
  output: { itemId: ItemId; quantity: number };
  skillId: SkillId;
  xp: number;
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  leycord: {
    id: "leycord",
    name: "Leycord",
    inputs: [{ itemId: "glowreed", quantity: 3 }],
    output: { itemId: "leycord", quantity: 1 },
    skillId: "attunement",
    xp: 30,
  },
  "ward-charm": {
    id: "ward-charm",
    name: "Ward Charm",
    inputs: [
      { itemId: "shellshard", quantity: 1 },
      { itemId: "raw-crystal", quantity: 1 },
    ],
    output: { itemId: "ward-charm", quantity: 1 },
    skillId: "attunement",
    xp: 22,
  },
};
