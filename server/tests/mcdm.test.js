const {
  DEFAULT_COMPANIES,
  DEFAULT_WEIGHTS,
  DEFAULT_CONSTRAINTS,
  filterFeasibleAlternatives,
  normalizeSAW,
  calculateSAW,
  calculateTOPSIS,
  calculatePareto
} = require('../math/mcdm');

describe('Модульне тестування методів багатокритеріального аналізу (Варіант 3)', () => {
  const { feasible } = filterFeasibleAlternatives(DEFAULT_COMPANIES, DEFAULT_CONSTRAINTS);

  test('1. Перевірка правильності нормалізації показників максимізації та мінімізації', () => {
    const normalized = normalizeSAW(feasible);
    const compD = normalized.find((c) => c.name === 'Компанія D');
    const compE = normalized.find((c) => c.name === 'Компанія E');

    expect(compE.normalized.cost).toBeCloseTo(1.0, 5);
    expect(compD.normalized.cost).toBeCloseTo(1700 / 1950, 5);

    expect(compD.normalized.reliability).toBeCloseTo(1.0, 5);
    expect(compE.normalized.reliability).toBeCloseTo(95 / 97, 5);
  });

  test('2. Перевірка правильності розрахунку зваженої оцінки SAW', () => {
    const saw = calculateSAW(feasible, DEFAULT_WEIGHTS);
    const compD = saw.find((c) => c.name === 'Компанія D');
    const compE = saw.find((c) => c.name === 'Компанія E');
    const compA = saw.find((c) => c.name === 'Компанія A');

    expect(compD.score).toBeCloseTo(0.955128, 4);
    expect(compD.rank).toBe(1);
    expect(compE.rank).toBe(2);
    expect(compA.rank).toBe(3);
  });

  test('3. Перевірка правильності визначення ідеального та антиідеального рішень у TOPSIS', () => {
    const topsis = calculateTOPSIS(feasible, DEFAULT_WEIGHTS);

    const weightedCosts = topsis.items.map((i) => i.weighted.cost);
    const weightedRel = topsis.items.map((i) => i.weighted.reliability);

    expect(topsis.idealPlus.cost).toBeCloseTo(Math.min(...weightedCosts), 6);
    expect(topsis.idealMinus.cost).toBeCloseTo(Math.max(...weightedCosts), 6);
    expect(topsis.idealPlus.reliability).toBeCloseTo(Math.max(...weightedRel), 6);
    expect(topsis.idealMinus.reliability).toBeCloseTo(Math.min(...weightedRel), 6);
  });

  test('4. Перевірка правильності обчислення коефіцієнта близькості TOPSIS', () => {
    const topsis = calculateTOPSIS(feasible, DEFAULT_WEIGHTS);
    const compD = topsis.items.find((c) => c.name === 'Компанія D');
    const compE = topsis.items.find((c) => c.name === 'Компанія E');
    const compA = topsis.items.find((c) => c.name === 'Компанія A');

    for (const item of topsis.items) {
      expect(item.closeness).toBeGreaterThanOrEqual(0);
      expect(item.closeness).toBeLessThanOrEqual(1);
      expect(item.closeness).toBeCloseTo(item.dMinus / (item.dPlus + item.dMinus), 4);
    }

    expect(compD.closeness).toBeCloseTo(0.5890, 3);
    expect(compD.rank).toBe(1);
    expect(compE.rank).toBe(2);
    expect(compA.rank).toBe(3);
  });

  test('5. Перевірка коректності виявлення домінованих альтернатив за принципом Парето', () => {
    const testAlternatives = [
      ...feasible,
      
      { id: 99, name: 'Компанія F (слабка)', cost: 2050, time: 5, reliability: 94, quality: 7.5 }
    ];

    const pareto = calculatePareto(testAlternatives);
    const compD = pareto.find((p) => p.name === 'Компанія D');
    const compF = pareto.find((p) => p.name === 'Компанія F (слабка)');

    expect(compD.isParetoOptimal).toBe(true);
    expect(compD.isDominated).toBe(false);

    expect(compF.isDominated).toBe(true);
    expect(compF.isParetoOptimal).toBe(false);
    expect(compF.dominatedBy).toEqual(expect.arrayContaining(['Компанія A', 'Компанія D']));
  });
});