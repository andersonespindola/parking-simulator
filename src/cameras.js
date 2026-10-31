import * as THREE from 'three';
import { localToWorld } from './geometry.js';
import { CAR } from './car.js';

export const CAMERA_MODES = [
  { id: 'chase', label: 'Terceira pessoa' },
  { id: 'driver', label: 'Motorista (com retrovisores)' },
  { id: 'top', label: 'Vista de cima' },
  { id: 'rear', label: 'Câmera de ré' },
];

// Posição dos olhos do motorista (lado esquerdo do carro)
const EYE = { lx: 0.37, y: 1.22, lz: 0.95 };

function placeLocal(cam, s, lx, y, lz, tx, ty, tz) {
  const p = localToWorld(s.x, s.z, s.h, lx, lz);
  const t = localToWorld(s.x, s.z, s.h, tx, tz);
  cam.position.set(p.x, y, p.z);
  cam.up.set(0, 1, 0);
  cam.lookAt(t.x, ty, t.z);
}

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.05, 500);
    this.camera.layers.enable(1); // interior do carro
    this.index = 0;
    this.chasePos = null;
    this.topPos = null;
    this.topHeight = 22;
    this.look = { back: false, left: false, right: false };
  }

  get mode() {
    return CAMERA_MODES[this.index];
  }

  next() {
    this.index = (this.index + 1) % CAMERA_MODES.length;
    this.chasePos = null;
    this.topPos = null;
  }

  zoom(delta) {
    this.topHeight = Math.max(8, Math.min(50, this.topHeight + delta));
  }

  update(s, dt) {
    const cam = this.camera;
    const mode = this.mode.id;
    const k = 1 - Math.exp(-dt * 4);

    if (mode === 'chase') {
      cam.fov = 60;
      const want = localToWorld(s.x, s.z, s.h, 0, -5.5);
      const target = new THREE.Vector3(want.x, 3.4, want.z);
      if (!this.chasePos) this.chasePos = target.clone();
      this.chasePos.lerp(target, k);
      cam.position.copy(this.chasePos);
      cam.up.set(0, 1, 0);
      const look = localToWorld(s.x, s.z, s.h, 0, CAR.wheelbase);
      cam.lookAt(look.x, 0.8, look.z);
    } else if (mode === 'driver') {
      cam.fov = 70;
      // Olhar por cima do ombro (V), para a esquerda (Z) ou direita (X)
      let tx = EYE.lx, tz = 10, ty = 1.05;
      if (this.look.back) { tx = EYE.lx - 3; tz = -10; ty = 0.9; }
      else if (this.look.left) { tx = 10; tz = EYE.lz + 2; }
      else if (this.look.right) { tx = -10; tz = EYE.lz + 3; }
      placeLocal(cam, s, EYE.lx, EYE.y, EYE.lz, tx, ty, tz);
    } else if (mode === 'top') {
      cam.fov = 45;
      const target = new THREE.Vector3(s.x, this.topHeight, s.z);
      if (!this.topPos) this.topPos = target.clone();
      this.topPos.lerp(target, k);
      cam.position.copy(this.topPos);
      cam.up.set(0, 0, 1); // norte fixo: a rua não gira na tela
      cam.lookAt(this.topPos.x, 0, this.topPos.z);
    } else if (mode === 'rear') {
      cam.fov = 100;
      placeLocal(cam, s, 0, 0.95, -CAR.rearOverhang - 0.02, 0, -0.2, -4);
    }
    cam.updateProjectionMatrix();
  }
}

// Retrovisores renderizados em texturas e desenhados por cima da imagem (espelhados)
const MIRRORS = [
  // id, posição local (lx, y, lz), alvo local, fov, proporção, posição na tela (fração)
  { id: 'left', pos: [CAR.width / 2 + 0.1, 1.02, 1.95], target: [2.6, 0.75, -10], fov: 30, aspect: 1.6, screen: { x: 0.11, y: 0.38, w: 0.18 } },
  { id: 'right', pos: [-CAR.width / 2 - 0.1, 1.02, 1.95], target: [-3.2, 0.75, -10], fov: 30, aspect: 1.6, screen: { x: 0.89, y: 0.38, w: 0.18 } },
  { id: 'center', pos: [0, 1.32, 1.45], target: [0, 1.0, -10], fov: 24, aspect: 3.2, near: 2.0, screen: { x: 0.5, y: 0.88, w: 0.26 } },
];

export class Mirrors {
  constructor() {
    this.overlay = new THREE.Scene();
    this.overlayCam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    this.items = MIRRORS.map((m) => {
      const rt = new THREE.WebGLRenderTarget(Math.round(256 * m.aspect), 256);
      const cam = new THREE.PerspectiveCamera(m.fov, m.aspect, m.near ?? 0.1, 200); // o interno começa atrás do vidro traseiro
      const geo = new THREE.PlaneGeometry(1, 1);
      // Inverte horizontalmente: é um espelho
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      const quad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rt.texture }));
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      frame.position.z = -0.5;
      this.overlay.add(frame, quad);
      return { ...m, rt, cam, quad, frame };
    });
  }

  layout(width, height) {
    this.overlayCam.right = width;
    this.overlayCam.top = height;
    this.overlayCam.updateProjectionMatrix();
    for (const m of this.items) {
      const w = m.screen.w * width;
      const h = w / m.aspect;
      const x = m.screen.x * width;
      const y = m.screen.y * height;
      m.quad.scale.set(w, h, 1);
      m.quad.position.set(x, y, 0);
      m.frame.scale.set(w + 8, h + 8, 1);
      m.frame.position.set(x, y, -0.5);
    }
  }

  render(renderer, scene, s) {
    for (const m of this.items) {
      placeLocal(m.cam, s, m.pos[0], m.pos[1], m.pos[2], m.target[0], m.target[1], m.target[2]);
      renderer.setRenderTarget(m.rt);
      renderer.render(scene, m.cam);
    }
    renderer.setRenderTarget(null);
  }

  drawOverlay(renderer) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.overlay, this.overlayCam);
    renderer.autoClear = true;
  }
}
