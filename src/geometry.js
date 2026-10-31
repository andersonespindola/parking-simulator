// Geometria 2D no plano do chão (X, Z).
// Retângulo orientado (OBB): { x, z, h, hl, hw }
//   x, z  = centro
//   h     = rumo (heading); frente = (sin h, cos h)
//   hl    = meio comprimento (eixo da frente)
//   hw    = meia largura (eixo lateral)

export function forward(h) {
  return { x: Math.sin(h), z: Math.cos(h) };
}

// Lado esquerdo do carro (com +Z para frente, a esquerda é +X)
export function left(h) {
  return { x: Math.cos(h), z: -Math.sin(h) };
}

export function obbCorners(o) {
  const f = forward(o.h);
  const l = left(o.h);
  const pts = [];
  for (const [sf, sl] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    pts.push({
      x: o.x + f.x * o.hl * sf + l.x * o.hw * sl,
      z: o.z + f.z * o.hl * sf + l.z * o.hw * sl,
    });
  }
  return pts;
}

function projectRadius(o, ax) {
  const f = forward(o.h);
  const l = left(o.h);
  return o.hl * Math.abs(f.x * ax.x + f.z * ax.z) + o.hw * Math.abs(l.x * ax.x + l.z * ax.z);
}

// Teste de sobreposição por eixos separadores (SAT)
export function obbOverlap(a, b) {
  const axes = [forward(a.h), left(a.h), forward(b.h), left(b.h)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const ax of axes) {
    const dist = Math.abs(dx * ax.x + dz * ax.z);
    if (dist > projectRadius(a, ax) + projectRadius(b, ax)) return false;
  }
  return true;
}

export function pointToObbDist(px, pz, o) {
  const f = forward(o.h);
  const l = left(o.h);
  const dx = px - o.x;
  const dz = pz - o.z;
  const lf = dx * f.x + dz * f.z;
  const ll = dx * l.x + dz * l.z;
  const ex = Math.max(Math.abs(ll) - o.hw, 0);
  const ez = Math.max(Math.abs(lf) - o.hl, 0);
  return Math.hypot(ex, ez);
}

export function pointInObb(px, pz, o, margin = 0) {
  return pointToObbDist(px, pz, { ...o, hl: o.hl + margin, hw: o.hw + margin }) === 0;
}

// Converte um ponto local do carro (lateral, frente) para o mundo
export function localToWorld(x, z, h, lx, lz) {
  const f = forward(h);
  const l = left(h);
  return { x: x + l.x * lx + f.x * lz, z: z + l.z * lx + f.z * lz };
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
