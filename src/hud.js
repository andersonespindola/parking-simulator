import { CAR } from './car.js';
import { SENSOR_RANGE } from './sensor.js';

const $ = (id) => document.getElementById(id);

const BAR_LEVELS = [
  { max: SENSOR_RANGE, color: '#3ccf5a' },
  { max: 0.9, color: '#ffc928' },
  { max: 0.4, color: '#ff3b30' },
];

function fmt(n, digits = 1) {
  return n.toFixed(digits).replace('.', ',');
}

export function formatTurns(steerDeg) {
  if (Math.abs(steerDeg) < 5) return 'Volante no centro';
  const turns = Math.abs(steerDeg) / 360;
  const side = steerDeg > 0 ? 'esquerda' : 'direita';
  const atLock = Math.abs(steerDeg) >= CAR.steeringLock - 1;
  return `${fmt(turns)} ${turns >= 2 ? 'voltas' : 'volta'} p/ ${side}${atLock ? ' (batente)' : ''}`;
}

export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class Hud {
  constructor() {
    this.wheel = $('wheel-rotor');
    this.turns = $('wheel-turns');
    this.speed = $('speed');
    this.dirForward = $('dir-forward');
    this.dirReverse = $('dir-reverse');
    this.frontWheels = [$('tv-wheel-fl'), $('tv-wheel-fr')];
    this.sensorReadout = $('sensor-readout');
    this.camera = $('camera-label');
    this.time = $('stat-time');
    this.adjust = $('stat-adjust');
    this.hits = $('stat-hits');
    this.toastEl = $('toast');
    this.toastTimer = null;
    this.bars = { rear: [], front: [] };
    this.buildSensorBars();
  }

  buildSensorBars() {
    const svg = $('topview');
    const ns = 'http://www.w3.org/2000/svg';
    // Carro desenhado de x=35 a 85, y=40 (frente) a 160 (traseira)
    for (const side of ['front', 'rear']) {
      for (let zone = 0; zone < 4; zone++) {
        const bars = [];
        for (let level = 0; level < 3; level++) {
          const r = document.createElementNS(ns, 'rect');
          const offset = 6 + (2 - level) * 8;
          r.setAttribute('x', 35 + zone * 12.5 + 1);
          r.setAttribute('width', 10.5);
          r.setAttribute('height', 5);
          r.setAttribute('rx', 1.5);
          r.setAttribute('y', side === 'front' ? 40 - offset - 5 : 160 + offset);
          r.setAttribute('fill', '#ffffff22');
          svg.appendChild(r);
          bars.push(r);
        }
        this.bars[side].push(bars);
      }
    }
  }

  update(car, sensors, sensorsActive) {
    this.wheel.style.transform = `rotate(${-car.steer}deg)`;
    this.turns.textContent = formatTurns(car.steer);
    this.speed.textContent = `${Math.round(car.speedKmh)}`;
    const moving = Math.abs(car.v) > 0.05;
    this.dirForward.classList.toggle('active', moving && !car.reversing);
    this.dirReverse.classList.toggle('active', moving && car.reversing);

    const a = (-car.wheelAngle * 180) / Math.PI;
    this.frontWheels[0].setAttribute('transform', `rotate(${a} 37 62)`);
    this.frontWheels[1].setAttribute('transform', `rotate(${a} 83 62)`);

    let closest = Infinity;
    for (const side of ['front', 'rear']) {
      const active = sensorsActive[side];
      sensors[side].forEach((d, zone) => {
        BAR_LEVELS.forEach((lv, level) => {
          const on = active && d <= lv.max;
          this.bars[side][zone][level].setAttribute('fill', on ? lv.color : '#ffffff22');
        });
        if (active) closest = Math.min(closest, d);
      });
    }
    this.sensorReadout.textContent = closest <= SENSOR_RANGE ? `${fmt(closest, 2)} m` : '';
  }

  setCamera(label) {
    this.camera.textContent = label;
  }

  setStats({ time, adjustments, hits, curbs }, exam = null) {
    if (exam) {
      const left = exam.remaining(time);
      $('lbl-time').textContent = 'Restam';
      this.time.textContent = formatTime(Math.ceil(left));
      this.time.classList.toggle('danger', left < 30);
      this.adjust.textContent = `${adjustments} / ${exam.maxAdjustments}`;
      this.adjust.classList.toggle('danger', adjustments > exam.maxAdjustments);
      $('lbl-hits').textContent = 'Pontos perdidos';
      this.hits.textContent = `${exam.points} / ${exam.maxPoints}`;
      this.hits.classList.toggle('danger', exam.points > exam.maxPoints);
    } else {
      $('lbl-time').textContent = 'Tempo';
      this.time.textContent = formatTime(time);
      this.adjust.textContent = adjustments;
      $('lbl-hits').textContent = 'Batidas / meio-fio';
      this.hits.textContent = `${hits} / ${curbs}`;
      for (const el of [this.time, this.adjust, this.hits]) el.classList.remove('danger');
    }
  }

  toast(text, kind = 'info', ms = 2200) {
    this.toastEl.textContent = text;
    this.toastEl.className = `show ${kind}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastEl.className = ''), ms);
  }

  // result: { title, kind: 'ok' | 'warn' | 'bad', subtitle?, faults?, items, exam }
  showResult(result) {
    const title = $('result-title');
    title.textContent = result.title;
    title.className = result.kind;
    $('result-sub').textContent = result.subtitle || '';
    $('result-faults').innerHTML = (result.faults || [])
      .map((f) => {
        const pts = f.severity === 'eliminatoria' ? 'Eliminatória' : `${f.severityLabel} · ${f.points} pt`;
        return `<li><span>${f.label}</span><span class="sev ${f.severity}">${pts}</span></li>`;
      })
      .join('');
    $('result-list').innerHTML = result.items
      .map((it) => `<li class="${it.ok ? 'ok' : 'bad'}"><span>${it.label}</span><b>${it.value}</b></li>`)
      .join('');
    $('btn-retry').textContent = result.exam ? 'Refazer exame' : 'Recomeçar';
    $('btn-continue').style.display = result.exam ? 'none' : '';
    $('result').classList.add('show');
  }

  hideResult() {
    $('result').classList.remove('show');
  }
}

// Volante na tela também pode ser girado arrastando com o mouse
export function makeWheelDraggable(onDelta, onDragState) {
  const el = $('wheel');
  let last = null;
  const angleAt = (e) => {
    const r = el.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  el.addEventListener('pointerdown', (e) => {
    last = angleAt(e);
    el.setPointerCapture(e.pointerId);
    onDragState(true);
  });
  el.addEventListener('pointermove', (e) => {
    if (last === null) return;
    const a = angleAt(e);
    let d = a - last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    last = a;
    onDelta(-d); // horário na tela = virar para a direita
  });
  const end = () => {
    last = null;
    onDragState(false);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
