import * as THREE from 'three';
import { CAR } from '../car.js';
import { MATERIALS, box, groundRect, tree, building } from '../world.js';
import { parkedCar, wall } from './common.js';

// Rua de mão dupla com uma casa do lado direito (x < 0). O portão fica em z = 0.
// Entrar de ré na garagem, passando pela calçada rebaixada.

const GATES = { facil: 2.8, padrao: 2.5, dificil: 2.3 };
const CURB_X = -6.0;
const SIDEWALK_W = 2.5;
const WALL_X = CURB_X - SIDEWALK_W; // muro da casa
const WALL_T = 0.2;
const GARAGE_DEPTH = 5.8;
const OTHER_CURB = 4.0;
const ROAD_LEN = 200;

export function createGaragem({ difficulty = 'padrao' } = {}) {
  const G = GATES[difficulty];
  const group = new THREE.Group();
  const obstacles = [];
  const ramp = G / 2 + 0.8; // trecho da calçada rebaixada

  // Rua
  group.add(groundRect(OTHER_CURB - CURB_X, ROAD_LEN, MATERIALS.asphalt, (CURB_X + OTHER_CURB) / 2, 0));
  for (const dx of [-0.08, 0.08]) group.add(groundRect(0.1, ROAD_LEN, MATERIALS.yellow, -1 + dx, 0, 0.004));

  // Calçada do lado da casa, com o meio-fio rebaixado na frente do portão
  const swX = CURB_X - SIDEWALK_W / 2;
  for (const s of [-1, 1]) {
    const zc = s * (ramp + (ROAD_LEN / 2 - ramp) / 2);
    const len = ROAD_LEN / 2 - ramp;
    group.add(box(SIDEWALK_W, 0.15, len, MATERIALS.sidewalk, swX, 0.075, zc));
    group.add(box(0.15, 0.16, len, MATERIALS.curb, CURB_X - 0.075, 0.08, zc));
    obstacles.push({ type: 'curb', label: 'meio-fio', x: swX, z: zc, h: 0, hl: len / 2, hw: SIDEWALK_W / 2 });
  }
  group.add(groundRect(SIDEWALK_W, ramp * 2, MATERIALS.sidewalk, swX, 0, 0.01));

  // Calçada do outro lado
  group.add(box(3, 0.15, ROAD_LEN, MATERIALS.sidewalk, OTHER_CURB + 1.5, 0.075, 0));
  obstacles.push({ type: 'curb', label: 'meio-fio', x: OTHER_CURB + 1.5, z: 0, h: 0, hl: ROAD_LEN / 2, hw: 1.5 });

  // Muro com o portão
  const wallX = WALL_X - WALL_T / 2;
  const sideLen = 14;
  wall(group, obstacles, wallX, -(G / 2 + sideLen / 2), WALL_T, sideLen, 1.9);
  wall(group, obstacles, wallX, G / 2 + sideLen / 2, WALL_T, sideLen, 1.9);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8a8580 });
  for (const s of [-1, 1]) wall(group, obstacles, wallX, s * (G / 2 + 0.15), 0.3, 0.3, 2.1, postMat);

  // Garagem: paredes laterais e do fundo (um pouco mais larga que o portão)
  const inner = G / 2 + 0.25;
  const backX = WALL_X - WALL_T - GARAGE_DEPTH;
  const garageMid = (WALL_X - WALL_T + backX) / 2;
  group.add(groundRect(GARAGE_DEPTH, inner * 2, new THREE.MeshStandardMaterial({ color: 0x9a968e }), garageMid, 0, 0.005));
  for (const s of [-1, 1]) wall(group, obstacles, garageMid, s * (inner + 0.1), GARAGE_DEPTH, 0.2, 2.6);
  wall(group, obstacles, backX - 0.1, 0, 0.2, inner * 2 + 0.4, 2.6);
  group.add(box(GARAGE_DEPTH + 0.4, 3.2, 14, new THREE.MeshStandardMaterial({ color: 0xe8d8b0 }), garageMid, 1.6, -inner - 7.2));
  group.add(box(GARAGE_DEPTH + 0.4, 3.2, 14, new THREE.MeshStandardMaterial({ color: 0xe8d8b0 }), garageMid, 1.6, inner + 7.2));

  // Carros na rua: dos dois lados do portão e do outro lado (deixam a rua mais estreita)
  const parkX = CURB_X + 0.25 + CAR.width / 2;
  parkedCar(group, obstacles, parkX, -(ramp + 1.0 + CAR.length / 2), 0, 2);
  parkedCar(group, obstacles, parkX, ramp + 1.2 + CAR.length / 2, 0, 5);
  parkedCar(group, obstacles, parkX, -(ramp + 7 + CAR.length / 2), 0, 3);
  const otherX = OTHER_CURB - 0.25 - CAR.width / 2;
  for (let i = 0; i < 6; i++) parkedCar(group, obstacles, otherX, -18 + i * 7.5, Math.PI, i + 1);

  for (let z = -90; z <= 90; z += 15) group.add(tree(OTHER_CURB + 1.5, z));
  let i = 0;
  for (let bz = -96; bz <= 96; bz += 16, i++) {
    if (Math.abs(bz) < 20) continue;
    group.add(building(WALL_X - 8, bz, 11, 14, 6 + (i % 3) * 3, i));
  }
  for (let bz = -96, j = 0; bz <= 96; bz += 16, j++) group.add(building(OTHER_CURB + 10, bz + 6, 11, 14, 7 + (j % 4) * 2, j + 2));

  return {
    name: 'Garagem estreita',
    sizeLabel: `portão ${String(G).replace('.', ',')} m`,
    report: 'sides',
    group,
    obstacles,
    // Dentro da garagem, frente virada para a rua (+X) = entrou de ré
    target: { x: garageMid, z: 0, h: Math.PI / 2, hl: GARAGE_DEPTH / 2, hw: inner },
    direction: 'reverse',
    start: { x: -3.5, z: -24, h: 0 },
    hint: 'Vá pelo lado esquerdo da sua faixa e passe do portão uns 2 m. Dê ré (S), gire tudo para a direita e endireite quando alinhar com o portão.',
  };
}
