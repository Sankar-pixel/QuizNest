// frontend/src/engine/Scene.js
// Core WebGL scene: renderer, UnrealBloom post-processing pipeline, the six
// category skyscrapers, particle rain, raycasting interactions, and the
// correct/incorrect feedback effects (particle bursts / chromatic glitch).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Category definitions drive both the tower geometry/material and the
// gameplay category key used by the backend API.
export const CATEGORIES = [
  { key: 'programming', label: 'Programming', color: 0x39ff6a, position: [-14, 0, -6] },
  { key: 'science', label: 'Science', color: 0x2fd9ff, position: [-7, 0, 8] },
  { key: 'mathematics', label: 'Mathematics', color: 0xffb400, position: [7, 0, 8] },
  { key: 'history', label: 'History', color: 0xff2b4e, position: [14, 0, -6] },
  { key: 'geography', label: 'Geography', color: 0x12e6a0, position: [0, 0, -14] },
  { key: 'entertainment', label: 'Entertainment', color: 0xff2fd4, position: [0, 0, 14] },
];

/** A minimal chromatic-aberration / RGB-split glitch shader for wrong answers. */
const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.0 },
    time: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float time;
    varying vec2 vUv;

    float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      float shift = amount * 0.02;
      float line = step(0.98, rand(vec2(floor(uv.y * 60.0), time)));

      vec2 uvR = uv + vec2(shift + line * shift * 3.0, 0.0);
      vec2 uvB = uv - vec2(shift + line * shift * 3.0, 0.0);

      float r = texture2D(tDiffuse, uvR).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uvB).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export class CityScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} callbacks
   * @param {(categoryKey: string, towerMesh: THREE.Object3D) => void} callbacks.onBuildingSelect
   */
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.clock = new THREE.Clock();
    this.towers = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hovered = null;
    this.glitchTime = 0;
    this.glitchDecay = 0;

    this._initRenderer();
    this._initScene();
    this._initPostProcessing();
    this._buildCity();
    this._bindEvents();

    this.animate = this.animate.bind(this);
    this.animate();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05010c, 0.028);
    this.scene.background = new THREE.Color(0x05010c);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.position.set(0, 22, 34);
    this.camera.lookAt(0, 4, 0);

    // Ambient + moody rim lighting
    this.scene.add(new THREE.AmbientLight(0x2a1a44, 0.6));
    const rim = new THREE.DirectionalLight(0x8844ff, 0.4);
    rim.position.set(-10, 20, -10);
    this.scene.add(rim);

    // Ground plane — dark reflective plaza
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0512,
      metalness: 0.6,
      roughness: 0.35,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Neon grid overlay on the ground for cyberpunk floor lines
    const grid = new THREE.GridHelper(200, 80, 0x00f6ff, 0x220a33);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    this.scene.add(grid);

    this._buildParticleRain();
  }

  _buildParticleRain() {
    const count = 2500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x66e0ff,
      size: 0.12,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.rain = new THREE.Points(geometry, material);
    this.scene.add(this.rain);
  }

  _initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.15, // strength
      0.55, // radius
      0.15  // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.glitchPass = new ShaderPass(GlitchShader);
    this.glitchPass.uniforms.amount.value = 0.0;
    this.composer.addPass(this.glitchPass);
  }

  _buildCity() {
    CATEGORIES.forEach((cat) => {
      const tower = this._createTower(cat);
      tower.position.set(...cat.position);
      tower.userData.category = cat.key;
      tower.userData.label = cat.label;
      tower.userData.baseScale = 1;
      this.scene.add(tower);
      this.towers.push(tower);
    });
  }

  _createTower(cat) {
    const group = new THREE.Group();

    const height = 10 + Math.random() * 4;
    const bodyGeo = new THREE.BoxGeometry(3, height, 3);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0d0818,
      emissive: new THREE.Color(cat.color),
      emissiveIntensity: 0.55,
      metalness: 0.4,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2;
    group.add(body);

    // Emissive wireframe accent so the bloom pass reads clearly at a distance
    const wireGeo = new THREE.BoxGeometry(3.05, height, 3.05);
    const wireMat = new THREE.MeshBasicMaterial({
      color: cat.color,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.y = height / 2;
    group.add(wire);

    // A small glowing beacon marker floating above the tower
    const beaconGeo = new THREE.OctahedronGeometry(0.6, 0);
    const beaconMat = new THREE.MeshBasicMaterial({ color: cat.color });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = height + 1.5;
    beacon.userData.isBeacon = true;
    group.add(beacon);

    return group;
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
    this.canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
    this.canvas.addEventListener('click', (e) => this._onClick(e));
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  _onPointerMove(e) {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.towers, true);

    const hitTower = intersects.length ? this._resolveTower(intersects[0].object) : null;

    if (hitTower !== this.hovered) {
      if (this.hovered) this._setTowerHoverState(this.hovered, false);
      if (hitTower) this._setTowerHoverState(hitTower, true);
      this.hovered = hitTower;
      this.canvas.style.cursor = hitTower ? 'pointer' : 'default';
    }
  }

  _onClick(e) {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.towers, true);
    if (!intersects.length) return;

    const tower = this._resolveTower(intersects[0].object);
    if (tower && this.callbacks.onBuildingSelect) {
      this.callbacks.onBuildingSelect(tower.userData.category, tower);
    }
  }

  _resolveTower(object) {
    let current = object;
    while (current && !this.towers.includes(current)) {
      current = current.parent;
    }
    return current;
  }

  _setTowerHoverState(tower, isHovered) {
    const target = isHovered ? 1.08 : 1;
    // GSAP handles the actual tween in main.js via getTowerByKey(); here we
    // just flag intent so main.js's ticking loop (or a GSAP call) can react.
    tower.userData.targetScale = target;
  }

  /** Returns the THREE.Group for a given category key, used by main.js for GSAP camera zooms. */
  getTowerByKey(key) {
    return this.towers.find((t) => t.userData.category === key);
  }

  /** Green particle burst fired from the quiz room on a correct answer. */
  triggerCorrectBurst(originPoint = new THREE.Vector3(0, 3, 0)) {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = originPoint.x;
      positions[i * 3 + 1] = originPoint.y;
      positions[i * 3 + 2] = originPoint.z;
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 8,
          (Math.random() - 0.5) * 8
        )
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x39ff88,
      size: 0.18,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    let elapsed = 0;
    const duration = 1.1;
    const tick = () => {
      const dt = 0.016;
      elapsed += dt;
      const posAttr = geometry.attributes.position;
      for (let i = 0; i < count; i++) {
        posAttr.array[i * 3] += velocities[i].x * dt;
        posAttr.array[i * 3 + 1] += velocities[i].y * dt - 4 * dt; // gravity
        posAttr.array[i * 3 + 2] += velocities[i].z * dt;
      }
      posAttr.needsUpdate = true;
      material.opacity = Math.max(0, 1 - elapsed / duration);

      if (elapsed < duration) {
        requestAnimationFrame(tick);
      } else {
        this.scene.remove(points);
        geometry.dispose();
        material.dispose();
      }
    };
    tick();
  }

  /** Chromatic-aberration glitch + implicit camera shake for a wrong answer. */
  triggerIncorrectGlitch() {
    this.glitchDecay = 1.0; // drives the shader amount + a small camera shake
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    // Idle tower bob + hover scale easing (lightweight, non-GSAP idle motion)
    this.towers.forEach((tower, i) => {
      const target = tower.userData.targetScale || 1;
      const current = tower.scale.x;
      tower.scale.setScalar(current + (target - current) * 0.15);

      const beacon = tower.children.find((c) => c.userData.isBeacon);
      if (beacon) {
        beacon.position.y += Math.sin(t * 2 + i) * 0.002;
        beacon.rotation.y += dt * 1.2;
      }
    });

    // Particle rain fall
    if (this.rain) {
      const positions = this.rain.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i) - dt * 6;
        if (y < 0) y = 60;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }

    // Glitch decay + subtle camera shake while active
    if (this.glitchDecay > 0) {
      this.glitchDecay = Math.max(0, this.glitchDecay - dt * 2.2);
      this.glitchPass.uniforms.amount.value = this.glitchDecay;
      this.glitchPass.uniforms.time.value = t;

      this.camera.position.x += (Math.random() - 0.5) * 0.15 * this.glitchDecay;
      this.camera.position.y += (Math.random() - 0.5) * 0.1 * this.glitchDecay;
    } else {
      this.glitchPass.uniforms.amount.value = 0;
    }

    this.composer.render();
  }
}
