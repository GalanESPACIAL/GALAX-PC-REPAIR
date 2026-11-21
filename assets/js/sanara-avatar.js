/* GALAX PC REPAIR — Cuerpo 3D del Airi.
 * Carga docs/Cuerpo_SANARA IA/sanara_listo.glb y lo muestra en el contenedor
 * [data-sanara-avatar]. Si WebGL o el GLB fallan, se conserva el SVG de respaldo.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const container = document.querySelector('[data-sanara-avatar]');
if (container) {
  const fallback = container.querySelector('.sanara-fallback');
  const panel = document.getElementById('chatPanel');
  const visible = () => !panel || panel.classList.contains('open');
  const MODEL_URL = new URL('../../docs/Cuerpo_SANARA%20IA/sanara_listo.glb', import.meta.url).href;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    console.warn('[SANARA] WebGL no disponible:', err);
  }

  if (renderer) {
    const stageW = () => container.clientWidth || 360;
    const stageH = () => container.clientHeight || 620;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.setSize(stageW(), stageH(), false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Entorno de estudio: aporta reflejos suaves y volumen al material PBR.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x3a3350, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 1.4);
    fill.position.set(-2.5, 1.5, 2.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x7aa2ff, 1.2);
    rim.position.set(-3, 2, -2);
    scene.add(rim);
    const glow = new THREE.PointLight(0x22d3ee, 3, 4, 2);
    glow.position.set(0, 0.9, 1.6);
    scene.add(glow);

    const camera = new THREE.PerspectiveCamera(40, stageW() / stageH(), 0.01, 100);

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        const pivot = new THREE.Group();
        pivot.add(gltf.scene);
        pivot.position.y = -0.12;
        scene.add(pivot);

        /* El GLB trae el color base en negro y la textura como EMISIVA: se ve
         * plana y sin volumen. Se reutiliza esa textura como albedo PBR y se
         * deja un emisivo tenue para conservar los brillos neón. */
        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.frustumCulled = false; // el skinning desplaza los bounds reales
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (!m) return;
            const tex = m.map || m.emissiveMap;
            if (tex) {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.anisotropy = maxAniso;
              tex.needsUpdate = true;
              if (!m.map) m.map = tex;
            }
            if (m.color) m.color.set(0xffffff);
            if (m.emissive) m.emissive.set(0xffffff);
            if ('emissiveIntensity' in m) m.emissiveIntensity = 0.32;
            if ('metalness' in m) m.metalness = 0.1;
            if ('roughness' in m) m.roughness = 0.62;
            if ('envMapIntensity' in m) m.envMapIntensity = 1.15;
            m.needsUpdate = true;
          });
        });

        if (fallback) fallback.style.display = 'none';

        // Los vértices skinneados se renderizan en el espacio de geometría:
        // se usan los bounds crudos, no Box3.setFromObject (que aplica la
        // rotación del nodo root y deja la cámara dentro del modelo).
        const box = new THREE.Box3();
        gltf.scene.traverse((o) => {
          if (o.isMesh && o.geometry) {
            o.geometry.computeBoundingBox();
            box.union(o.geometry.boundingBox.clone());
          }
        });
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Orientación base: la modelo mira de frente. Se puede ajustar en vivo
        // con window.__sanaraSetYaw(radianes) para ajustar el ángulo exacto.
        let baseYaw = 0.15; // mirada de frente hacia la cámara
        const faceLocal = new THREE.Vector3(-0.15, box.max.y - 0.25, 0.12);
        window.__sanaraSetYaw = (v) => { baseYaw = Number(v) || 0; };
        function positionMouth() {
          const mouthEl = document.getElementById('sanaraMouth');
          if (!mouthEl) return;
          pivot.updateMatrixWorld(true);
          camera.updateMatrixWorld();
          const p = faceLocal.clone().applyMatrix4(pivot.matrixWorld).project(camera);
          mouthEl.style.left = ((p.x + 1) / 2 * 100) + '%';
          mouthEl.style.top = ((1 - p.y) / 2 * 100) + '%';
        }

        const frame = () => {
          renderer.setSize(stageW(), stageH(), false);
          camera.aspect = stageW() / stageH();
          const t = Math.tan(camera.fov * Math.PI / 360);
          const dist = Math.max((size.y / 2) / t, (size.x / 2) / (t * camera.aspect)) * 1.0;
          camera.position.set(center.x, center.y, center.z + dist);
          camera.lookAt(center);
          camera.updateProjectionMatrix();
          positionMouth();
        };
        frame();
        window.addEventListener('resize', frame);

        // Movimiento de boca mientras saluda / responde en el chat.
        const mouth = document.getElementById('sanaraMouth');
        let speakTimer;
        window.sanaraSpeakStart = () => {
          if (!mouth) return;
          clearTimeout(speakTimer);
          mouth.classList.add('speaking');
        };
        window.sanaraSpeakStop = () => {
          if (!mouth) return;
          clearTimeout(speakTimer);
          mouth.classList.remove('speaking');
        };
        window.sanaraSpeak = (ms = 2400) => {
          if (!mouth) return;
          mouth.classList.add('speaking');
          clearTimeout(speakTimer);
          speakTimer = setTimeout(() => mouth.classList.remove('speaking'), ms);
        };
        window.sanaraSpeak(2600);

        /* Comportamiento humano: respiración, miradas, inclinaciones y
         * reacciones: mira al chat mientras escriben y asiente al hablar. */
        (function animate() {
          requestAnimationFrame(animate);
          if (!visible()) return; // no consumir GPU con el chat cerrado
          const t = performance.now();
          const speaking = !!(mouth && mouth.classList.contains('speaking'));
          const inputEl = document.getElementById('chatInput');
          const typing = !!(inputEl && document.activeElement === inputEl && inputEl.value.trim());
          const breath = Math.sin(t * 0.0017) * 0.005;
          const sway = Math.sin(t * 0.00043) * 0.028;
          const tilt = Math.sin(t * 0.00031 + 1.1) * 0.010;
          const nod = Math.sin(t * 0.00027 + 0.6) * 0.006;
          pivot.position.y = -0.12 + breath;
          pivot.rotation.set(
            nod + (speaking ? 0.012 : 0),
            baseYaw + sway + (typing && !speaking ? 0.05 : 0),
            tilt
          );
          positionMouth();
          renderer.render(scene, camera);
        })();
      },
      undefined,
      (err) => {
        console.warn('[SANARA] No se pudo cargar el cuerpo 3D:', err);
        renderer.domElement.remove();
      }
    );
  }
}
