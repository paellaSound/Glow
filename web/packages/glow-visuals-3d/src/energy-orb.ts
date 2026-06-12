/**
 * energy-orb — 3D Visuals MVP scene.
 *
 * Procedural three.js implementation of the energy orb: core sphere +
 * translucent shell + two orbiting rings over a floor grid, with a starfield
 * that fades in as the energy level climbs (floor → space).
 *
 * The geometry is currently built in code; once the Blender MCP asset
 * (web/public/visuals3d/energy-orb.glb) is produced, this module can swap the
 * procedural parts for the glTF without changing the controller contract.
 *
 * Energy levels 0–5 ramp: orb altitude, rotation speed, emissive intensity,
 * scale, and background (ground ambience → deep space). `audio.bass`
 * modulates the core within the level; `audio.treble` speeds up the rings.
 */

import * as THREE from 'three';
import type { OrbAction, Visuals3DController, Visuals3DInput } from './types.js';

const MAX_ENERGY = 5;

type ActionState = {
  action: OrbAction;
  startMs: number;
} | null;

function hexColor(hex: string | undefined, fallback: number): THREE.Color {
  try {
    return new THREE.Color(hex ?? fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

export function mountEnergyOrb(
  canvas: HTMLCanvasElement,
  getInput: () => Visuals3DInput,
): Visuals3DController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060f);
  scene.fog = new THREE.Fog(0x05060f, 8, 30);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 1.6, 6);

  // ── Lights ────────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x223344, 0.6);
  const key = new THREE.PointLight(0xffffff, 30, 40);
  key.position.set(4, 6, 4);
  scene.add(ambient, key);

  // ── Orb group (rises with energy) ────────────────────────────────────────
  const orb = new THREE.Group();
  scene.add(orb);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x00e3ff,
    emissive: 0x00e3ff,
    emissiveIntensity: 0.8,
    roughness: 0.25,
    metalness: 0.1,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 48, 48), coreMat);
  orb.add(core);

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    roughness: 0.1,
    metalness: 0.0,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.85, 48, 48), shellMat);
  orb.add(shell);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xff00c8,
    emissive: 0xff00c8,
    emissiveIntensity: 0.6,
    roughness: 0.4,
  });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 16, 96), ringMat);
  ring1.rotation.x = Math.PI / 2.4;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.025, 16, 96), ringMat.clone());
  ring2.rotation.x = -Math.PI / 3;
  orb.add(ring1, ring2);

  // ── Floor grid (fades out with altitude) ─────────────────────────────────
  const grid = new THREE.GridHelper(40, 40, 0x224455, 0x112233);
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);

  // ── Starfield (fades in with energy) ─────────────────────────────────────
  const starCount = 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 18 + Math.random() * 14;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) - 4;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── One-shot action FX ────────────────────────────────────────────────────
  const shockMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shockRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.05, 96), shockMat);
  shockRing.visible = false;
  orb.add(shockRing);

  // ── State ─────────────────────────────────────────────────────────────────
  let energy = 0;          // target level (0–5)
  let energySmooth = 0;    // eased value used for rendering
  let activeAction: ActionState = null;
  let rafId = 0;
  let destroyed = false;
  const startTime = performance.now();

  const groundColor = new THREE.Color(0x0a1228);
  const spaceColor = new THREE.Color(0x010103);
  const bgColor = new THREE.Color();

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(nowMs: number) {
    if (destroyed) return;
    const input = getInput();
    const t = (nowMs - startTime) / 1000;

    // Ease toward the target energy level
    energySmooth += (energy - energySmooth) * 0.04;
    const e = energySmooth / MAX_ENERGY; // 0–1

    // Audio modulation (offline fallback keeps the orb alive without audio)
    const bass = input.audio ? Math.min(1, Math.max(0, input.audio.bass)) : 0.3 + 0.3 * Math.sin(t * 2.5);
    const treble = input.audio ? Math.min(1, Math.max(0, input.audio.treble)) : 0.2 + 0.2 * Math.cos(t * 5.0);

    // Palette → core / rings
    const palette = input.palette;
    coreMat.color.copy(hexColor(palette[0], 0x00e3ff));
    coreMat.emissive.copy(coreMat.color);
    const ringColor = hexColor(palette[1] ?? palette[0], 0xff00c8);
    ringMat.color.copy(ringColor);
    ringMat.emissive.copy(ringColor);
    (ring2.material as THREE.MeshStandardMaterial).color.copy(ringColor);
    (ring2.material as THREE.MeshStandardMaterial).emissive.copy(ringColor);

    // Energy ramp: altitude (floor → space), scale, emissive, speed
    const altitude = 0.9 + e * 6.5;
    orb.position.y = altitude + Math.sin(t * 1.2) * 0.08;
    const scale = 1 + e * 0.6 + bass * 0.18;
    core.scale.setScalar(scale);
    shell.scale.setScalar(1 + e * 0.5 + bass * 0.1);
    coreMat.emissiveIntensity = 0.6 + e * 2.2 + bass * 1.2;
    ringMat.emissiveIntensity = 0.4 + e * 1.6;

    const spin = 0.3 + e * 2.2 + treble * 1.5;
    ring1.rotation.z += spin * 0.01;
    ring2.rotation.z -= spin * 0.013;
    core.rotation.y += 0.002 + e * 0.01;

    // Camera follows the orb up
    camera.position.y = 1.6 + e * 5.8;
    camera.position.z = 6 + e * 1.2;
    camera.lookAt(0, altitude, 0);

    // Background: ground ambience → deep space, stars fade in
    bgColor.copy(groundColor).lerp(spaceColor, e);
    (scene.background as THREE.Color).copy(bgColor);
    scene.fog?.color.copy(bgColor);
    starMat.opacity = Math.max(0, e - 0.25) * 1.3;
    (grid.material as THREE.Material).opacity = Math.max(0, 1 - e * 1.6);
    grid.visible = (grid.material as THREE.Material).opacity > 0.01;

    // One-shot actions
    if (activeAction) {
      const elapsed = (nowMs - activeAction.startMs) / 1000;
      if (activeAction.action === 'shockwave') {
        const dur = 1.2;
        if (elapsed >= dur) {
          activeAction = null;
          shockRing.visible = false;
        } else {
          const p = elapsed / dur;
          shockRing.visible = true;
          shockRing.scale.setScalar(1 + p * 7);
          shockRing.rotation.x = Math.PI / 2;
          shockMat.opacity = (1 - p) * 0.85;
        }
      } else if (activeAction.action === 'burst') {
        const dur = 0.8;
        if (elapsed >= dur) {
          activeAction = null;
        } else {
          const p = elapsed / dur;
          const flash = Math.sin(p * Math.PI);
          coreMat.emissiveIntensity += flash * 5;
          shell.scale.multiplyScalar(1 + flash * 0.45);
          shellMat.opacity = 0.12 + flash * 0.3;
        }
      }
    } else {
      shellMat.opacity = 0.12;
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(render);
  }

  resize();
  rafId = requestAnimationFrame(render);

  return {
    setEnergy: (level: number) => {
      energy = Math.max(0, Math.min(MAX_ENERGY, Math.round(level)));
    },
    triggerAction: (action: OrbAction) => {
      activeAction = { action, startMs: performance.now() };
    },
    resize,
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    },
  };
}
