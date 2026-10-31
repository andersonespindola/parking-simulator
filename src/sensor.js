import { SENSOR_POINTS } from './car.js';
import { localToWorld, pointToObbDist } from './geometry.js';

export const SENSOR_RANGE = 1.5; // metros
const CONTINUOUS = 0.3; // abaixo disso o bipe fica contínuo

// Carros e paredes; meio-fio e batente são baixos demais para a carroceria (e para o sensor)
export const isSolid = (o) => o.type === 'car' || o.type === 'wall';

// Distâncias de cada ponto de sensor até o obstáculo mais próximo
export function readSensors(s, obstacles) {
  const solid = obstacles.filter(isSolid);
  const read = (pts) =>
    pts.map(({ lx, lz }) => {
      const p = localToWorld(s.x, s.z, s.h, lx, lz);
      let d = Infinity;
      for (const o of solid) d = Math.min(d, pointToObbDist(p.x, p.z, o));
      return d;
    });
  return { rear: read(SENSOR_POINTS.rear), front: read(SENSOR_POINTS.front) };
}

export class Sounds {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.timer = 0;
    this.tone = null;
  }

  // O navegador só libera áudio depois de um clique
  unlock() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  beep(freq, length = 0.07) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
    gain.gain.setValueAtTime(0.18, t + length - 0.01);
    gain.gain.linearRampToValueAtTime(0, t + length);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  setContinuous(freq) {
    if (!this.ctx) return;
    if (freq && !this.muted) {
      if (!this.tone) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        gain.gain.value = 0.14;
        osc.connect(gain).connect(this.ctx.destination);
        osc.start();
        this.tone = { osc, gain };
      }
      this.tone.osc.frequency.value = freq;
    } else if (this.tone) {
      this.tone.osc.stop();
      this.tone = null;
    }
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = 0.35;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.8;
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t);
  }

  // Bipes do sensor: quanto mais perto, mais rápido
  updateSensor(dt, distance, freq) {
    if (distance === null || distance > SENSOR_RANGE) {
      this.setContinuous(null);
      this.timer = 0;
      return;
    }
    if (distance < CONTINUOUS) {
      this.setContinuous(freq);
      return;
    }
    this.setContinuous(null);
    const t = (distance - CONTINUOUS) / (SENSOR_RANGE - CONTINUOUS);
    const interval = 0.08 + t * 0.5;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.beep(freq);
      this.timer = interval;
    }
  }

  stopAll() {
    this.setContinuous(null);
  }
}
