import { ITEM_CATALOG, PALETTES, RECIPES } from "../game/content/catalog";
import type { ContextHint } from "../game/simulation/Simulation";
import type { GameSettings, GameState, ItemId, PaletteId, RecipeId } from "../game/simulation/types";

export interface UICallbacks {
  onStartCharacter: (name: string, palette: PaletteId) => void;
  onContinue: () => void;
  onInteract: () => void;
  onAdvanceDialogue: () => void;
  onCraft: (recipeId: RecipeId) => void;
  onCloseCrafting: () => void;
  onCloseBank: () => void;
  onBankDepositAll: () => void;
  onBankWithdrawAll: () => void;
  onUseItem: (itemId: ItemId) => void;
  onSetting: (key: keyof GameSettings, value: boolean | number) => void;
  onPauseChange: (paused: boolean) => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: (raw: string) => void;
  onReset: () => void;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export class UIController {
  private inventoryOpen = false;
  private journalOpen = false;
  private settingsOpen = false;
  private toastTimer = 0;

  constructor(private readonly callbacks: UICallbacks) {
    this.bindBoot();
    this.bindPanels();
  }

  configureBoot(save: GameState | null): void {
    const continueBtn = el<HTMLButtonElement>("continue-btn");
    continueBtn.disabled = !save;
    continueBtn.textContent = save ? `Continue as ${save.player.name}` : "No local save";
    el<HTMLElement>("boot").hidden = false;
    el<HTMLElement>("hud").hidden = true;
  }

  enterGame(): void {
    el<HTMLElement>("boot").hidden = true;
    el<HTMLElement>("hud").hidden = false;
  }

  showBootMessage(message: string): void {
    el<HTMLElement>("boot-message").textContent = message;
  }

  showToast(message: string): void {
    const toast = el<HTMLElement>("toast");
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  }

  toggleInventory(): void {
    this.inventoryOpen = !this.inventoryOpen;
    el<HTMLElement>("panel-inventory").hidden = !this.inventoryOpen;
  }

  toggleJournal(): void {
    this.journalOpen = !this.journalOpen;
    el<HTMLElement>("panel-journal").hidden = !this.journalOpen;
  }

  toggleSettings(): void {
    if (!el<HTMLElement>("panel-craft").hidden) {
      this.callbacks.onCloseCrafting();
      return;
    }
    if (!el<HTMLElement>("panel-bank").hidden) {
      this.callbacks.onCloseBank();
      return;
    }
    this.settingsOpen = !this.settingsOpen;
    el<HTMLElement>("panel-settings").hidden = !this.settingsOpen;
    this.callbacks.onPauseChange(this.settingsOpen);
  }

  closeAllOverlays(): void {
    this.inventoryOpen = false;
    this.journalOpen = false;
    this.settingsOpen = false;
    el<HTMLElement>("panel-inventory").hidden = true;
    el<HTMLElement>("panel-journal").hidden = true;
    el<HTMLElement>("panel-settings").hidden = true;
    el<HTMLElement>("panel-dialogue").hidden = true;
    el<HTMLElement>("panel-craft").hidden = true;
    el<HTMLElement>("panel-bank").hidden = true;
  }

  render(state: GameState, hint: ContextHint | null, taskProgress: number | null, objective: { title: string; detail: string }): void {
    el<HTMLElement>("player-name").textContent = state.player.name;
    el<HTMLElement>("health-fill").style.width = `${(state.player.health / state.player.maxHealth) * 100}%`;
    const ward = state.player.wardTicks > 0 ? ` · ward ${Math.ceil(state.player.wardTicks / 20)}s` : "";
    el<HTMLElement>("health-text").textContent = `${state.player.health}/${state.player.maxHealth}${ward}`;
    el<HTMLElement>("objective-title").textContent = objective.title;
    el<HTMLElement>("objective-detail").textContent = objective.detail;
    el<HTMLElement>("day-phase").textContent = state.dayPhase === "night" ? "Night" : "Day";
    el<HTMLElement>("day-phase").dataset.phase = state.dayPhase;

    const prompt = el<HTMLElement>("interact-prompt");
    if (hint) {
      prompt.hidden = false;
      prompt.textContent = `[E] ${hint.label}`;
    } else {
      prompt.hidden = true;
    }

    const bar = el<HTMLElement>("task-bar");
    const fill = el<HTMLElement>("task-fill");
    if (taskProgress === null) {
      bar.hidden = true;
    } else {
      bar.hidden = false;
      fill.style.width = `${taskProgress * 100}%`;
    }

    const log = el<HTMLElement>("event-log");
    log.innerHTML = state.log
      .slice(0, 8)
      .map((entry) => `<div class="log-line tone-${entry.tone}">${escapeHtml(entry.text)}</div>`)
      .join("");

    this.renderMinimap(state);
    this.renderInventory(state);
    this.renderSkills(state);
    this.renderJournal(state);
    this.renderDialogue(state);
    this.renderCraft(state);
    this.renderBank(state);
    this.renderSettings(state);
  }

  private bindBoot(): void {
    const paletteRow = el<HTMLElement>("palette-row");
    paletteRow.innerHTML = (Object.keys(PALETTES) as PaletteId[])
      .map(
        (id, index) =>
          `<button type="button" class="palette-btn${index === 0 ? " active" : ""}" data-palette="${id}" style="--cloth:${PALETTES[id].cloth};--accent:${PALETTES[id].accent}">${PALETTES[id].label}</button>`,
      )
      .join("");
    let selected: PaletteId = "lume";
    paletteRow.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-palette]");
      if (!target) return;
      selected = target.dataset.palette as PaletteId;
      for (const button of paletteRow.querySelectorAll(".palette-btn")) button.classList.remove("active");
      target.classList.add("active");
    });
    el<HTMLButtonElement>("start-btn").addEventListener("click", () => {
      const name = el<HTMLInputElement>("name-input").value;
      this.callbacks.onStartCharacter(name, selected);
    });
    el<HTMLButtonElement>("continue-btn").addEventListener("click", () => this.callbacks.onContinue());
  }

  private bindPanels(): void {
    el<HTMLElement>("interact-prompt").addEventListener("click", () => this.callbacks.onInteract());
    el<HTMLButtonElement>("dialogue-next").addEventListener("click", () => this.callbacks.onAdvanceDialogue());
    el<HTMLElement>("craft-list").addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-recipe]");
      if (!btn) return;
      this.callbacks.onCraft(btn.dataset.recipe as RecipeId);
    });
    el<HTMLButtonElement>("craft-close").addEventListener("click", () => this.callbacks.onCloseCrafting());
    el<HTMLButtonElement>("bank-deposit").addEventListener("click", () => this.callbacks.onBankDepositAll());
    el<HTMLButtonElement>("bank-withdraw").addEventListener("click", () => this.callbacks.onBankWithdrawAll());
    el<HTMLButtonElement>("bank-close").addEventListener("click", () => this.callbacks.onCloseBank());
    el<HTMLButtonElement>("save-btn").addEventListener("click", () => this.callbacks.onSave());
    el<HTMLButtonElement>("load-btn").addEventListener("click", () => this.callbacks.onLoad());
    el<HTMLButtonElement>("export-btn").addEventListener("click", () => this.callbacks.onExport());
    el<HTMLButtonElement>("reset-btn").addEventListener("click", () => this.callbacks.onReset());
    el<HTMLInputElement>("import-input").addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.callbacks.onImport(await file.text());
      (event.target as HTMLInputElement).value = "";
    });
    el<HTMLElement>("settings-form").addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      const key = target.dataset.setting as keyof GameSettings | undefined;
      if (!key) return;
      if (target.type === "checkbox") this.callbacks.onSetting(key, target.checked);
      else this.callbacks.onSetting(key, Number(target.value));
    });
  }

  private renderMinimap(state: GameState): void {
    const canvas = el<HTMLCanvasElement>("minimap");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scaleX = canvas.width / 32;
    const scaleY = canvas.height / 24;
    ctx.fillStyle = state.dayPhase === "night" ? "#060a14" : "#101828";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#3d5a45";
    ctx.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.fillStyle = "#9ad7ff";
    ctx.fillRect(state.player.position.x * scaleX - 2, state.player.position.z * scaleY - 2, 4, 4);
    ctx.fillStyle = "#f0d080";
    for (const npc of state.npcs) ctx.fillRect(npc.position.x * scaleX - 2, npc.position.z * scaleY - 2, 4, 4);
    ctx.fillStyle = "#ff6a9a";
    for (const enemy of state.enemies.filter((e) => e.alive)) {
      ctx.fillRect(enemy.position.x * scaleX - 2, enemy.position.z * scaleY - 2, 4, 4);
    }
    ctx.fillStyle = "#7ad0ff";
    for (const node of state.resourceNodes.filter((n) => n.available && n.kind === "glowreed")) {
      ctx.fillRect(node.position.x * scaleX - 1.5, node.position.z * scaleY - 1.5, 3, 3);
    }
    ctx.fillStyle = "#c0e8ff";
    for (const node of state.resourceNodes.filter((n) => n.available && n.kind === "ley-crystal")) {
      ctx.fillRect(node.position.x * scaleX - 1.5, node.position.z * scaleY - 1.5, 3, 3);
    }
  }

  private renderInventory(state: GameState): void {
    const root = el<HTMLElement>("inventory-grid");
    root.innerHTML = state.player.inventory
      .map((stack) => {
        const def = ITEM_CATALOG[stack.itemId];
        const usable = stack.itemId === "hearthloaf" || stack.itemId === "ward-charm" ? ' data-use="1"' : "";
        return `<button type="button" class="inv-slot"${usable} data-item="${stack.itemId}" title="${escapeHtml(def.description)}"><span class="icon">${def.icon}</span><span class="name">${escapeHtml(def.name)}</span><span class="qty">×${stack.quantity}</span></button>`;
      })
      .join("");
    root.onclick = (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-item][data-use]");
      if (!button) return;
      this.callbacks.onUseItem(button.dataset.item as ItemId);
    };
  }

  private renderSkills(state: GameState): void {
    const root = el<HTMLElement>("skills-list");
    root.innerHTML = (Object.keys(state.player.skills) as Array<keyof typeof state.player.skills>)
      .map((id) => {
        const skill = state.player.skills[id];
        return `<div class="skill-row"><span>${id}</span><span>Lv ${skill.level}</span><span>${skill.xp} xp</span></div>`;
      })
      .join("");
  }

  private renderJournal(state: GameState): void {
    el<HTMLElement>("journal-body").innerHTML = `<h3>${escapeHtml(state.quest.title)}</h3><p>Stage: <strong>${escapeHtml(state.quest.stage)}</strong></p><p>Glowreed gathered: ${state.quest.glowreedGathered}/3</p><p>Gloamticks defeated: ${state.quest.gloamticksDefeated}/1</p><p class="muted">Side: mine crystals · craft Ward Charm · use bank chest</p>`;
  }

  private renderDialogue(state: GameState): void {
    const panel = el<HTMLElement>("panel-dialogue");
    if (!state.dialogue) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    el<HTMLElement>("dialogue-speaker").textContent = state.dialogue.speaker;
    el<HTMLElement>("dialogue-text").textContent = state.dialogue.pages[state.dialogue.page] ?? "";
    el<HTMLButtonElement>("dialogue-next").textContent =
      state.dialogue.page < state.dialogue.pages.length - 1 ? "Continue" : "Done";
  }

  private renderCraft(state: GameState): void {
    const panel = el<HTMLElement>("panel-craft");
    panel.hidden = !state.craftingOpen;
    if (!state.craftingOpen) return;
    el<HTMLElement>("craft-list").innerHTML = Object.values(RECIPES)
      .map((recipe) => {
        const needs = recipe.inputs.map((i) => `${i.quantity}× ${ITEM_CATALOG[i.itemId].name}`).join(" + ");
        return `<button type="button" data-recipe="${recipe.id}">Craft ${escapeHtml(recipe.name)} <span class="muted">(${escapeHtml(needs)})</span></button>`;
      })
      .join("");
  }

  private renderBank(state: GameState): void {
    const panel = el<HTMLElement>("panel-bank");
    panel.hidden = !state.bankOpen;
    if (!state.bankOpen) return;
    el<HTMLElement>("bank-body").innerHTML =
      state.player.bank.length === 0
        ? `<p class="muted">Bank is empty.</p>`
        : state.player.bank
            .map((stack) => {
              const def = ITEM_CATALOG[stack.itemId];
              return `<div class="skill-row"><span>${def.icon} ${escapeHtml(def.name)}</span><span>×${stack.quantity}</span></div>`;
            })
            .join("");
  }

  private renderSettings(state: GameState): void {
    const form = el<HTMLElement>("settings-form");
    for (const input of form.querySelectorAll<HTMLInputElement>("[data-setting]")) {
      const key = input.dataset.setting as keyof GameSettings;
      const value = state.settings[key];
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = String(value);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
