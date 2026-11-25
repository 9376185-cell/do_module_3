const CRITERIA_META = [
  { key: 'cost', label: 'Вартість доставки, грн', direction: 'min' },
  { key: 'time', label: 'Термін, днів', direction: 'min' },
  { key: 'reliability', label: 'Надійність, %', direction: 'max' },
  { key: 'quality', label: 'Якість обслуговування, бали', direction: 'max' }
];

const DEFAULT_COMPANIES = [
  { id: 1, name: 'Компанія A', cost: 1800, time: 4, reliability: 96, quality: 8.5 },
  { id: 2, name: 'Компанія B', cost: 2200, time: 2, reliability: 99, quality: 9.2 },
  { id: 3, name: 'Компанія C', cost: 1500, time: 5, reliability: 92, quality: 7.8 },
  { id: 4, name: 'Компанія D', cost: 1950, time: 3, reliability: 97, quality: 8.9 },
  { id: 5, name: 'Компанія E', cost: 1700, time: 4, reliability: 95, quality: 8.2 }
];

const DEFAULT_WEIGHTS = {
  cost: 0.35,
  time: 0.25,
  reliability: 0.25,
  quality: 0.15
};

const DEFAULT_CONSTRAINTS = {
  maxCost: 2100,
  maxTime: 5,
  minReliability: 94
};

function validateInputs(companies, weights, constraints) {
  if (!Array.isArray(companies) || companies.length === 0) {
    throw new Error('Список логістичних компаній не може бути порожнім.');
  }

  for (const c of companies) {
    if (!c.name || String(c.name).trim() === '') {
      throw new Error('Кожна компанія повинна мати назву.');
    }
    if (c.cost <= 0 || c.time <= 0 || c.reliability < 0 || c.reliability > 100 || c.quality < 0) {
      throw new Error(`Некоректні числові параметри для компанії "${c.name}".`);
    }
  }

  const weightValues = CRITERIA_META.map((crit) => Number(weights[crit.key]));
  if (weightValues.some((w) => Number.isNaN(w) || w < 0)) {
    throw new Error('Вагові коефіцієнти критеріїв повинні бути невід’ємними числами.');
  }

  const weightSum = weightValues.reduce((acc, val) => acc + val, 0);
  if (Math.abs(weightSum - 1) > 1e-6) {
    throw new Error(`Сума вагових коефіцієнтів повинна дорівнювати 1 (поточна сума: ${weightSum.toFixed(4)}).`);
  }

  if (constraints.maxCost <= 0 || constraints.maxTime <= 0 || constraints.minReliability < 0) {
    throw new Error('Граничні значення обмежень повинні бути додатними.');
  }
}

function filterFeasibleAlternatives(companies, constraints) {
  const feasible = [];
  const rejected = [];

  for (const company of companies) {
    const reasons = [];
    if (company.cost > constraints.maxCost) {
      reasons.push(`Вартість ${company.cost} грн > ${constraints.maxCost} грн`);
    }
    if (company.time > constraints.maxTime) {
      reasons.push(`Термін ${company.time} дн. > ${constraints.maxTime} дн.`);
    }
    if (company.reliability < constraints.minReliability) {
      reasons.push(`Надійність ${company.reliability}% < ${constraints.minReliability}%`);
    }

    if (reasons.length === 0) {
      feasible.push({ ...company });
    } else {
      rejected.push({ ...company, reasons });
    }
  }

  return { feasible, rejected };
}

