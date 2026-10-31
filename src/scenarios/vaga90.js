import * as THREE from 'three';
import { MATERIALS, groundRect, tree, building } from '../world.js';
import { parkedCar, stopper, paintLine, hedge } from './common.js';

// Estacionamento de supermercado: corredor ao longo de Z, vagas a 90° dos dois lados.
// A vaga alvo fica do lado direito (x < 0), de z = 0 até z = W. Entrar de ré.

const WIDTHS = { facil: 2.8, padrao: 2.5, dificil: 2.3 };
const DEPTH = 5.0;
const AISLE = 6.0;
const ROWS = 7; // vagas para cada lado da alvo

export function createVaga90({ difficulty = 'padrao' } = {}) {
  const W = WIDTHS[difficulty];
  const group = new THREE.Group();
  const obstacles = [];

  const zMin = -ROWS * W - 6;
  const zMax = (ROWS + 1) * W + 6;
  const len = zMax - zMin;
  const zMid = (zMin + zMax) / 2;
  const leftRow = AISLE; // início das vagas do lado esquerdo

  group.add(groundRect(AISLE + DEPTH * 2 + 2, len, MATERIALS.asphalt, AISLE / 2, zMid));

  // Fileira da direita (alvo) e da esquerda
  for (let i = -ROWS; i <= ROWS + 1; i++) {
    const z0 = i * W;
    paintLine(group, { x: -DEPTH, z: z0 }, { x: 0, z: z0 });
    paintLine(group, { x: leftRow, z: z0 }, { x: leftRow + DEPTH, z: z0 });
  }
  paintLine(group, { x: -DEPTH, z: -ROWS * W }, { x: -DEPTH, z: (ROWS + 1) * W });
  paintLine(group, { x: leftRow + DEPTH, z: -ROWS * W }, { x: leftRow + DEPTH, z: (ROWS + 1) * W });

  for (let i = -ROWS; i <= ROWS; i++) {
    const zc = (i + 0.5) * W;
    // Batente para a roda traseira de quem entra de ré
    stopper(group, obstacles, -DEPTH + 0.75, zc, Math.PI / 2);
    if (i === 0) continue;
    const jitter = (((i * 37) % 7) - 3) * 0.04;
    // Uns entraram de ré (frente para o corredor), outros de frente
    const reversed = (i * 5) % 3 !== 0;
    parkedCar(group, obstacles, -2.55 + jitter, zc + jitter, reversed ? Math.PI / 2 : -Math.PI / 2, i + 7);
    // Lado esquerdo com algumas vagas livres
    if ((i * 3) % 4 !== 1) {
      parkedCar(group, obstacles, leftRow + 2.45 - jitter, zc - jitter, Math.PI / 2 * ((i % 2) ? 1 : -1), i + 3);
    }
  }

  // Cercas vivas no fundo das duas fileiras
  hedge(group, obstacles, -DEPTH - 0.8, zMid, 1.0, len);
  hedge(group, obstacles, leftRow + DEPTH + 0.8, zMid, 1.0, len);
  for (let z = zMin + 4; z < zMax; z += 9) {
    group.add(tree(-DEPTH - 0.8, z));
    group.add(tree(leftRow + DEPTH + 0.8, z + 4));
  }
  group.add(building(-DEPTH - 22, zMid, 26, 60, 9, 1));

  return {
    name: 'Vaga a 90° de ré',
    sizeLabel: `vaga ${String(W).replace('.', ',')} m de largura`,
    report: 'sides',
    group,
    obstacles,
    // Frente do carro virada para o corredor (+X) = entrou de ré
    target: { x: -DEPTH / 2, z: W / 2, h: Math.PI / 2, hl: DEPTH / 2, hw: W / 2 },
    direction: 'reverse',
    start: { x: 3.2, z: -16, h: 0 },
    hint: 'Passe a vaga livre até a traseira ficar uns 1,5 m depois dela. Dê ré (S) com o volante todo para a direita.',
  };
}
