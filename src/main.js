import * as THREE from 'three';
import { CAR, CarState, bodyObb, wheelObbs } from './car.js';
import { buildCarModel, syncCarModel } from './carModel.js';
import { createWorld } from './world.js';
import { createBaliza } from './scenarios/baliza.js';
import { createVaga90 } from './scenarios/vaga90.js';
import { createVaga45 } from './scenarios/vaga45.js';
import { createGaragem } from './scenarios/garagem.js';
import { CameraRig, Mirrors } from './cameras.js';
import { Hud, makeWheelDraggable, formatTime } from './hud.js';
import { readSensors, Sounds, isSolid } from './sensor.js';
import { Trajectory } from './trajectory.js';
import { obbOverlap, obbCorners, pointInObb, pointToObbDist, angleDiff, localToWorld } from './geometry.js';
import { Exam, EXAM_RULES, loadHistory, saveToHistory } from './exam.js';

const SCENARIOS = { baliza: createBaliza, vaga90: createVaga90, vaga45: createVaga45, garagem: createGaragem };

// Texto das opções de dificuldade para cada cenário
const SIZE_TEXT = {
  baliza: ['vaga de 6,5 m', 'padrão Detran: vaga de 5,6 m', 'vaga de 5,0 m'],
  vaga90: ['vaga de 2,8 m', 'vaga de 2,5 m', 'vaga de 2,3 m'],
  vaga45: ['vaga de 2,8 m', 'vaga de 2,5 m', 'vaga de 2,3 m'],
  garagem: ['portão de 2,8 m', 'portão de 2,5 m', 'portão de 2,3 m'],
};
const PHYSICS_DT = 1 / 120;

// --- Renderização -----------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const world = createWorld(scene);
const rig = new CameraRig(window.innerWidth / window.innerHeight);
const mirrors = new Mirrors();
const hud = new Hud();
const sounds = new Sounds();
const trajectory = new Trajectory(scene);

const car = new CarState();
const carModel = buildCarModel({ color: 0xc8102e, interior: true });
scene.add(carModel.group);

let scenario = null;
let targetMesh = null;
let paused = true;
let showTarget = true;
let mode = 'treino';
let exam = null; // só existe no modo exame
let sensorEnabled = true;

const stats = { time: 0, adjustments: 0, hits: 0, curbs: 0, lastDir: 0, sinceHit: Infinity, sinceCurb: Infinity, still: 0, autoShown: false };

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  rig.camera.aspect = w / h;
  rig.camera.updateProjectionMatrix();
  mirrors.layout(w, h);
}
window.addEventListener('resize', resize);
resize();

// --- Cenário ----------------------------------------------------------------
function buildTargetMesh(t) {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(t.hw * 2, t.hl * 2),
    new THREE.MeshBasicMaterial({ color: 0x3ccf5a, transparent: true, opacity: 0.15, depthWrite: false }),
  );
  fill.rotation.x = -Math.PI / 2;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(t.hw * 2, t.hl * 2)),
    new THREE.LineBasicMaterial({ color: 0x3ccf5a }),
  );
  edges.rotation.x = -Math.PI / 2;
  g.add(fill, edges);
  g.position.set(t.x, 0.02, t.z);
  g.rotation.y = t.h;
  return g;
}

function loadScenario() {
  if (scenario) scene.remove(scenario.group);
  if (targetMesh) scene.remove(targetMesh);
  const id = document.getElementById('opt-scenario').value;
  const difficulty = document.getElementById('opt-difficulty').value;
  mode = document.getElementById('opt-mode').value;
  sensorEnabled = document.getElementById('opt-sensor').checked;
  scenario = SCENARIOS[id]({ difficulty });
  scene.add(scenario.group);
  targetMesh = buildTargetMesh(scenario.target);
  targetMesh.visible = showTarget && mode === 'treino';
  scene.add(targetMesh);
  if (mode === 'exame') trajectory.setVisible(false); // no exame não há ajudas visuais
  const modeLabel = mode === 'exame' ? 'Exame Detran' : 'Treino livre';
  document.getElementById('scenario-label').textContent = `${scenario.name} · ${modeLabel} · ${scenario.sizeLabel}`;
  restart();
}