function normalizeSAW(alternatives, criteria = CRITERIA_META) {
  const extrema = {};
  for (const crit of criteria) {
    const values = alternatives.map((a) => Number(a[crit.key]));
    extrema[crit.key] = {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  return alternatives.map((alt) => {
    const normalized = {};
    for (const crit of criteria) {
      const val = Number(alt[crit.key]);
      if (crit.direction === 'max') {
        normalized[crit.key] = extrema[crit.key].max === 0 ? 0 : val / extrema[crit.key].max;
      } else {
        normalized[crit.key] = val === 0 ? 0 : extrema[crit.key].min / val;
      }
    }
    return {
      ...alt,
      normalized
    };
  });
}

function calculateSAW(alternatives, weights, criteria = CRITERIA_META) {
  if (alternatives.length === 0) return [];
  const normalizedList = normalizeSAW(alternatives, criteria);

  const scored = normalizedList.map((item) => {
    let score = 0;
    for (const crit of criteria) {
      score += Number(weights[crit.key]) * item.normalized[crit.key];
    }
    return {
      id: item.id,
      name: item.name,
      normalized: item.normalized,
      score: Number(score.toFixed(6))
    };
  });

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return scored.map((item) => ({
    ...item,
    rank: sorted.findIndex((s) => s.id === item.id) + 1
  }));
}

function calculateTOPSIS(alternatives, weights, criteria = CRITERIA_META) {
  if (alternatives.length === 0) {
    return { items: [], idealPlus: {}, idealMinus: {} };
  }

  const norms = {};
  for (const crit of criteria) {
    const sumSq = alternatives.reduce((acc, a) => acc + Math.pow(Number(a[crit.key]), 2), 0);
    norms[crit.key] = Math.sqrt(sumSq);
  }

  const weightedMatrix = alternatives.map((alt) => {
    const vectorNorm = {};
    const weighted = {};
    for (const crit of criteria) {
      const r = norms[crit.key] === 0 ? 0 : Number(alt[crit.key]) / norms[crit.key];
      vectorNorm[crit.key] = r;
      weighted[crit.key] = r * Number(weights[crit.key]);
    }
    return { id: alt.id, name: alt.name, vectorNorm, weighted };
  });

  const idealPlus = {};
  const idealMinus = {};

  for (const crit of criteria) {
    const colValues = weightedMatrix.map((row) => row.weighted[crit.key]);
    if (crit.direction === 'max') {
      idealPlus[crit.key] = Math.max(...colValues);
      idealMinus[crit.key] = Math.min(...colValues);
    } else {
      idealPlus[crit.key] = Math.min(...colValues);
      idealMinus[crit.key] = Math.max(...colValues);
    }
  }

  const evaluated = weightedMatrix.map((row) => {
    let sumSqPlus = 0;
    let sumSqMinus = 0;
    for (const crit of criteria) {
      sumSqPlus += Math.pow(row.weighted[crit.key] - idealPlus[crit.key], 2);
      sumSqMinus += Math.pow(row.weighted[crit.key] - idealMinus[crit.key], 2);
    }
    const dPlus = Math.sqrt(sumSqPlus);
    const dMinus = Math.sqrt(sumSqMinus);
    const denom = dPlus + dMinus;
    const closeness = denom === 0 ? 1 : dMinus / denom;

    return {
      id: row.id,
      name: row.name,
      weighted: row.weighted,
      dPlus: Number(dPlus.toFixed(6)),
      dMinus: Number(dMinus.toFixed(6)),
      closeness: Number(closeness.toFixed(6))
    };
  });

  const sorted = [...evaluated].sort((a, b) => b.closeness - a.closeness);
  const items = evaluated.map((item) => ({
    ...item,
    rank: sorted.findIndex((s) => s.id === item.id) + 1
  }));

  return {
    items,
    idealPlus,
    idealMinus
  };
}

function calculatePareto(alternatives, criteria = CRITERIA_META) {
  return alternatives.map((target) => {
    const dominatedBy = [];
    const dominates = [];

    for (const other of alternatives) {
      if (target.id === other.id) continue;

      let otherNoWorseAll = true;
      let otherStrictlyBetterOne = false;

      let targetNoWorseAll = true;
      let targetStrictlyBetterOne = false;

      for (const crit of criteria) {
        const tVal = Number(target[crit.key]);
        const oVal = Number(other[crit.key]);

        if (crit.direction === 'max') {
          if (oVal < tVal) otherNoWorseAll = false;
          if (oVal > tVal) otherStrictlyBetterOne = true;

          if (tVal < oVal) targetNoWorseAll = false;
          if (tVal > oVal) targetStrictlyBetterOne = true;
        } else {
          if (oVal > tVal) otherNoWorseAll = false;
          if (oVal < tVal) otherStrictlyBetterOne = true;

          if (tVal > oVal) targetNoWorseAll = false;
          if (tVal < oVal) targetStrictlyBetterOne = true;
        }
      }

      if (otherNoWorseAll && otherStrictlyBetterOne) {
        dominatedBy.push(other.name);
      }
      if (targetNoWorseAll && targetStrictlyBetterOne) {
        dominates.push(other.name);
      }
    }

    return {
      ...target,
      id: target.id,
      name: target.name,
      isDominated: dominatedBy.length > 0,
      isParetoOptimal: dominatedBy.length === 0,
      dominatedBy,
      dominates
    };
  });
}

function evaluateLogisticsPartners(
  companies = DEFAULT_COMPANIES,
  weights = DEFAULT_WEIGHTS,
  constraints = DEFAULT_CONSTRAINTS
) {
  validateInputs(companies, weights, constraints);

  const { feasible, rejected } = filterFeasibleAlternatives(companies, constraints);
  if (feasible.length === 0) {
    throw new Error('Жодна компанія не задовольняє заданим обмеженням. Послабте обмеження.');
  }

  const sawResults = calculateSAW(feasible, weights);
  const topsisResults = calculateTOPSIS(feasible, weights);
  const paretoFeasible = calculatePareto(feasible);
  const paretoAll = calculatePareto(companies);

  const comparison = feasible.map((alt) => {
    const saw = sawResults.find((s) => s.id === alt.id);
    const topsis = topsisResults.items.find((t) => t.id === alt.id);
    const pareto = paretoFeasible.find((p) => p.id === alt.id);

    return {
      ...alt,
      sawScore: saw.score,
      sawRank: saw.rank,
      topsisScore: topsis.closeness,
      topsisDPlus: topsis.dPlus,
      topsisDMinus: topsis.dMinus,
      topsisRank: topsis.rank,
      isParetoOptimal: pareto.isParetoOptimal,
      dominatedBy: pareto.dominatedBy
    };
  }).sort((a, b) => a.topsisRank - b.topsisRank);

  return {
    criteria: CRITERIA_META,
    weights,
    constraints,
    feasible,
    rejected,
    saw: sawResults,
    topsis: topsisResults,
    paretoFeasible,
    paretoAll,
    comparison
  };
}

module.exports = {
  CRITERIA_META,
  DEFAULT_COMPANIES,
  DEFAULT_WEIGHTS,
  DEFAULT_CONSTRAINTS,
  validateInputs,
  filterFeasibleAlternatives,
  normalizeSAW,
  calculateSAW,
  calculateTOPSIS,
  calculatePareto,
  evaluateLogisticsPartners
};