// Modo exame no estilo Detran (versão simplificada; as regras variam de estado para estado).
// Pontuação como na Resolução Contran 168: falta eliminatória reprova na hora,
// grave = 3 pontos, média = 2, leve = 1; reprova quem passar de 3 pontos.

export const EXAM_RULES = {
  timeLimit: 180, // segundos
  maxAdjustments: 3, // trocas de sentido permitidas
  maxPoints: 3,
  curbMax: 0.5, // metros entre a roda e o meio-fio
  angleMax: 5, // graus
};

export const SEVERITY = {
  eliminatoria: { label: 'Eliminatória', points: 0 },
  grave: { label: 'Grave', points: 3 },
  media: { label: 'Média', points: 2 },
  leve: { label: 'Leve', points: 1 },
};

const FAULTS = {
  hit: { label: 'Bater em um carro ou parede', severity: 'eliminatoria' },
  wrongWay: { label: 'Entrar de frente (era para entrar de ré)', severity: 'eliminatoria' },
  timeout: { label: 'Passar do tempo de 3 minutos', severity: 'eliminatoria' },
  outside: { label: 'Terminar com o carro fora da vaga', severity: 'eliminatoria' },
  adjustments: { label: `Passar de ${EXAM_RULES.maxAdjustments} ajustes`, severity: 'grave' },
  farFromCurb: { label: 'Ficar a mais de 50 cm do meio-fio', severity: 'grave' },
  curb: { label: 'Encostar a roda no meio-fio', severity: 'media' },
  angle: { label: `Terminar torto (mais de ${EXAM_RULES.angleMax}°)`, severity: 'leve' },
};

export class Exam {
  constructor() {
    this.faults = [];
    this.over = false;
    this.adjustmentFaulted = false;
  }

  add(id) {
    const f = FAULTS[id];
    this.faults.push({ id, ...f, points: SEVERITY[f.severity].points, severityLabel: SEVERITY[f.severity].label });
    return f;
  }

  get maxAdjustments() {
    return EXAM_RULES.maxAdjustments;
  }

  get maxPoints() {
    return EXAM_RULES.maxPoints;
  }

  get points() {
    return this.faults.reduce((sum, f) => sum + f.points, 0);
  }

  get eliminated() {
    return this.faults.some((f) => f.severity === 'eliminatoria');
  }

  get approved() {
    return !this.eliminated && this.points <= EXAM_RULES.maxPoints;
  }

  remaining(time) {
    return Math.max(0, EXAM_RULES.timeLimit - time);
  }

  // Chamado a cada passo da física; devolve a falta nova (se houver)
  check(stats) {
    if (stats.time >= EXAM_RULES.timeLimit) return this.add('timeout');
    if (!this.adjustmentFaulted && stats.adjustments > EXAM_RULES.maxAdjustments) {
      this.adjustmentFaulted = true;
      return this.add('adjustments');
    }
    return null;
  }

  // Avaliação da posição final, ao terminar
  grade(m) {
    if (!m.inside) this.add('outside');
    if (m.wrongWay) this.add('wrongWay');
    if (m.frontCurb > EXAM_RULES.curbMax || m.rearCurb > EXAM_RULES.curbMax) this.add('farFromCurb'); // só na baliza
    if (m.angle > EXAM_RULES.angleMax) this.add('angle');
  }
}

// Histórico dos últimos exames (só neste navegador)
const HISTORY_KEY = 'simulador-estacionamento:exames';

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry) {
  const list = [entry, ...loadHistory()].slice(0, 10);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // sem armazenamento disponível: segue sem histórico
  }
  return list;
}