function restart() {
  car.reset(scenario.start);
  Object.assign(stats, { time: 0, adjustments: 0, hits: 0, curbs: 0, lastDir: 0, sinceHit: Infinity, sinceCurb: Infinity, still: 0, autoShown: false });
  hud.hideResult();
  rig.chasePos = null;
  rig.topPos = null;
  exam = mode === 'exame' ? new Exam() : null;
  if (exam) {
    hud.toast(`Exame: ${EXAM_RULES.timeLimit / 60} min, até ${EXAM_RULES.maxAdjustments} ajustes. Estacione e aperte Enter para terminar.`, 'info', 6000);
  } else {
    hud.toast(scenario.hint, 'info', 5000);
  }
}

// --- Entrada ----------------------------------------------------------------
const keys = new Set();
const drag = { delta: 0, active: false };

function input() {
  const k = (...codes) => codes.some((c) => keys.has(c));
  return {
    forward: k('KeyW', 'ArrowUp'),
    backward: k('KeyS', 'ArrowDown'),
    brake: k('Space'),
    steerLeft: k('KeyA', 'ArrowLeft'),
    steerRight: k('KeyD', 'ArrowRight'),
    steerDragging: drag.active,
  };
}

const ACTIONS = {
  Enter: () => finishParking(),
  KeyC: () => {
    rig.next();
    hud.setCamera(`Câmera: ${rig.mode.label}`);
  },
  KeyT: () => {
    if (exam) return hud.toast('Sem linha de trajetória no exame', 'warn');
    trajectory.setVisible(!trajectory.visible);
    hud.toast(`Linha de trajetória ${trajectory.visible ? 'ligada' : 'desligada'}`);
  },
  KeyG: () => {
    if (exam) return hud.toast('Sem marcação da vaga no exame', 'warn');
    showTarget = !showTarget;
    targetMesh.visible = showTarget;
    hud.toast(`Marcação da vaga ${showTarget ? 'ligada' : 'desligada'}`);
  },
  KeyM: () => {
    sounds.muted = !sounds.muted;
    sounds.stopAll();
    hud.toast(`Som ${sounds.muted ? 'desligado' : 'ligado'}`);
  },
  KeyH: () => document.getElementById('help').classList.toggle('show'),
  Backspace: () => restart(),
  Escape: () => setMenu(true),
};

const MOVE_KEYS = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'];

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace'].includes(e.code)) e.preventDefault();
  if (paused) {
    if (e.code === 'Escape' && targetMesh) setMenu(false);
    return;
  }
  keys.add(e.code);
  if (MOVE_KEYS.includes(e.code) && !exam?.over) hud.hideResult();
  if (!e.repeat && ACTIONS[e.code]) ACTIONS[e.code]();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('wheel', (e) => rig.zoom(e.deltaY * 0.02), { passive: true });

makeWheelDraggable(
  (d) => (drag.delta += d),
  (active) => (drag.active = active),
);

function setMenu(open) {
  paused = open;
  document.getElementById('menu').classList.toggle('hidden', !open);
  if (open) sounds.stopAll();
}

document.getElementById('btn-start').addEventListener('click', () => {
  sounds.unlock();
  loadScenario();
  setMenu(false);
  hud.setCamera(`Câmera: ${rig.mode.label}`);
});
document.getElementById('btn-retry').addEventListener('click', () => restart());
document.getElementById('btn-menu').addEventListener('click', () => setMenu(true));
document.getElementById('btn-finish').addEventListener('click', (e) => {
  e.currentTarget.blur();
  if (!paused) finishParking();
});
document.getElementById('btn-continue').addEventListener('click', () => hud.hideResult());

// --- Física e colisões ------------------------------------------------------
function checkCollisions() {
  const body = bodyObb(car);
  const solids = scenario.obstacles.filter(isSolid);
  const low = scenario.obstacles.filter((o) => o.type === 'curb' || o.type === 'stopper');
  if (solids.some((o) => obbOverlap(body, o))) return { kind: 'hit' };
  for (const w of wheelObbs(car)) {
    const o = low.find((c) => obbOverlap(w, c));
    if (o) return { kind: o.type, wheel: w.name, label: o.label };
  }
  return null;
}

