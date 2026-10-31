import * as THREE from 'three';

// Elementos comuns a todos os cenários: céu, luz e chão

export function createWorld(scene) {
  scene.background = new THREE.Color(0xa9cbe6);
  scene.fog = new THREE.Fog(0xa9cbe6, 60, 220);

  const hemi = new THREE.HemisphereLight(0xdfefff, 0x5a6a4a, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
  sun.position.set(25, 40, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -30;
  sc.right = 30;
  sc.top = 30;
  sc.bottom = -30;
  sc.near = 1;
  sc.far = 120;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: 0x6f8f4e, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.01;
  grass.receiveShadow = true;
  scene.add(grass);

  // A sombra acompanha o carro
  function follow(x, z) {
    sun.position.set(x + 25, 40, z + 15);
    sun.target.position.set(x, 0, z);
  }

  return { follow };
}

// Utilidades para montar cenários

export const MATERIALS = {
  asphalt: new THREE.MeshStandardMaterial({ color: 0x3d3f43, roughness: 0.95 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.9 }),
  curb: new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.85 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.7 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xd9cfc0, roughness: 0.9 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a2b }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 }),
};

export function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function groundRect(w, d, material, x, z, y = 0.002) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

export function tree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 8), MATERIALS.trunk);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), MATERIALS.leaves);
  top.position.y = 3.0;
  top.castShadow = true;
  g.add(trunk, top);
  g.position.set(x, 0.15, z);
  return g;
}

const BUILDING_COLORS = [0xd9cfc0, 0xc9d6df, 0xe8d8b0, 0xd7b9a8, 0xbfc9b3];

export function building(x, z, w, d, h, i) {
  const mat = new THREE.MeshStandardMaterial({ color: BUILDING_COLORS[i % BUILDING_COLORS.length], roughness: 0.9 });
  return box(w, h, d, mat, x, h / 2, z);
}
