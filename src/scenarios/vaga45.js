import * as THREE from 'three';
import { MATERIALS, box, groundRect, tree, building } from '../world.js';
import { forward, left } from '../geometry.js';
import { parkedCar, stopper, paintLine, hedge } from './common.js';

// Estacionamento com vagas a 45° do lado direito de um corredor de mão única (sentido +Z).
// Pode entrar de frente ou de ré.

const WIDTHS = { facil: 2.8, padrao: 2.5, dificil: 2.3 };
const DEPTH = 5.0;
const AISLE = 5.0;
const COUNT = 7; // vagas para cada lado da alvo
const H_IN = -Math.PI / 4; // rumo de quem entra de frente

export function createVaga45({ difficulty = 'padrao' } = {}) {
  const W = WIDTHS[difficulty];
  const group = new THREE.Group();
  const obstacles = [];
  const d = forward(H_IN); // para dentro da vaga
  const l = left(H_IN);
  const spacing = W * Math.SQRT2; // distância entre vagas ao longo do corredor

  const stallCenter = (i) => ({ x: d.x * DEPTH / 2, z: i * spacing + d.z * DEPTH / 2 });

  const zMin = -COUNT * spacing - 10;
  const zMax = COUNT * spacing + 12;
  const zMid = (zMin + zMax) / 2;
  group.add(groundRect(AISLE + 8, zMax - zMin, MATERIALS.asphalt, (AISLE - 8) / 2 + 0.5, zMid));

  for (let i = -COUNT; i <= COUNT; i++) {
    const c = stallCenter(i);
    // Faixas laterais da vaga
    for (const s of [-1, 1]) {
      const a = { x: c.x - d.x * DEPTH / 2 + l.x * s * W / 2, z: c.z - d.z * DEPTH / 2 + l.z * s * W / 2 };
      const b = { x: c.x + d.x * DEPTH / 2 + l.x * s * W / 2, z: c.z + d.z * DEPTH / 2 + l.z * s * W / 2 };
      paintLine(group, a, b);
    }
    stopper(group, obstacles, c.x + d.x * 1.75, c.z + d.z * 1.75, H_IN);
    if (i === 0) continue;
    const reversed = (i * 7) % 5 === 0;
    const off = 0.15 + (((i * 13) % 5) - 2) * 0.03;
    parkedCar(group, obstacles, c.x + d.x * off, c.z + d.z * off, reversed ? H_IN + Math.PI : H_IN, i + 9);
  }

  // Fundo das vagas e canteiro do outro lado do corredor (com meio-fio)
  hedge(group, obstacles, -5.3, zMid, 1.0, zMax - zMin);
  const islandX = AISLE + 1.5;
  group.add(box(3, 0.15, zMax - zMin, MATERIALS.sidewalk, islandX, 0.075, zMid));
  obstacles.push({ type: 'curb', label: 'meio-fio', x: islandX, z: zMid, h: 0, hl: (zMax - zMin) / 2, hw: 1.5 });
  for (let z = zMin + 3; z < zMax; z += 8) group.add(tree(islandX, z));
  group.add(building(-22, zMid, 26, 60, 9, 3));

  // Setas de mão única no chão
  for (let z = zMin + 6; z < zMax; z += 14) {
    const arrow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 3), MATERIALS.white);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = -Math.PI / 2; // aponta para +Z
    arrow.position.set(AISLE / 2 + 0.3, 0.004, z);
    group.add(arrow);
  }

  const c0 = stallCenter(0);
  return {
    name: 'Vaga a 45°',
    sizeLabel: `vaga ${String(W).replace('.', ',')} m de largura`,
    report: 'sides',
    group,
    obstacles,
    target: { x: c0.x, z: c0.z, h: H_IN, hl: DEPTH / 2, hw: W / 2 },
    direction: 'any',
    start: { x: 2.6, z: -22, h: 0 },
    hint: 'De frente: quando o retrovisor passar da primeira faixa da vaga, gire para a direita. Dá para entrar de ré também.',
  };
}