function step(dt) {
  if (exam?.over) return;
  const before = car.snapshot();
  const inp = input();
  inp.steerDelta = drag.delta;
  drag.delta = 0;
  car.update(dt, inp);

  const hit = checkCollisions();
  if (hit) {
    car.restore(before);
    car.v = 0;
    // Só conta um novo toque depois de o carro ficar meio segundo sem encostar
    if (hit.kind === 'hit' && stats.sinceHit > 0.5) {
      stats.hits++;
      sounds.crash();
      if (exam) {
        exam.add('hit');
        endExam(null);
        return;
      }
      hud.toast('Bateu! Em um exame seria reprovação.', 'bad', 3000);
    }
    if (hit.kind === 'curb' && stats.sinceCurb > 0.5) {
      stats.curbs++;
      if (exam) exam.add('curb');
      hud.toast(`Encostou a roda ${hit.wheel} no ${hit.label}${exam ? ' (−2 pontos)' : ''}`, 'warn', 3000);
    }
  }
  stats.sinceHit = hit?.kind === 'hit' ? 0 : stats.sinceHit + dt;
  stats.sinceCurb = hit?.kind === 'curb' ? 0 : stats.sinceCurb + dt;

  // Conta os ajustes: cada vez que o carro inverte o sentido
  if (Math.abs(car.v) > 0.2) {
    const dir = Math.sign(car.v);
    if (stats.lastDir !== 0 && dir !== stats.lastDir) stats.adjustments++;
    stats.lastDir = dir;
  }
  stats.time += dt;

  // No treino, parar dentro da vaga por um instante já mostra a avaliação
  if (!exam) {
    stats.still = Math.abs(car.v) < 0.01 ? stats.still + dt : 0;
    if (Math.abs(car.v) > 0.3) stats.autoShown = false;
    if (stats.still > 1.2 && !stats.autoShown) {
      stats.autoShown = true;
      if (measureParking().inside) finishParking();
    }
  }

  if (exam) {
    const fault = exam.check(stats);
    if (fault?.severity === 'eliminatoria') endExam(null);
    else if (fault) hud.toast(`Falta ${fault.severity}: ${fault.label}`, 'warn', 3000);
  }
}

// --- Avaliação ao terminar --------------------------------------------------
function measureParking() {
  const t = scenario.target;
  const body = bodyObb(car);
  const solids = scenario.obstacles.filter(isSolid);
  const nearest = (lx, lz) => {
    const p = localToWorld(car.x, car.z, car.h, lx, lz);
    return Math.min(...solids.map((o) => pointToObbDist(p.x, p.z, o)));
  };
  const sensors = readSensors(car, scenario.obstacles);

  // Ângulo em relação à vaga; diz se o carro entrou no sentido pedido
  const raw = Math.abs((angleDiff(car.h, t.h) * 180) / Math.PI);
  const flipped = raw > 90;
  const m = {
    near: Math.hypot(body.x - t.x, body.z - t.z) <= 6,
    inside: obbCorners(body).every((p) => pointInObb(p.x, p.z, t, 0.05)),
    angle: flipped ? 180 - raw : raw,
    wrongWay: scenario.direction === 'reverse' && flipped,
    gapFront: Math.min(...sensors.front),
    gapRear: Math.min(...sensors.rear),
  };

  if (scenario.report === 'curb') {
    const curbs = scenario.obstacles.filter((o) => o.type === 'curb');
    const wheels = wheelObbs(car);
    const curbDist = (w) => Math.min(...obbCorners(w).flatMap((p) => curbs.map((c) => pointToObbDist(p.x, p.z, c))));
    m.rearCurb = Math.min(curbDist(wheels[0]), curbDist(wheels[1]));
    m.frontCurb = Math.min(curbDist(wheels[2]), curbDist(wheels[3]));
  } else {
    // Folga lateral: pontos ao longo das laterais do carro
    const along = [];
    for (let lz = -CAR.rearOverhang; lz <= CAR.length - CAR.rearOverhang; lz += 0.5) along.push(lz);
    m.sideLeft = Math.min(...along.map((lz) => nearest(CAR.width / 2, lz)));
    m.sideRight = Math.min(...along.map((lz) => nearest(-CAR.width / 2, lz)));
  }
  return m;
}

