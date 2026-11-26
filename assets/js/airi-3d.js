/* =====================================================================
   GALAX PC REPAIR — Avatar 3D de Airi (cuerpo Sanara).
   Se monta dentro de #airiStage (header del chat) usando el GLB real de
   docs/Cuerpo_SANARA IA. Sin WebGL o sin modelo, se conserva el fallback.
   Requiere import map "three" en la página (ver docs/galax_preview.html).
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from '../../docs/vendor/loaders/GLTFLoader.js';

const MODEL_URL = new URL('../../docs/Cuerpo_SANARA%20IA/sanara_listo.glb', import.meta.url).href;
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const bones = {}, basePose = {};
let panel, stage, fallback, renderer, scene, camera, clock, model3d = null;
let started = false, waveUntil = 0, waveAmount = 0, waveUp = 1.12, waveLow = -0.45, speakingUntil = 0, typingUntil = 0;
let rafId = null;

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const _parentQ = new THREE.Quaternion(), _invParent = new THREE.Quaternion();
const _axisQ = new THREE.Quaternion(), _deltaQ = new THREE.Quaternion();

function rotateWorld(bone, axis, angle) {
  if (!bone || !angle) return;
  bone.parent.getWorldQuaternion(_parentQ);
  _axisQ.setFromAxisAngle(axis, angle);
  _invParent.copy(_parentQ).invert();
  _deltaQ.copy(_invParent).multiply(_axisQ).multiply(_parentQ);
  bone.quaternion.premultiply(_deltaQ);
}
function applyWorldQuat(bone, worldQ) {
  if (!bone) return;
  bone.parent.getWorldQuaternion(_parentQ);
  _invParent.copy(_parentQ).invert();
  _deltaQ.copy(_invParent).multiply(worldQ).multiply(_parentQ);
  bone.quaternion.premultiply(_deltaQ);
  bone.updateWorldMatrix(false, true);
}
function lowerArms() {
  model3d.updateMatrixWorld(true);
  for (const side of ['l', 'r']) {
    const up = bones['upperarm_' + side], low = bones['lowerarm_' + side];
    if (!up || !low) continue;
    const sPos = new THREE.Vector3(), ePos = new THREE.Vector3();
    up.getWorldPosition(sPos); low.getWorldPosition(ePos);
    const dir = ePos.sub(sPos).normalize(), sign = sPos.x < 0 ? -1 : 1;
    applyWorldQuat(up, new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(sign * 0.22, -1, 0.05).normalize()));
    applyWorldQuat(low, new THREE.Quaternion().setFromAxisAngle(AXIS_X, -0.22));
  }
  model3d.updateMatrixWorld(true);
}
function frameModel() {
  const head = bones.head, headPos = new THREE.Vector3();
  if (head) head.getWorldPosition(headPos);
  const leafPos = headPos.clone();
  if (bones.head_leaf) bones.head_leaf.getWorldPosition(leafPos);
  const y = Math.max(headPos.y, leafPos.y) + 0.43;
  camera.fov = 18;
  camera.position.set(headPos.x || 0, y, 2.85);
  camera.lookAt(headPos.x || 0, y, 0);
  camera.updateProjectionMatrix();
}
function fit() {
  if (!renderer || !camera || !stage) return;
  const w = stage.clientWidth || 42, h = stage.clientHeight || 42;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function onModelLoaded(gltf) {
  model3d = gltf.scene;
  scene.add(model3d);
  model3d.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.frustumCulled = false;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const tex = src && (src.emissiveMap || src.map);
      if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
      o.material = new THREE.MeshStandardMaterial({
        map: tex || null, color: 0xffffff,
        emissive: new THREE.Color(0xffffff), emissiveMap: tex || null, emissiveIntensity: 0.22,
        metalness: 0.05, roughness: 0.55, side: THREE.DoubleSide
      });
    }
  });
  model3d.updateMatrixWorld(true);
  lowerArms();
  for (const name of ['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'head', 'spine_02', 'spine_03']) {
    if (bones[name]) basePose[name] = bones[name].quaternion.clone();
  }
  frameModel();
  if (fallback) fallback.style.display = 'none';
  if (stage && window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  fit();
  waveUntil = performance.now() + 3000;
  window.__AIRI_3D_READY = true;
}
function init() {
  if (started) return;
  started = true;
  panel = document.getElementById('airi-panel');
  stage = document.getElementById('airiStage');
  if (!panel || !stage) return;
  fallback = stage.querySelector('.sanara-fallback');
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { console.warn('[Airi3D] WebGL no disponible:', e); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const canvasHost = stage.querySelector('.sanara-canvas') || stage;
  canvasHost.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xd7ecff, 0x1a1238, 1.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(1.4, 2.7, 2.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8b5cf6, 2.1); rim.position.set(1.2, 2.2, -1.8); scene.add(rim);
  const face = new THREE.DirectionalLight(0xfff1e2, 1.2); face.position.set(0.5, 2.8, 3.2); scene.add(face);
  camera = new THREE.PerspectiveCamera(18, 1, 0.01, 40);
  clock = new THREE.Clock();
  fit();
  new GLTFLoader().load(MODEL_URL, onModelLoaded, undefined, (err) => console.warn('[Airi3D] No se pudo cargar el modelo:', err));
  (function loop() {
    rafId = requestAnimationFrame(loop);
    if (!renderer || !scene || !camera) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, now = performance.now();
    if (model3d) {
      for (const name in basePose) bones[name].quaternion.copy(basePose[name]);
      const m = reduced ? 0.25 : 1;
      rotateWorld(bones.head, AXIS_Y, Math.sin(t * 0.65) * 0.10 * m + (now < typingUntil ? 0.08 : 0));
      rotateWorld(bones.head, AXIS_X, Math.sin(t * 0.9) * 0.03 * m + (now < speakingUntil ? 0.05 : 0));
      rotateWorld(bones.spine_02, AXIS_Y, Math.sin(t * 0.45) * 0.024 * m);
      rotateWorld(bones.spine_03, AXIS_Y, Math.sin(t * 0.55) * 0.014 * m);
      const target = now < waveUntil ? 1 : 0;
      waveAmount += (target - waveAmount) * Math.min(1, dt * 7);
      if (waveAmount > 0.002) {
        const swing = Math.sin(t * 8.5) * 0.16;
        rotateWorld(bones.upperarm_l, AXIS_Z, (waveUp + swing * 0.6) * waveAmount);
        rotateWorld(bones.lowerarm_l, AXIS_Z, (waveLow + swing * 1.2) * waveAmount);
        rotateWorld(bones.hand_l, AXIS_Z, Math.sin(t * 8.5 + 0.5) * 0.18 * waveAmount);
      }
    }
    if (panel.classList.contains('is-open') && !document.hidden) renderer.render(scene, camera);
  })();
}

/* API pública (se crea aunque el DOM aún no esté listo) */
window.GALAX_Airi3D = {
  wave(ms = 3000) { waveUntil = performance.now() + ms; },
  setSpeaking(ms = 2400) { speakingUntil = performance.now() + ms; },
  setTyping(ms = 1800) { typingUntil = performance.now() + ms; },
  ready: () => Boolean(model3d),
  bones
};

/* El panel lo inyecta airi.js (script defer). Esperamos a que exista. */
(function waitForPanel(tries = 0) {
  if (document.getElementById('airi-panel')) { init(); return; }
  if (tries < 120) requestAnimationFrame(() => waitForPanel(tries + 1));
})();
