import * as THREE from 'three';
import { CAR } from './car.js';

// Modelo 3D low-poly de um hatch. Origem no centro do eixo traseiro, frente em +Z, esquerda em +X.

const R = -CAR.rearOverhang; // traseira
const F = CAR.wheelbase + CAR.frontOverhang; // frente
const HW = CAR.width / 2;
const CABIN_HW = 0.74;

// Perfil lateral (z, y) da carroceria até a linha da cintura
const BODY_PROFILE = [
  [R + 0.02, 0.36], [F - 0.05, 0.36], [F + 0.02, 0.55], [F - 0.02, 0.76],
  [2.15, 0.93], [R + 0.12, 0.98], [R - 0.01, 0.86], [R - 0.02, 0.5],
];

// Pontos da cabine (z, y)
const WS_BOTTOM = [2.12, 0.94];
const WS_TOP = [1.3, 1.44];
const ROOF_BACK = [-0.32, 1.45];
const REAR_BOTTOM = [R + 0.1, 0.99];

function profileGeometry(points, width) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - 0.08,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -(width - 0.08) / 2);
  geo.rotateY(-Math.PI / 2); // x do perfil -> z do mundo
  return geo;
}

function quad(a, b, c, d) {
  const geo = new THREE.BufferGeometry();
  const v = [a, b, c, a, c, d].flat();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

function beam(p1, p2, thickness, material) {
  const a = new THREE.Vector3(...p1);
  const b = new THREE.Vector3(...p2);
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, len), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.lookAt(b);
  mesh.castShadow = true;
  return mesh;
}

function sideWindowGeometry() {
  const pts = [WS_BOTTOM, WS_TOP, ROOF_BACK, REAR_BOTTOM].map(([z, y]) => new THREE.Vector2(z, y));
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));
  geo.rotateY(-Math.PI / 2);
  return geo;
}

function makeWheel(tireMat, rimMat) {
  const pivot = new THREE.Group(); // gira para esterçar
  const spin = new THREE.Group(); // gira com o rolamento
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.2, 20), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.21, 10), rimMat);
  rim.rotation.z = Math.PI / 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.34, 0.05), tireMat);
  spin.add(tire, rim, spoke);
  pivot.add(spin);
  pivot.userData.spin = spin;
  return pivot;
}