const cm = (m) => `${Math.round(m * 100)} cm`;

function measurementItems(m) {
  const items = [{ label: 'Dentro da vaga', value: m.inside ? 'Sim' : 'Não', ok: m.inside }];
  if (scenario.direction === 'reverse') {
    items.push({ label: 'Entrou de ré', value: m.wrongWay ? 'Não' : 'Sim', ok: !m.wrongWay });
  }
  if (m.frontCurb !== undefined) {
    const curbOk = m.frontCurb <= EXAM_RULES.curbMax && m.rearCurb <= EXAM_RULES.curbMax;
    items.push({ label: 'Meio-fio (roda dianteira / traseira)', value: `${cm(m.frontCurb)} / ${cm(m.rearCurb)}`, ok: curbOk });
  }
  items.push({ label: 'Alinhamento com a vaga', value: `${m.angle.toFixed(1).replace('.', ',')}°`, ok: m.angle <= EXAM_RULES.angleMax });
  if (m.sideLeft !== undefined) {
    items.push({ label: 'Folga lateral (esquerda / direita)', value: `${cm(m.sideLeft)} / ${cm(m.sideRight)}`, ok: m.sideLeft > 0.2 && m.sideRight > 0.2 });
  } else {
    items.push({ label: 'Espaço na frente / atrás', value: `${cm(m.gapFront)} / ${cm(m.gapRear)}`, ok: m.gapFront > 0.15 && m.gapRear > 0.15 });
  }
  return items;
}

function finishParking() {
  const m = measureParking();
  if (exam) {
    if (!m.near) {
      hud.toast('Para terminar o exame, estacione na vaga e aperte Enter', 'warn');
      return;
    }
    exam.grade(m);
    endExam(m);
    return;
  }
  if (!m.near) {
    hud.toast('Leve o carro até a vaga para ver a avaliação', 'warn');
    return;
  }

  const items = [
    ...measurementItems(m),
    { label: 'Ajustes (trocas de sentido)', value: String(stats.adjustments), ok: true },
    { label: 'Batidas', value: String(stats.hits), ok: stats.hits === 0 },
    { label: 'Toques no meio-fio', value: String(stats.curbs), ok: stats.curbs === 0 },
    { label: 'Tempo', value: formatTime(stats.time), ok: true },
  ];
  const curbOk = m.frontCurb === undefined || (m.frontCurb <= EXAM_RULES.curbMax && m.rearCurb <= EXAM_RULES.curbMax);
  const ok = m.inside && !m.wrongWay && curbOk && m.angle <= EXAM_RULES.angleMax && stats.hits === 0;
  hud.showResult({ title: ok ? 'Estacionado!' : 'Quase lá', kind: ok ? 'ok' : 'warn', items });
}

// Encerra o exame (m = medidas da posição final, ou null se foi interrompido)
function endExam(m) {
  exam.over = true;
  car.v = 0;
  sounds.stopAll();
  const approved = exam.approved;
  const items = [
    ...(m ? measurementItems(m) : []),
    { label: 'Ajustes', value: `${stats.adjustments} de ${EXAM_RULES.maxAdjustments}`, ok: stats.adjustments <= EXAM_RULES.maxAdjustments },
    { label: 'Tempo', value: formatTime(stats.time), ok: stats.time < EXAM_RULES.timeLimit },
  ];
  const subtitle = exam.eliminated
    ? 'Falta eliminatória'
    : `${exam.points} ${exam.points === 1 ? 'ponto perdido' : 'pontos perdidos'} (máximo ${EXAM_RULES.maxPoints})`;
  hud.showResult({
    title: approved ? 'Aprovado!' : 'Reprovado',
    kind: approved ? 'ok' : 'bad',
    subtitle,
    faults: exam.faults,
    items,
    exam: true,
  });
  renderHistory(
    saveToHistory({
      date: Date.now(),
      scenario: scenario.name,
      size: scenario.sizeLabel,
      approved,
      points: exam.points,
      time: stats.time,
      reason: exam.faults.find((f) => f.severity === 'eliminatoria')?.label || '',
    }),
  );
}

