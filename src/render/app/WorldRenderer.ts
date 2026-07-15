import * as THREE from "three";
import {
  BUILDINGS,
  DECORATIONS,
  WORLD_HEIGHT,
  WORLD_STATIONS,
  WORLD_TILES,
  WORLD_WIDTH,
  type TileKind,
} from "../../game/content/world";
import type { GameState, Vector2 } from "../../game/simulation/types";
import {
  createBuilding,
  createCharacter,
  createDecoration,
  createGloamtick,
  createGlowreed,
  createLeyCrystalNode,
  createLeyward,
  createLootMarker,
  createBankChest,
  createShrineLoom,
  createTextSprite,
} from "../objects/factories";

export interface RendererCallbacks {
  onGroundClick(position: Vector2): void;
  onEntityClick(entityId: string, entityKind: string): void;
  onZoomChange(zoom: number): void;
  onContextStatus(message: string): void;
}

const TILE_COLORS: Record<TileKind, string> = {
  moss: "#3d5a45",
  path: "#7a6a52",
  water: "#2a4a68",
  stone: "#5a5f68",
  bridge: "#8a7048",
  ley: "#4a6a58",
};

export class WorldRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 120);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly groundPicker: THREE.Mesh;
  private readonly grid: THREE.LineSegments;
  private readonly playerObject: THREE.Group;
  private readonly npcObjects = new Map<string, THREE.Group>();
  private readonly nodeObjects = new Map<string, THREE.Group>();
  private readonly enemyObjects = new Map<string, THREE.Group>();
  private readonly lootObjects = new Map<string, THREE.Group>();
  private readonly interactiveRoots: THREE.Object3D[] = [];
  private readonly selectionRing: THREE.Mesh;
  private readonly leyward: THREE.Group;
  private cameraAngle = Math.PI * 0.23;
  private cameraZoom = 1;
  private rightDragging = false;
  private pointerStart = { x: 0, y: 0 };
  private pointerPrevious = { x: 0, y: 0 };
  private lastPlayerPosition: Vector2;
  private disposed = false;
  private readonly resizeBound = () => this.resize();

  constructor(
    private readonly container: HTMLElement,
    initialState: GameState,
    private readonly callbacks: RendererCallbacks,
  ) {
    this.scene.background = new THREE.Color("#12182a");
    this.scene.fog = new THREE.FogExp2("#1a2038", 0.024);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = "world-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Playable three-dimensional view of Ley-Root Hollow");
    this.container.appendChild(this.renderer.domElement);

    this.addLighting();
    this.addTerrain();
    this.grid = this.createGrid();
    this.scene.add(this.grid);
    this.addEnvironment();

    this.playerObject = createCharacter(initialState.player.palette);
    this.playerObject.position.set(initialState.player.position.x, 0.04, initialState.player.position.z);
    this.scene.add(this.playerObject);
    this.lastPlayerPosition = { ...initialState.player.position };

    for (const npc of initialState.npcs) {
      const object = createCharacter("lume", npc.id, true);
      object.position.set(npc.position.x, 0.04, npc.position.z);
      const label = createTextSprite(`${npc.name} · ${npc.role}`);
      label.position.y = 2.38;
      object.add(label);
      this.npcObjects.set(npc.id, object);
      this.interactiveRoots.push(object);
      this.scene.add(object);
    }
    for (const node of initialState.resourceNodes) {
      const object = node.kind === "ley-crystal" ? createLeyCrystalNode(node.id) : createGlowreed(node.id);
      object.position.set(node.position.x, 0.04, node.position.z);
      this.nodeObjects.set(node.id, object);
      this.interactiveRoots.push(object);
      this.scene.add(object);
    }
    for (const enemy of initialState.enemies) {
      const object = createGloamtick(enemy.id);
      object.position.set(enemy.position.x, 0.04, enemy.position.z);
      this.enemyObjects.set(enemy.id, object);
      this.interactiveRoots.push(object);
      this.scene.add(object);
    }

    const loom = createShrineLoom();
    const loomPosition = WORLD_STATIONS.find((station) => station.id === "shrine-loom")?.position ?? { x: 15, z: 13 };
    loom.position.set(loomPosition.x, 0.04, loomPosition.z);
    this.interactiveRoots.push(loom);
    this.scene.add(loom);

    const bank = createBankChest();
    const bankPosition = WORLD_STATIONS.find((station) => station.id === "bank-chest")?.position ?? { x: 5, z: 16 };
    bank.position.set(bankPosition.x, 0.04, bankPosition.z);
    this.interactiveRoots.push(bank);
    this.scene.add(bank);

    this.leyward = createLeyward();
    const leywardPosition = WORLD_STATIONS.find((station) => station.id === "leyward")?.position ?? { x: 6, z: 12 };
    this.leyward.position.set(leywardPosition.x, 0.04, leywardPosition.z);
    this.interactiveRoots.push(this.leyward);
    this.scene.add(this.leyward);

    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.69, 28),
      new THREE.MeshBasicMaterial({ color: "#9ad7ff", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.075;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    this.groundPicker = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_HEIGHT),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.groundPicker.rotation.x = -Math.PI / 2;
    this.groundPicker.position.set((WORLD_WIDTH - 1) / 2, 0.09, (WORLD_HEIGHT - 1) / 2);
    this.scene.add(this.groundPicker);

    this.bindEvents();
    this.applyStateSettings(initialState);
    this.resize();
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  cameraRelativeMovement(raw: Vector2): Vector2 {
    const cosine = Math.cos(this.cameraAngle);
    const sine = Math.sin(this.cameraAngle);
    return {
      x: raw.x * cosine + raw.z * sine,
      z: -raw.x * sine + raw.z * cosine,
    };
  }

  resetCamera(): void {
    this.cameraAngle = Math.PI * 0.23;
    this.cameraZoom = 1;
    this.callbacks.onZoomChange(this.cameraZoom);
  }

  render(state: GameState): void {
    if (this.disposed) return;
    const elapsed = this.clock.getElapsedTime();
    this.applyStateSettings(state);
    this.syncLoot(state);

    const dx = state.player.position.x - this.lastPlayerPosition.x;
    const dz = state.player.position.z - this.lastPlayerPosition.z;
    if (Math.hypot(dx, dz) > 0.002) this.playerObject.rotation.y = Math.atan2(dx, dz) + Math.PI;
    this.lastPlayerPosition = { ...state.player.position };
    this.playerObject.position.set(state.player.position.x, 0.04, state.player.position.z);
    if (!state.settings.reducedMotion) {
      this.playerObject.position.y += Math.sin(elapsed * 8) * (Math.hypot(dx, dz) > 0.002 ? 0.025 : 0.008);
    }

    for (const node of state.resourceNodes) {
      const object = this.nodeObjects.get(node.id);
      if (!object) continue;
      object.visible = node.available;
      if (node.available && !state.settings.reducedMotion) object.rotation.y = Math.sin(elapsed * 0.8 + node.position.x) * 0.08;
    }
    for (const enemy of state.enemies) {
      const object = this.enemyObjects.get(enemy.id);
      if (!object) continue;
      object.visible = enemy.alive;
      object.position.set(enemy.position.x, 0.04, enemy.position.z);
      if (enemy.aggro) object.lookAt(state.player.position.x, 0.35, state.player.position.z);
      if (enemy.alive && !state.settings.reducedMotion) object.position.y += Math.sin(elapsed * 5 + enemy.position.x) * 0.018;
    }
    for (const loot of state.groundLoot) {
      const object = this.lootObjects.get(loot.id);
      if (!object) continue;
      object.position.set(loot.position.x, 0.04 + (state.settings.reducedMotion ? 0 : Math.sin(elapsed * 3) * 0.06), loot.position.z);
      if (!state.settings.reducedMotion) object.rotation.y = elapsed * 0.8;
    }

    this.updateSelection(state, elapsed);
    this.updateLeyward(state.quest.stage === "complete", elapsed, state.settings.reducedMotion);
    this.applyDayNight(state.dayPhase);
    this.updateCamera(state.player.position);
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const viewHeight = 17 / this.cameraZoom;
    this.camera.left = (-viewHeight * aspect) / 2;
    this.camera.right = (viewHeight * aspect) / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("resize", this.resizeBound);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    canvas.removeEventListener("wheel", this.onWheel);
    canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const entry of materials) entry.dispose();
      }
    });
    this.renderer.dispose();
    canvas.remove();
  }

  private addLighting(): void {
    const hemisphere = new THREE.HemisphereLight("#b8c8e8", "#1a1828", 1.7);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight("#ffd9a8", 2.2);
    sun.position.set(-10, 24, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.bias = -0.00035;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight("#7a68c9", 0.85);
    rim.position.set(12, 8, -10);
    this.scene.add(rim);
  }

  private addTerrain(): void {
    for (const tile of WORLD_TILES) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.18, 0.98),
        new THREE.MeshStandardMaterial({ color: TILE_COLORS[tile.kind], roughness: 0.88 }),
      );
      mesh.position.set(tile.x, tile.height, tile.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  private createGrid(): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let x = 0; x <= WORLD_WIDTH; x += 1) {
      positions.push(x - 0.5, 0.12, -0.5, x - 0.5, 0.12, WORLD_HEIGHT - 0.5);
    }
    for (let z = 0; z <= WORLD_HEIGHT; z += 1) {
      positions.push(-0.5, 0.12, z - 0.5, WORLD_WIDTH - 0.5, 0.12, z - 0.5);
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: "#6a90b8", transparent: true, opacity: 0.28 });
    const lines = new THREE.LineSegments(geometry, material);
    lines.visible = false;
    return lines;
  }

  private addEnvironment(): void {
    for (const building of BUILDINGS) {
      const object = createBuilding(building.width, building.depth, building.wall, building.roof);
      object.position.set(building.x, 0, building.z);
      this.scene.add(object);
    }
    for (const decoration of DECORATIONS) {
      const object = createDecoration(decoration.kind);
      object.position.set(decoration.x, 0, decoration.z);
      this.scene.add(object);
    }
  }

  private syncLoot(state: GameState): void {
    const live = new Set(state.groundLoot.map((loot) => loot.id));
    for (const [id, object] of this.lootObjects) {
      if (live.has(id)) continue;
      this.scene.remove(object);
      this.lootObjects.delete(id);
      const index = this.interactiveRoots.indexOf(object);
      if (index >= 0) this.interactiveRoots.splice(index, 1);
    }
    for (const loot of state.groundLoot) {
      if (this.lootObjects.has(loot.id)) continue;
      const object = createLootMarker(loot.id);
      object.position.set(loot.position.x, 0.04, loot.position.z);
      this.lootObjects.set(loot.id, object);
      this.interactiveRoots.push(object);
      this.scene.add(object);
    }
  }

  private updateSelection(state: GameState, elapsed: number): void {
    const targetId = state.player.combatTargetId;
    if (!targetId) {
      this.selectionRing.visible = false;
      return;
    }
    const enemy = state.enemies.find((candidate) => candidate.id === targetId && candidate.alive);
    if (!enemy) {
      this.selectionRing.visible = false;
      return;
    }
    this.selectionRing.visible = true;
    this.selectionRing.position.x = enemy.position.x;
    this.selectionRing.position.z = enemy.position.z;
    this.selectionRing.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.05);
  }

  private updateLeyward(active: boolean, elapsed: number, reducedMotion: boolean): void {
    const core = this.leyward.getObjectByName("leyward-core");
    if (!(core instanceof THREE.Mesh) || !(core.material instanceof THREE.MeshStandardMaterial)) return;
    if (active) {
      core.material.emissiveIntensity = reducedMotion ? 1.1 : 0.9 + Math.sin(elapsed * 3) * 0.35;
      core.material.color.set("#f0d080");
      core.material.emissive.set("#f0b040");
    } else {
      core.material.emissiveIntensity = 0.25;
      core.material.color.set("#7050a0");
      core.material.emissive.set("#402080");
    }
  }

  private applyDayNight(phase: "day" | "night"): void {
    if (phase === "night") {
      this.scene.background = new THREE.Color("#080c18");
      this.scene.fog = new THREE.FogExp2("#0c1020", 0.036);
    } else {
      this.scene.background = new THREE.Color("#12182a");
      this.scene.fog = new THREE.FogExp2("#1a2038", 0.024);
    }
  }

  private updateCamera(focus: Vector2): void {
    const distance = 18 / this.cameraZoom;
    const height = 14 / this.cameraZoom;
    this.camera.position.set(
      focus.x + Math.sin(this.cameraAngle) * distance,
      height,
      focus.z + Math.cos(this.cameraAngle) * distance,
    );
    this.camera.lookAt(focus.x, 0.4, focus.z);
  }

  private applyStateSettings(state: GameState): void {
    this.cameraZoom = state.settings.cameraZoom;
    this.grid.visible = state.settings.showGrid;
    document.body.dataset.highContrast = state.settings.highContrast ? "true" : "false";
    document.documentElement.style.setProperty("--ui-scale", String(state.settings.uiScale));
  }

  private bindEvents(): void {
    window.addEventListener("resize", this.resizeBound);
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.pointerPrevious = { x: event.clientX, y: event.clientY };
    if (event.button === 2 || event.button === 1) {
      this.rightDragging = true;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.rightDragging) return;
    const dx = event.clientX - this.pointerPrevious.x;
    this.cameraAngle -= dx * 0.005;
    this.pointerPrevious = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    if (this.rightDragging) {
      this.rightDragging = false;
      return;
    }
    if (event.button !== 0 || moved > 6) return;
    this.pick(event.clientX, event.clientY);
  };

  private readonly onPointerCancel = (): void => {
    this.rightDragging = false;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const next = Math.min(1.45, Math.max(0.7, this.cameraZoom - Math.sign(event.deltaY) * 0.08));
    this.cameraZoom = next;
    this.callbacks.onZoomChange(next);
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private pick(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const entityHits = this.raycaster.intersectObjects(this.interactiveRoots, true);
    for (const hit of entityHits) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        if (object.userData.entityId && object.userData.entityKind) {
          this.callbacks.onEntityClick(object.userData.entityId as string, object.userData.entityKind as string);
          return;
        }
        object = object.parent;
      }
    }
    const groundHits = this.raycaster.intersectObject(this.groundPicker);
    if (groundHits[0]) {
      this.callbacks.onGroundClick({
        x: groundHits[0].point.x,
        z: groundHits[0].point.z,
      });
    } else {
      this.callbacks.onContextStatus("No walkable ground under the cursor.");
    }
  }
}