export function buildCarModel({ color = 0xc8102e, interior = false } = {}) {
  const group = new THREE.Group();

  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.8 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({
    color: interior ? 0x9fc3d6 : 0x223344,
    transparent: true,
    opacity: interior ? 0.12 : 0.65,
    roughness: 0.1,
    metalness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const body = new THREE.Mesh(profileGeometry(BODY_PROFILE, CAR.width), paint);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Teto e colunas
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(CABIN_HW * 2, 0.05, WS_TOP[0] - ROOF_BACK[0] + 0.06),
    paint,
  );
  roof.position.set(0, 1.46, (WS_TOP[0] + ROOF_BACK[0]) / 2);
  roof.castShadow = true;
  group.add(roof);

  for (const sx of [1, -1]) {
    const x = sx * CABIN_HW;
    group.add(beam([x, WS_BOTTOM[1], WS_BOTTOM[0]], [x, WS_TOP[1], WS_TOP[0]], 0.07, paint)); // coluna A
    group.add(beam([x, 0.97, 0.75], [x, 1.45, 0.72], 0.08, paint)); // coluna B
    group.add(beam([x, REAR_BOTTOM[1], REAR_BOTTOM[0] + 0.05], [x, ROOF_BACK[1], ROOF_BACK[0] + 0.15], 0.16, paint)); // coluna C

    const win = new THREE.Mesh(sideWindowGeometry(), glass);
    win.position.x = x;
    group.add(win);

    // Retrovisor externo
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.08), paint);
    mirror.position.set(sx * (HW + 0.08), 1.02, 1.95);
    group.add(mirror);
  }

  // Para-brisa e vidro traseiro
  const ws = quad(
    [-CABIN_HW, WS_BOTTOM[1], WS_BOTTOM[0]], [CABIN_HW, WS_BOTTOM[1], WS_BOTTOM[0]],
    [CABIN_HW, WS_TOP[1], WS_TOP[0]], [-CABIN_HW, WS_TOP[1], WS_TOP[0]],
  );
  group.add(new THREE.Mesh(ws, glass));
  const rg = quad(
    [-CABIN_HW, REAR_BOTTOM[1], REAR_BOTTOM[0]], [CABIN_HW, REAR_BOTTOM[1], REAR_BOTTOM[0]],
    [CABIN_HW, ROOF_BACK[1], ROOF_BACK[0]], [-CABIN_HW, ROOF_BACK[1], ROOF_BACK[0]],
  );
  group.add(new THREE.Mesh(rg, glass));

  // Faróis, lanternas, placas e para-choques
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666655 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0x440000 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
  for (const sx of [1, -1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), headMat);
    hl.position.set(sx * 0.6, 0.72, F + 0.0);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.05), tailMat);
    tl.position.set(sx * 0.66, 0.84, R - 0.03);
    group.add(tl);
  }
  for (const [z, y] of [[F + 0.04, 0.5], [R - 0.05, 0.62]]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.02), plateMat);
    plate.position.set(0, y, z);
    group.add(plate);
  }
  for (const z of [F - 0.02, R + 0.03]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.05, 0.14, 0.12), dark);
    bumper.position.set(0, 0.42, z);
    group.add(bumper);
  }

  // Rodas
  const wheels = [];
  const frontWheels = [];
  for (const [sx, z] of [[1, 0], [-1, 0], [1, CAR.wheelbase], [-1, CAR.wheelbase]]) {
    const w = makeWheel(tireMat, rimMat);
    w.position.set(sx * (CAR.track / 2), CAR.wheelRadius, z);
    group.add(w);
    wheels.push(w);
    if (z > 0) frontWheels.push(w);
  }

  // Interior básico (só no carro do jogador)
  let steeringWheel = null;
  if (interior) {
    const cabin = new THREE.Group();
    const dash = new THREE.Mesh(new THREE.BoxGeometry(CABIN_HW * 2 - 0.05, 0.16, 0.45), dark);
    dash.position.set(0, 0.93, 1.9);
    cabin.add(dash);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
    for (const sx of [1, -1]) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.12), seatMat);
      back.position.set(sx * 0.37, 1.12, 0.6);
      back.rotation.x = -0.18;
      cabin.add(back);
    }
    const rearSeat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.12), seatMat);
    rearSeat.position.set(0, 1.05, -0.15);
    rearSeat.rotation.x = -0.2;
    cabin.add(rearSeat);

    // Volante 3D (motorista do lado esquerdo = +X)
    steeringWheel = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 10, 32), dark);
    const spokeMat = new THREE.MeshStandardMaterial({ color: 0x333338 });
    const spokeH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.02), spokeMat);
    const spokeV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.02), spokeMat);
    spokeV.position.y = -0.085;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.03, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x554400 }),
    );
    mark.position.y = 0.18; // marca no topo para ver as voltas
    steeringWheel.add(ring, spokeH, spokeV, mark);
    const column = new THREE.Group();
    column.position.set(0.37, 0.95, 1.48);
    column.rotation.x = 0.45; // inclinação da coluna de direção
    column.rotation.y = Math.PI;
    column.add(steeringWheel);
    cabin.add(column);

    // O interior fica na camada 1: aparece para o motorista mas não bloqueia os retrovisores
    cabin.traverse((o) => o.layers.set(1));
    group.add(cabin);
  }

  return { group, wheels, frontWheels, steeringWheel };
}

export function syncCarModel(model, state) {
  model.group.position.set(state.x, 0, state.z);
  model.group.rotation.y = state.h;
  for (const w of model.wheels) w.userData.spin.rotation.x = state.wheelSpin;
  for (const w of model.frontWheels) w.rotation.y = state.wheelAngle;
  if (model.steeringWheel) model.steeringWheel.rotation.z = state.steer * (Math.PI / 180);
}
