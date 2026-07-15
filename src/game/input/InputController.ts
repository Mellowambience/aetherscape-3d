export class InputController {
  private readonly keys = new Set<string>();

  constructor(
    private readonly callbacks: {
      onInteract: () => void;
      onToggleInventory: () => void;
      onToggleJournal: () => void;
      onToggleSettings: () => void;
      onCameraReset: () => void;
    },
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  getMovement(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) z -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) z += 1;
    return { x, z };
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    this.keys.add(event.code);
    if (event.code === "KeyE" || event.code === "Space") {
      event.preventDefault();
      this.callbacks.onInteract();
    } else if (event.code === "KeyI") this.callbacks.onToggleInventory();
    else if (event.code === "KeyJ") this.callbacks.onToggleJournal();
    else if (event.code === "Escape") this.callbacks.onToggleSettings();
    else if (event.code === "Home") this.callbacks.onCameraReset();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
  };
}
