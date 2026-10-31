import { forward, localToWorld } from './geometry.js';

const DEG = Math.PI / 180;

// Hatch compacto (medidas aproximadas de Onix / HB20)
export const CAR = {
  length: 4.0,
  width: 1.73,
  wheelbase: 2.53,
  rearOverhang: 0.67,
  frontOverhang: 0.8,
  track: 1.48,
  wheelRadius: 0.31,
  maxWheelAngle: 33 * DEG, // ângulo máximo das rodas dianteiras
  steeringLock: 540, // graus do volante do centro ao batente (1,5 volta)
};

// Distância do eixo traseiro até o centro da carroceria
export const BODY_OFFSET = CAR.length / 2 - CAR.rearOverhang;

const STEER_RATE = 600; // graus de volante por segundo com a tecla pressionada
const MAX_FORWARD = 15 / 3.6;
const MAX_REVERSE = 6 / 3.6; // ré devagar, como em manobra de verdade
const ACCEL = 2.0;
const BRAKE_DECEL = 6.0; // apertando a tecla do sentido contrário
const COAST_DECEL = 5.0; // soltando as teclas o carro para logo (pé no freio)

export class CarState {
  constructor() {
    this.reset({ x: 0, z: 0, h: 0 });
  }

  reset(pose) {
    this.x = pose.x; // posição do centro do eixo traseiro
    this.z = pose.z;
    this.h = pose.h;
    this.v = 0; // velocidade com sinal (+ frente, - ré)
    this.steer = 0; // ângulo do volante em graus (+ esquerda)
    this.direction = 1; // último sentido pedido: 1 frente, -1 ré
    this.wheelSpin = 0;
  }

  get reversing() {
    return this.direction < 0;
  }

  get wheelAngle() {
    return (this.steer / CAR.steeringLock) * CAR.maxWheelAngle;
  }

  get speedKmh() {
    return Math.abs(this.v) * 3.6;
  }

  // Controles: { forward, backward, brake, steerLeft, steerRight, steerDelta }
  update(dt, input) {
    // Volante
    let steerInput = 0;
    if (input.steerLeft) steerInput += 1;
    if (input.steerRight) steerInput -= 1;
    this.steer += steerInput * STEER_RATE * dt + (input.steerDelta || 0);

    // Andando para frente o volante volta sozinho devagar (cáster); na ré, não
    if (steerInput === 0 && !input.steerDragging && this.v > 0.3) {
      const back = Math.min(Math.abs(this.steer), this.v * 28 * dt);
      this.steer -= Math.sign(this.steer) * back;
    }
    this.steer = Math.max(-CAR.steeringLock, Math.min(CAR.steeringLock, this.steer));

    // Sem câmbio: W/↑ anda para frente, S/↓ dá ré. Indo num sentido, a tecla do outro freia primeiro.
    const want = input.forward && !input.backward ? 1 : input.backward && !input.forward ? -1 : 0;
    let decel = 0;
    if (want !== 0) {
      const along = this.v * want;
      if (along < -0.05) {
        decel = BRAKE_DECEL;
      } else {
        this.direction = want;
        const max = want > 0 ? MAX_FORWARD : MAX_REVERSE;
        this.v += want * ACCEL * Math.max(0, 1 - along / max) * dt;
      }
    } else {
      decel = COAST_DECEL;
    }
    if (input.brake) decel = BRAKE_DECEL;
    const dv = Math.min(Math.abs(this.v), decel * dt);
    this.v -= Math.sign(this.v) * dv;

    // Modelo de bicicleta: o eixo traseiro segue a direção do carro
    const f = forward(this.h);
    this.x += f.x * this.v * dt;
    this.z += f.z * this.v * dt;
    this.h += (this.v / CAR.wheelbase) * Math.tan(this.wheelAngle) * dt;
    this.wheelSpin += (this.v / CAR.wheelRadius) * dt;
  }

  snapshot() {
    return { x: this.x, z: this.z, h: this.h };
  }

  restore(s) {
    this.x = s.x;
    this.z = s.z;
    this.h = s.h;
  }
}

export function bodyObb(s) {
  const f = forward(s.h);
  return {
    x: s.x + f.x * BODY_OFFSET,
    z: s.z + f.z * BODY_OFFSET,
    h: s.h,
    hl: CAR.length / 2,
    hw: CAR.width / 2,
  };
}

// Pegada das quatro rodas no chão (usada para o meio-fio)
export function wheelObbs(s) {
  const t = CAR.track / 2;
  const spots = [
    { name: 'traseira esquerda', lx: t, lz: 0 },
    { name: 'traseira direita', lx: -t, lz: 0 },
    { name: 'dianteira esquerda', lx: t, lz: CAR.wheelbase },
    { name: 'dianteira direita', lx: -t, lz: CAR.wheelbase },
  ];
  return spots.map((w) => {
    const p = localToWorld(s.x, s.z, s.h, w.lx, w.lz);
    return { name: w.name, x: p.x, z: p.z, h: s.h, hl: CAR.wheelRadius, hw: 0.1 };
  });
}

// Pontos dos sensores de estacionamento (lateral, frente) em coordenadas locais
export const SENSOR_POINTS = {
  rear: [0.72, 0.28, -0.28, -0.72].map((lx) => ({ lx, lz: -CAR.rearOverhang })),
  front: [0.72, 0.28, -0.28, -0.72].map((lx) => ({ lx, lz: CAR.wheelbase + CAR.frontOverhang })),
};
