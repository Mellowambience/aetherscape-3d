import { ITEM_CATALOG } from "../content/catalog";
import type { ItemId, ItemStack } from "./types";

export const INVENTORY_SLOTS = 20;
export const BANK_SLOTS = 40;

export function countItem(inventory: ItemStack[], itemId: ItemId): number {
  return inventory.filter((stack) => stack.itemId === itemId).reduce((sum, stack) => sum + stack.quantity, 0);
}

export function canAddItem(inventory: ItemStack[], itemId: ItemId, quantity: number, maxSlots = INVENTORY_SLOTS): boolean {
  const definition = ITEM_CATALOG[itemId];
  const spaceInStacks = inventory
    .filter((stack) => stack.itemId === itemId)
    .reduce((space, stack) => space + definition.stackLimit - stack.quantity, 0);
  const remaining = Math.max(0, quantity - spaceInStacks);
  return inventory.length + Math.ceil(remaining / definition.stackLimit) <= maxSlots;
}

export function addItem(inventory: ItemStack[], itemId: ItemId, quantity: number, maxSlots = INVENTORY_SLOTS): boolean {
  if (quantity <= 0 || !canAddItem(inventory, itemId, quantity, maxSlots)) return false;
  const definition = ITEM_CATALOG[itemId];
  let remaining = quantity;
  for (const stack of inventory) {
    if (stack.itemId !== itemId || stack.quantity >= definition.stackLimit) continue;
    const moved = Math.min(remaining, definition.stackLimit - stack.quantity);
    stack.quantity += moved;
    remaining -= moved;
    if (remaining === 0) return true;
  }
  while (remaining > 0) {
    const moved = Math.min(remaining, definition.stackLimit);
    inventory.push({ itemId, quantity: moved });
    remaining -= moved;
  }
  return true;
}

export function removeItem(inventory: ItemStack[], itemId: ItemId, quantity: number): boolean {
  if (quantity <= 0 || countItem(inventory, itemId) < quantity) return false;
  let remaining = quantity;
  for (let index = inventory.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const stack = inventory[index];
    if (stack.itemId !== itemId) continue;
    const moved = Math.min(remaining, stack.quantity);
    stack.quantity -= moved;
    remaining -= moved;
    if (stack.quantity === 0) inventory.splice(index, 1);
  }
  return true;
}
