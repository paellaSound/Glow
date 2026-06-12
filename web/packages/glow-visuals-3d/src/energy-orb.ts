/**
 * energy-orb — 3D Visuals MVP scene.
 *
 * Loads the Blender-authored asset (web/public/visuals3d/energy-orb.glb,
 * Draco-compressed) and drives its named actions with an AnimationMixer:
 * `idle` loops; `shockwave` / `burst` are one-shots that blend back to idle.
 * The floor grid, starfield, lights, camera and background remain web-side —
 * the glb only provides the orb geometry + actions (see
 * docs/mcp_blender/01-asset-pipeline.md).
 *
 * Energy levels 0–5 ramp: orb altitude, idle speed, emissive intensity,
 * scale, and background (ground ambience → deep space). `audio.bass`
 * modulates the orb scale within the level; `audio.treble` speeds up idle.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { OrbAction, Visuals3DController, Visuals3DInput } from './types.js';

const MAX_ENERGY = 5;
const GLB_URL = '/visuals3d/energy-orb.glb';
const DRACO_DECODER_PATH = '/draco/';

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

  // ── Orb group (rises with energy; populated when the glb resolves) ───────
  const orb = new THREE.Group();
  scene.add(orb);

  let mixer: THREE.AnimationMixer | null = null;
  let idleAction: THREE.AnimationAction | null = null;
  const oneShots = new Map<OrbAction, THREE.AnimationAction>();
  let coreMat: THREE.MeshStandardMaterial | null = null;
  let ringMat: THREE.MeshStandardMaterial | null = null;
  let shockRing: THREE.Object3D | null = null;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  loader.load(
    GLB_URL,
    (gltf) => {
      if (destroyed) return;
      orb.add(gltf.scene);

      const core = gltf.scene.getObjectByName('Core') as THREE.Mesh | null;
      const ring = gltf.scene.getObjectByName('Ring1') as THREE.Mesh | null;
      shockRing = gltf.scene.getObjectByName('ShockRing') ?? null;
      coreMat = (core?.material as THREE.MeshStandardMaterial) ?? null;
      ringMat = (ring?.material as THREE.MeshStandardMaterial) ?? null;
      if (shockRing) shockRing.visible = false;

      mixer = new THREE.AnimationMixer(gltf.scene);
      for (const clip of gltf.animations) {
        if (clip.name === 'idle') {
          // The exported idle holds ShockRing at scale ~0 (rest-state safety
          // for generic viewers). At runtime we hide it via `visible` instead,
          // so the shockwave one-shot owns that property exclusively.
          clip.tracks = clip.tracks.filter((t) => !t.name.startsWith('ShockRing'));
          idleAction = mixer.clipAction(clip);
          idleAction.setLoop(THREE.LoopRepeat, Infinity);
          idleAction.play();
        } else if (clip.name === 'shockwave' || clip.name === 'burst') {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = false;
          oneShots.set(clip.name, action);
        }
      }
      mixer.addEventListener('finished', (e) => {
        if (e.action === oneShots.get('shockwave') && shockRing) {
          shockRing.visible = false;
        }
        // Restore idle's full influence once any one-shot ends.
        idleAction?.setEffectiveWeight(1);
      });
    },
    undefined,
    (err) => {
      console.error('[visuals-3d] failed to load energy-orb.glb:', err);
    },
  );

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

  // ── State ─────────────────────────────────────────────────────────────────
  let energy = 0;          // target level (0–5)
  let energySmooth = 0;    // eased value used for rendering
  let activeAction: ActionState = null;
  let rafId = 0;
  let destroyed = false;
  let lastMs = performance.now();
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
    const dt = Math.min(0.1, (nowMs - lastMs) / 1000);
    lastMs = nowMs;

    // Ease toward the target energy level
    energySmooth += (energy - energySmooth) * 0.04;
    const e = energySmooth / MAX_ENERGY; // 0–1

    // Audio modulation (offline fallback keeps the orb alive without audio)
    const bass = input.audio ? Math.min(1, Math.max(0, input.audio.bass)) : 0.3 + 0.3 * Math.sin(t * 2.5);
    const treble = input.audio ? Math.min(1, Math.max(0, input.audio.treble)) : 0.2 + 0.2 * Math.cos(t * 5.0);

    // Palette → core / rings (materials come from the glb once loaded)
    const palette = input.palette;
    if (coreMat) {
      coreMat.color.copy(hexColor(palette[0], 0x00e3ff));
      coreMat.emissive.copy(coreMat.color);
      coreMat.emissiveIntensity = 0.6 + e * 2.2 + bass * 1.2;
    }
    if (ringMat) {
      const ringColor = hexColor(palette[1] ?? palette[0], 0xff00c8);
      ringMat.color.copy(ringColor);
      ringMat.emissive.copy(ringColor);
      ringMat.emissiveIntensity = 0.4 + e * 1.6;
    }

    // Energy ramp: altitude (floor → space), scale, idle speed
    const altitude = 0.9 + e * 6.5;
    orb.position.y = altitude + Math.sin(t * 1.2) * 0.08;
    orb.scale.setScalar(1 + e * 0.6 + bass * 0.18);
    if (idleAction) {
      idleAction.timeScale = 0.5 + e * 2.0 + treble * 1.2;
    }

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

    // One-shot extras the clips don't carry (emissive flash on burst)
    if (activeAction) {
      const elapsed = (nowMs - activeAction.startMs) / 1000;
      const dur = activeAction.action === 'shockwave' ? 1.2 : 0.8;
      if (elapsed >= dur) {
        activeAction = null;
      } else if (activeAction.action === 'burst' && coreMat) {
        coreMat.emissiveIntensity += Math.sin((elapsed / dur) * Math.PI) * 5;
      }
    }

    mixer?.update(dt);
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
      const oneShot = oneShots.get(action);
      if (!oneShot) return;
      if (action === 'shockwave' && shockRing) shockRing.visible = true;
      // Soften idle on the properties both clips touch (Shell scale during
      // burst); single-contributor channels are unaffected by the weight.
      idleAction?.setEffectiveWeight(0.35);
      oneShot.reset().play();
    },
    resize,
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      mixer?.stopAllAction();
      dracoLoader.dispose();
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
