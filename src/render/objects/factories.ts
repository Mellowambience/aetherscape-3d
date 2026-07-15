import * as THREE from "three";
import { PALETTES } from "../../game/content/catalog";
import type { PaletteId } from "../../game/simulation/types";

function mat(color: string, opts: { emissive?: string; emissiveIntensity?: number; roughness?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts.emissive ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    roughness: opts.roughness ?? 0.75,
    metalness: 0.08,
  });
}

function markInteractive(group: THREE.Group, entityId: string, entityKind: string): THREE.Group {
  group.userData.entityId = entityId;
  group.userData.entityKind = entityKind;
  group.traverse((child) => {
    child.userData.entityId = entityId;
    child.userData.entityKind = entityKind;
  });
  return group;
}

export function createCharacter(palette: PaletteId, entityId = "player", isNpc = false): THREE.Group {
  const colors = PALETTES[palette];
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), mat(colors.cloth));
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat("#e8d5c4"));
  head.position.y = 1.28;
  head.castShadow = true;
  group.add(head);
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.85, 8, 1, true), mat(colors.accent, { roughness: 0.55 }));
  cloak.position.set(0, 0.55, -0.05);
  cloak.rotation.x = Math.PI;
  group.add(cloak);
  if (isNpc) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.035, 8, 20),
      mat("#f0d080", { emissive: "#f0d080", emissiveIntensity: 0.55 }),
    );
    halo.position.y = 1.58;
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
  }
  return markInteractive(group, entityId, isNpc ? "npc" : "player");
}

export function createGlowreed(entityId: string): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.05, 0.7 + i * 0.08, 6),
      mat("#6fb86a", { emissive: "#3a8040", emissiveIntensity: 0.25 }),
    );
    stem.position.set((i - 2) * 0.12, 0.35, (i % 2) * 0.08);
    stem.castShadow = true;
    group.add(stem);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      mat("#c8f0ff", { emissive: "#7ad0ff", emissiveIntensity: 0.85 }),
    );
    tip.position.set(stem.position.x, 0.75 + i * 0.05, stem.position.z);
    group.add(tip);
  }
  return markInteractive(group, entityId, "resource");
}

export function createLeyCrystalNode(entityId: string): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.2, 6), mat("#4a5060"));
  base.position.y = 0.1;
  base.castShadow = true;
  group.add(base);
  for (let i = 0; i < 3; i += 1) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16 + i * 0.04, 0),
      mat("#80d0ff", { emissive: "#4080ff", emissiveIntensity: 0.7, roughness: 0.2 }),
    );
    shard.position.set((i - 1) * 0.12, 0.35 + i * 0.08, (i % 2) * 0.06);
    shard.rotation.z = i * 0.3;
    shard.castShadow = true;
    group.add(shard);
  }
  return markInteractive(group, entityId, "resource");
}

export function createBankChest(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), mat("#6a4a28", { roughness: 0.7 }));
  body.position.y = 0.25;
  body.castShadow = true;
  group.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.52), mat("#8a6030"));
  lid.position.y = 0.48;
  group.add(lid);
  const lock = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    mat("#f0d080", { emissive: "#c0a040", emissiveIntensity: 0.4 }),
  );
  lock.position.set(0, 0.35, 0.28);
  group.add(lock);
  return markInteractive(group, "bank-chest", "station");
}

export function createGloamtick(entityId: string): THREE.Group {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 12, 10),
    mat("#2a2438", { emissive: "#4a2080", emissiveIntensity: 0.35, roughness: 0.45 }),
  );
  shell.scale.set(1.2, 0.65, 1);
  shell.position.y = 0.28;
  shell.castShadow = true;
  group.add(shell);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat("#ff6a9a", { emissive: "#ff3a70", emissiveIntensity: 0.9 }));
  eye.position.set(0.18, 0.35, 0.28);
  group.add(eye);
  return markInteractive(group, entityId, "enemy");
}

export function createLootMarker(entityId: string): THREE.Group {
  const group = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    mat("#f0d070", { emissive: "#d0a020", emissiveIntensity: 0.7 }),
  );
  gem.position.y = 0.25;
  group.add(gem);
  return markInteractive(group, entityId, "loot");
}

export function createShrineLoom(): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.7), mat("#5a4a3a"));
  base.position.y = 0.12;
  base.castShadow = true;
  group.add(base);
  const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8), mat("#8a7050"));
  pillarL.position.set(-0.28, 0.7, 0);
  group.add(pillarL);
  const pillarR = pillarL.clone();
  pillarR.position.x = 0.28;
  group.add(pillarR);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.12), mat("#c9a070", { emissive: "#806040", emissiveIntensity: 0.2 }));
  beam.position.y = 1.2;
  group.add(beam);
  const thread = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.03, 6, 16),
    mat("#9ad7ff", { emissive: "#5ab0ff", emissiveIntensity: 0.65 }),
  );
  thread.position.y = 0.75;
  thread.rotation.x = Math.PI / 2;
  group.add(thread);
  return markInteractive(group, "shrine-loom", "station");
}

export function createLeyward(): THREE.Group {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), mat("#3a3548"));
  post.position.y = 0.7;
  post.castShadow = true;
  group.add(post);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 10),
    mat("#7050a0", { emissive: "#402080", emissiveIntensity: 0.4 }),
  );
  lamp.name = "leyward-core";
  lamp.position.y = 1.55;
  group.add(lamp);
  return markInteractive(group, "leyward", "station");
}

export function createBuilding(width: number, depth: number, wall: string, roof: string): THREE.Group {
  const group = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(width, 1.4, depth), mat(wall));
  walls.position.set(width / 2 - 0.5, 0.7, depth / 2 - 0.5);
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 0.8, 4), mat(roof));
  roofMesh.position.set(width / 2 - 0.5, 1.7, depth / 2 - 0.5);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.castShadow = true;
  group.add(roofMesh);
  return group;
}

export function createDecoration(kind: "tree" | "rock" | "crystal"): THREE.Group {
  const group = new THREE.Group();
  if (kind === "tree") {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 6), mat("#5a4030"));
    trunk.position.y = 0.45;
    trunk.castShadow = true;
    group.add(trunk);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat("#3a6a48", { emissive: "#1a4028", emissiveIntensity: 0.15 }));
    canopy.position.y = 1.15;
    canopy.castShadow = true;
    group.add(canopy);
  } else if (kind === "rock") {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), mat("#6a6a70", { roughness: 0.9 }));
    rock.position.y = 0.25;
    rock.castShadow = true;
    group.add(rock);
  } else {
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35, 0),
      mat("#80d0ff", { emissive: "#4080ff", emissiveIntensity: 0.55, roughness: 0.25 }),
    );
    crystal.position.y = 0.4;
    crystal.castShadow = true;
    group.add(crystal);
  }
  return group;
}

export function createTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(8, 10, 18, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e8f0ff";
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}
