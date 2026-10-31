import * as THREE from 'three';
import { CAR, BODY_OFFSET } from '../car.js';
import { buildCarModel } from '../carModel.js';
import { MATERIALS, box, groundRect } from '../world.js';

// Tipos de obstáculo:
//   car / wall  -> sólidos: bater na carroceria
//   curb        -> meio-fio: só as rodas encostam (conta como falta)
//   stopper     -> batente de roda: só as rodas encostam (normal, sem falta)

const PARKED_COLORS = [0x2f5d8a, 0xdedede, 0x222222, 0x8a8f96, 0x7a1f1f, 0xe0c060, 0x3c6e47];

// Carro parado com o centro da carroceria em (x, z), virado para h
export function parkedCar(group, obstacles, x, z, h, colorIndex) {
  const model = buildCarModel({ color: PARKED_COLORS[colorIndex % PARKED_COLORS.length] });
  model.group.position.set(x - Math.sin(h) * BODY_OFFSET, 0, z - Math.cos(h) * BODY_OFFSET);
  model.group.rotation.y = h;
  group.add(model.group);
  obstacles.push({ type: 'car', x, z, h, hl: CAR.length / 2, hw: CAR.width / 2 });
}

// Parede alinhada aos eixos: sx = largura em X, sz = largura em Z
export function wall(group, obstacles, x, z, sx, sz, height = 2.2, material = MATERIALS.wall) {
  group.add(box(sx, height, sz, material, x, height / 2, z));
  obstacles.push({ type: 'wall', x, z, h: 0, hl: sz / 2, hw: sx / 2 });
}

// Batente de roda de concreto, comprido na direção perpendicular a h
export function stopper(group, obstacles, x, z, h, length = 1.7) {
  const m = box(length, 0.1, 0.15, MATERIALS.curb, x, 0.05, z);
  m.rotation.y = h;
  group.add(m);
  obstacles.push({ type: 'stopper', label: 'batente', x, z, h, hl: 0.075, hw: length / 2 });
}

// Faixa pintada no chão de a até b
export function paintLine(group, a, b, width = 0.12, material = MATERIALS.white) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const m = groundRect(width, len, material, (a.x + b.x) / 2, (a.z + b.z) / 2, 0.004);
  m.rotation.z = Math.atan2(b.x - a.x, b.z - a.z);
  group.add(m);
}

export function hedge(group, obstacles, x, z, sx, sz) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x3f6f35, roughness: 1 });
  wall(group, obstacles, x, z, sx, sz, 1.0, mat);
}

// Dificuldade escolhida no menu
export const DIFFICULTIES = ['facil', 'padrao', 'dificil'];