function renderHistory(list = loadHistory()) {
  const box = document.getElementById('history');
  box.classList.toggle('empty', list.length === 0);
  document.getElementById('history-list').innerHTML = list
    .slice(0, 5)
    .map((e) => {
      const when = new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const detail = e.approved ? `${e.points} pt · ${formatTime(e.time)}` : e.reason || `${e.points} pt`;
      const where = e.scenario || 'Baliza';
      return `<li><span class="${e.approved ? 'ok' : 'bad'}">${e.approved ? 'Aprovado' : 'Reprovado'}</span><span>${where} · ${detail}</span><span class="when">${when}</span></li>`;
    })
    .join('');
}

const MODE_DESC = {
  treino: 'Sem pressão: marcação da vaga e linha de trajetória (T) disponíveis.',
  exame: `Sem marcação nem trajetória. ${EXAM_RULES.timeLimit / 60} min, até ${EXAM_RULES.maxAdjustments} ajustes. Bater ou terminar fora da vaga reprova; acima de ${EXAM_RULES.maxPoints} pontos também.`,
};
const modeSelect = document.getElementById('opt-mode');
const updateModeDesc = () => (document.getElementById('mode-desc').textContent = MODE_DESC[modeSelect.value]);
modeSelect.addEventListener('change', updateModeDesc);
updateModeDesc();

const scenarioSelect = document.getElementById('opt-scenario');
const updateSizes = () => {
  const texts = SIZE_TEXT[scenarioSelect.value];
  [...document.getElementById('opt-difficulty').options].forEach((o, i) => {
    o.textContent = `${['Fácil', 'Padrão', 'Difícil'][i]}: ${texts[i].replace('padrão Detran: ', '')}${i === 1 && scenarioSelect.value === 'baliza' ? ' (Detran)' : ''}`;
  });
};
scenarioSelect.addEventListener('change', updateSizes);
updateSizes();
renderHistory();

// --- Laço principal ---------------------------------------------------------
const clock = new THREE.Clock();
let acc = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (!paused && scenario) {
    acc += dt;
    while (acc >= PHYSICS_DT) {
      step(PHYSICS_DT);
      acc -= PHYSICS_DT;
    }

    const sensors = readSensors(car, scenario.obstacles);
    const active = {
      rear: sensorEnabled && car.reversing,
      front: sensorEnabled && car.speedKmh < 10,
    };
    const rearMin = active.rear ? Math.min(...sensors.rear) : Infinity;
    const frontMin = active.front ? Math.min(...sensors.front) : Infinity;
    if (exam?.over) sounds.updateSensor(dt, null);
    else if (rearMin <= frontMin) sounds.updateSensor(dt, rearMin, 1750);
    else sounds.updateSensor(dt, frontMin, 2300);

    hud.update(car, sensors, active);
    hud.setStats(stats, exam);
  }

  rig.look.back = keys.has('KeyV');
  rig.look.left = keys.has('KeyZ');
  rig.look.right = keys.has('KeyX');

  syncCarModel(carModel, car);
  trajectory.update(car);
  world.follow(car.x, car.z);
  rig.update(car, dt);

  const mode = rig.mode.id;
  canvas.style.transform = mode === 'rear' ? 'scaleX(-1)' : ''; // câmera de ré mostra a imagem espelhada
  if (mode === 'driver' && scenario) mirrors.render(renderer, scene, car);
  renderer.render(scene, rig.camera);
  if (mode === 'driver' && scenario) mirrors.drawOverlay(renderer);
}

// Mostra a cena ao fundo do menu
scenario = createBaliza({});
scene.add(scenario.group);
car.reset(scenario.start);
frame();

// Acesso pelo console durante o desenvolvimento
if (import.meta.env.DEV) window.sim = { car, stats, rig, step, checkCollisions, get exam() { return exam; }, get scenario() { return scenario; }, frame: () => renderer.render(scene, rig.camera) };
