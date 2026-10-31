import * as THREE from 'three';
import { CAR } from './car.js';
import { forward, localToWorld } from './geometry.js';

const STEPS = 40;
const LENGTH = 6; // metros projetados

// Linhas no chão mostrando por onde os cantos do carro vão passar (ligue/desligue com T)
export class Trajectory {
  constructor(scene) {
    this.lines = [0, 1].map(() => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STEPS * 3), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd400 }));
      line.frustumCulled = false;
      scene.add(line);
      return line;
    });
    this.visible = false;
    this.setVisible(false);
  }

  setVisible(v) {
    this.visible = v;
    for (const l of this.lines) l.visible = v;
  }

  update(s) {
    if (!this.visible) return;
    const dir = s.reversing ? -1 : 1;
    const lz = dir < 0 ? -CAR.rearOverhang : CAR.wheelbase + CAR.frontOverhang;
    const corners = [CAR.width / 2, -CAR.width / 2];
    const ds = LENGTH / (STEPS - 1);
    let x = s.x, z = s.z, h = s.h;
    const tan = Math.tan(s.wheelAngle);
    for (let i = 0; i < STEPS; i++) {
      corners.forEach((lx, j) => {
        const p = localToWorld(x, z, h, lx, lz);
        this.lines[j].geometry.attributes.position.setXYZ(i, p.x, 0.03, p.z);
      });
      const f = forward(h);
      x += f.x * ds * dir;
      z += f.z * ds * dir;
      h += (ds * dir * tan) / CAR.wheelbase;
    }
    for (const l of this.lines) l.geometry.attributes.position.needsUpdate = true;
  }
}
