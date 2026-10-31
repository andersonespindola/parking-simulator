import * as THREE from 'three';
import { CAR } from '../car.js';
import { MATERIALS, box, groundRect, tree, building } from '../world.js';
import { parkedCar } from './common.js';

// Baliza: rua de mão dupla, estacionamento do lado direito (sentido +Z).
// A vaga fica entre dois carros, de z = 0 até z = gap.

const CURB_X = -6.0; // face do meio-fio direito
const LANE_LEFT_EDGE = 3.8; // meio-fio do outro lado
const SIDEWALK_W = 4;
const CURB_H = 0.15;
const ROAD_LEN = 260;
const PARKED_GAP_TO_CURB = 0.25;
const GAPS = { facil: 6.5, padrao: 5.6, dificil: 5.0 };

export function createBaliza({ difficulty = 'padrao' } = {}) {
  const gap = GAPS[difficulty];
  const group = new THREE.Group();
  const obstacles = [];

  // Asfalto
  const roadW = LANE_LEFT_EDGE - CURB_X;
  group.add(groundRect(roadW, ROAD_LEN, MATERIALS.asphalt, (CURB_X + LANE_LEFT_EDGE) / 2, 0));

  // Faixa amarela dupla no centro e linha da borda do estacionamento
  for (const dx of [-0.08, 0.08]) {
    group.add(groundRect(0.1, ROAD_LEN, MATERIALS.yellow, dx, 0, 0.004));
  }

  // Calçadas com meio-fio (os dois lados)
  for (const side of [-1, 1]) {
    const face = side < 0 ? CURB_X : LANE_LEFT_EDGE;
    const cx = face + side * (SIDEWALK_W / 2);
    group.add(box(SIDEWALK_W, CURB_H, ROAD_LEN, MATERIALS.sidewalk, cx, CURB_H / 2, 0));
    group.add(box(0.15, CURB_H + 0.01, ROAD_LEN, MATERIALS.curb, face + side * 0.075, (CURB_H + 0.01) / 2, 0));
    obstacles.push({ type: 'curb', label: 'meio-fio', x: cx, z: 0, h: 0, hl: ROAD_LEN / 2, hw: SIDEWALK_W / 2 });
  }

  // Carros estacionados do lado direito
  const parkX = CURB_X + PARKED_GAP_TO_CURB + CAR.width / 2;
  parkedCar(group, obstacles, parkX, -CAR.length / 2, 0, 0); // carro de trás da vaga
  parkedCar(group, obstacles, parkX, gap + CAR.length / 2, 0, 1); // carro da frente
  let z = -CAR.length / 2;
  for (let i = 0; i < 4; i++) {
    z -= CAR.length + 1.2 + (i % 2) * 0.6;
    parkedCar(group, obstacles, parkX + (i % 2) * 0.1, z, 0, i + 2);
  }
  z = gap + CAR.length / 2;
  for (let i = 0; i < 4; i++) {
    z += CAR.length + 1.0 + (i % 3) * 0.5;
    parkedCar(group, obstacles, parkX - (i % 2) * 0.05, z, 0, i + 4);
  }

  // Carros estacionados do outro lado (mão contrária)
  const otherX = LANE_LEFT_EDGE - PARKED_GAP_TO_CURB - CAR.width / 2;
  for (let i = 0; i < 6; i++) {
    parkedCar(group, obstacles, otherX, -30 + i * 9.5 + (i % 2) * 2, Math.PI, i + 1);
  }

  // Árvores e prédios
  for (let tz = -100; tz <= 100; tz += 14) {
    group.add(tree(CURB_X - 1.2, tz + 5));
    group.add(tree(LANE_LEFT_EDGE + 1.2, tz));
  }
  let i = 0;
  for (let bz = -110; bz <= 110; bz += 16, i++) {
    const h = 6 + ((i * 7) % 5) * 3;
    group.add(building(CURB_X - SIDEWALK_W - 6, bz, 11, 14, h, i));
    group.add(building(LANE_LEFT_EDGE + SIDEWALK_W + 6, bz + 6, 11, 14, h + 3, i + 2));
  }

  // Vaga alvo (faixa de estacionamento entre os dois carros)
  const laneW = 2.2;
  const target = { x: CURB_X + laneW / 2, z: gap / 2, h: 0, hl: gap / 2, hw: laneW / 2 };

  return {
    name: 'Baliza',
    sizeLabel: `vaga ${String(gap).replace('.', ',')} m`,
    report: 'curb', // avalia distância do meio-fio e espaço na frente/atrás
    group,
    obstacles,
    target,
    // Começa na faixa da direita, atrás da vaga
    start: { x: -1.9, z: -22, h: 0 },
    hint: 'Pare ao lado do carro da frente. Segure S para dar ré e gire o volante todo para a direita.',
  };
}
