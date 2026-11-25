import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';

function BarComparisonChart({ comparison }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !comparison || comparison.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = comparison.map((item) => item.name);
    const sawData = comparison.map((item) => item.sawScore);
    const topsisData = comparison.map((item) => item.topsisScore);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Оцінка SAW (зважена сума)',
            data: sawData,
            backgroundColor: 'rgba(37, 99, 235, 0.78)',
            borderColor: 'rgb(37, 99, 235)',
            borderWidth: 1
          },
          {
            label: 'Коефіцієнт близькості TOPSIS (Ci)',
            data: topsisData,
            backgroundColor: 'rgba(16, 185, 129, 0.78)',
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 1.05,
            title: { display: true, text: 'Значення інтегрального показника' }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [comparison]);

  return (
    <div className="chart-box">
      <canvas ref={canvasRef} />
    </div>
  );
}

function ParetoScatterChart({ paretoAll, rejected, xKey, yKey, criteria }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !paretoAll) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const rejectedIds = new Set((rejected || []).map((r) => r.id));
    const optimalPoints = [];
    const dominatedPoints = [];
    const rejectedPoints = [];

    for (const item of paretoAll) {
      const point = {
        x: Number(item[xKey]),
        y: Number(item[yKey]),
        label: item.name
      };

      if (rejectedIds.has(item.id)) {
        rejectedPoints.push(point);
      } else if (item.isParetoOptimal) {
        optimalPoints.push(point);
      } else {
        dominatedPoints.push(point);
      }
    }

    const xLabel = criteria.find((c) => c.key === xKey)?.label || xKey;
    const yLabel = criteria.find((c) => c.key === yKey)?.label || yKey;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Парето-оптимальні (недоміновані)',
            data: optimalPoints,
            backgroundColor: 'rgb(16, 185, 129)',
            pointRadius: 8
          },
          {
            label: 'Доміновані альтернативи',
            data: dominatedPoints,
            backgroundColor: 'rgb(245, 158, 11)',
            pointRadius: 8
          },
          {
            label: 'Відхилені за обмеженнями',
            data: rejectedPoints,
            backgroundColor: 'rgb(239, 68, 68)',
            pointStyle: 'crossRot',
            pointRadius: 8,
            borderWidth: 2,
            borderColor: 'rgb(239, 68, 68)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw.label}: (${ctx.raw.x}, ${ctx.raw.y})`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: xLabel } },
          y: { title: { display: true, text: yLabel } }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [paretoAll, rejected, xKey, yKey, criteria]);

  return (
    <div className="chart-box">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function App() {
  const [companies, setCompanies] = useState([]);
  const [weights, setWeights] = useState({ cost: 0.35, time: 0.25, reliability: 0.25, quality: 0.15 });
  const [constraints, setConstraints] = useState({ maxCost: 2100, maxTime: 5, minReliability: 94 });
  const [evaluation, setEvaluation] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [paretoX, setParetoX] = useState('cost');
  const [paretoY, setParetoY] = useState('reliability');

  useEffect(() => {
    fetch('/api/init')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCompanies(data.companies);
        setWeights(data.weights);
        setConstraints(data.constraints);
        setEvaluation(data.evaluation);
        setHistory(data.history || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const weightSum = Object.values(weights).reduce((acc, v) => acc + Number(v || 0), 0);

  const handleCompanyChange = (index, field, value) => {
    const updated = [...companies];
    updated[index] = {
      ...updated[index],
      [field]: field === 'name' ? value : Number(value)
    };
    setCompanies(updated);
  };

  const handleAddCompany = () => {
    const nextId = companies.length > 0 ? Math.max(...companies.map((c) => c.id)) + 1 : 1;
    setCompanies([
      ...companies,
      {
        id: nextId,
        name: `Компанія ${String.fromCharCode(64 + nextId)}`,
        cost: 1850,
        time: 4,
        reliability: 95,
        quality: 8.4
      }
    ]);
  };

  const handleDeleteCompany = (id) => {
    setCompanies(companies.filter((c) => c.id !== id));
  };

  const handleCalculate = async () => {
    setError('');
    try {
      await fetch('/api/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies })
      });

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies, weights, constraints, saveHistory: true })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Помилка обчислення');

      setEvaluation(data.evaluation);
      setHistory(data.history || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReset = async () => {
    setError('');
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCompanies(data.companies);
      setWeights(data.weights);
      setConstraints(data.constraints);
      setEvaluation(data.evaluation);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>СППР багатокритеріального вибору логістичного партнера</h1>
        <p>Методи: SAW (зважена сума) · TOPSIS (ідеальна точка) · Парето-аналіз</p>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div className="grid-2">
        {}
        <section className="card">
          <div className="card-header">
            <h2>1. Вхідні дані логістичних компаній</h2>
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={handleAddCompany}>+ Додати компанію</button>
              <button className="btn btn-outline" onClick={handleReset}>Скинути (Варіант 3)</button>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Компанія</th>
                <th>Вартість, грн (min)</th>
                <th>Термін, днів (min)</th>
                <th>Надійність, % (max)</th>
                <th>Якість, бали (max)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, idx) => (
                <tr key={c.id}>
                  <td>
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => handleCompanyChange(idx, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={c.cost}
                      onChange={(e) => handleCompanyChange(idx, 'cost', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={c.time}
                      onChange={(e) => handleCompanyChange(idx, 'time', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={c.reliability}
                      onChange={(e) => handleCompanyChange(idx, 'reliability', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      value={c.quality}
                      onChange={(e) => handleCompanyChange(idx, 'quality', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-icon"
                      title="Видалити"
                      onClick={() => handleDeleteCompany(c.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {}
        <section className="card">
          <h2>2. Ваги критеріїв та обмеження задачі</h2>

          <div className="sub-grid">
            <div>
              <h3>Вагові коефіцієнти</h3>
              <label className="form-row">
                <span>Вартість (min):</span>
                <input
                  type="number"
                  step="0.05"
                  value={weights.cost}
                  onChange={(e) => setWeights({ ...weights, cost: Number(e.target.value) })}
                />
              </label>
              <label className="form-row">
                <span>Термін доставки (min):</span>
                <input
                  type="number"
                  step="0.05"
                  value={weights.time}
                  onChange={(e) => setWeights({ ...weights, time: Number(e.target.value) })}
                />
              </label>
              <label className="form-row">
                <span>Надійність (max):</span>
                <input
                  type="number"
                  step="0.05"
                  value={weights.reliability}
                  onChange={(e) => setWeights({ ...weights, reliability: Number(e.target.value) })}
                />
              </label>
              <label className="form-row">
                <span>Якість обслуговування (max):</span>
                <input
                  type="number"
                  step="0.05"
                  value={weights.quality}
                  onChange={(e) => setWeights({ ...weights, quality: Number(e.target.value) })}
                />
              </label>
              <p className={Math.abs(weightSum - 1) < 1e-6 ? 'sum-ok' : 'sum-bad'}>
                Сума ваг: <strong>{weightSum.toFixed(2)}</strong> (має дорівнювати 1.00)
              </p>
            </div>

            <div>
              <h3>Обов'язкові обмеження</h3>
              <label className="form-row">
                <span>Макс. вартість (грн):</span>
                <input
                  type="number"
                  value={constraints.maxCost}
                  onChange={(e) => setConstraints({ ...constraints, maxCost: Number(e.target.value) })}
                />
              </label>
              <label className="form-row">
                <span>Макс. термін (днів):</span>
                <input
                  type="number"
                  value={constraints.maxTime}
                  onChange={(e) => setConstraints({ ...constraints, maxTime: Number(e.target.value) })}
                />
              </label>
              <label className="form-row">
                <span>Мін. надійність (%):</span>
                <input
                  type="number"
                  value={constraints.minReliability}
                  onChange={(e) => setConstraints({ ...constraints, minReliability: Number(e.target.value) })}
                />
              </label>

              <button className="btn btn-primary full-width" onClick={handleCalculate}>
                Виконати розрахунок (SAW + TOPSIS + Парето)
              </button>
            </div>
          </div>
        </section>
      </div>

      {evaluation && (
        <>
          {}
          {evaluation.rejected.length > 0 && (
            <section className="card rejected-box">
              <h3>Відхилені альтернативи (порушення обмежень)</h3>
              <ul>
                {evaluation.rejected.map((r) => (
                  <li key={r.id}>
                    <strong>{r.name}:</strong> {r.reasons.join('; ')}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {}
          <section className="card">
            <h2>3. Порівняння результатів багатокритеріального оцінювання</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Компанія</th>
                  <th>Оцінка SAW</th>
                  <th>Ранг SAW</th>
                  <th>D⁺ (TOPSIS)</th>
                  <th>D⁻ (TOPSIS)</th>
                  <th>Близькість Ci (TOPSIS)</th>
                  <th>Ранг TOPSIS</th>
                  <th>Статус Парето</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.comparison.map((row) => (
                  <tr key={row.id} className={row.topsisRank === 1 ? 'winner-row' : ''}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.sawScore.toFixed(4)}</td>
                    <td><span className="badge">{row.sawRank}</span></td>
                    <td>{row.topsisDPlus.toFixed(4)}</td>
                    <td>{row.topsisDMinus.toFixed(4)}</td>
                    <td><strong>{row.topsisScore.toFixed(4)}</strong></td>
                    <td><span className="badge badge-green">{row.topsisRank}</span></td>
                    <td>
                      {row.isParetoOptimal ? (
                        <span className="status-optimal">Недомінована (Парето)</span>
                      ) : (
                        <span className="status-dominated">
                          Домінується ({row.dominatedBy.join(', ')})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ideal-info">
              <div>
                <strong>Ідеальне рішення A⁺ (зважене):</strong>{' '}
                Вартість = {evaluation.topsis.idealPlus.cost.toFixed(4)},{' '}
                Термін = {evaluation.topsis.idealPlus.time.toFixed(4)},{' '}
                Надійність = {evaluation.topsis.idealPlus.reliability.toFixed(4)},{' '}
                Якість = {evaluation.topsis.idealPlus.quality.toFixed(4)}
              </div>
              <div>
                <strong>Антиідеальне рішення A⁻ (зважене):</strong>{' '}
                Вартість = {evaluation.topsis.idealMinus.cost.toFixed(4)},{' '}
                Термін = {evaluation.topsis.idealMinus.time.toFixed(4)},{' '}
                Надійність = {evaluation.topsis.idealMinus.reliability.toFixed(4)},{' '}
                Якість = {evaluation.topsis.idealMinus.quality.toFixed(4)}
              </div>
            </div>
          </section>

          {}
          <div className="grid-2">
            <section className="card">
              <h2>4. Рейтингова діаграма (SAW vs TOPSIS)</h2>
              <BarComparisonChart comparison={evaluation.comparison} />
            </section>

            <section className="card">
              <div className="card-header">
                <h2>5. Двовимірний графік Парето-домінування</h2>
                <div className="axis-selectors">
                  <select value={paretoX} onChange={(e) => setParetoX(e.target.value)}>
                    {evaluation.criteria.map((c) => (
                      <option key={c.key} value={c.key}>Вісь X: {c.label}</option>
                    ))}
                  </select>
                  <select value={paretoY} onChange={(e) => setParetoY(e.target.value)}>
                    {evaluation.criteria.map((c) => (
                      <option key={c.key} value={c.key}>Вісь Y: {c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <ParetoScatterChart
                paretoAll={evaluation.paretoAll}
                rejected={evaluation.rejected}
                xKey={paretoX}
                yKey={paretoY}
                criteria={evaluation.criteria}
              />
            </section>
          </div>
        </>
      )}

      {}
      <section className="card">
        <h2>6. Історія збережених експериментів (SQLite)</h2>
        {history.length === 0 ? (
          <p>Історія порожня. Натисніть «Виконати розрахунок», щоб зберегти перший експеримент.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата та час</th>
                <th>Ваги критеріїв</th>
                <th>Лідер рейтингу (TOPSIS)</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const parsedRes = JSON.parse(h.result_json);
                const parsedW = JSON.parse(h.weights_json);
                const leader = parsedRes[0];
                return (
                  <tr key={h.id}>
                    <td>#{h.id}</td>
                    <td>{new Date(h.created_at).toLocaleString('uk-UA')}</td>
                    <td>
                      C:{parsedW.cost}, T:{parsedW.time}, R:{parsedW.reliability}, Q:{parsedW.quality}
                    </td>
                    <td>
                      {leader ? `${leader.name} (Ci = ${leader.topsisScore.toFixed(4)})` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}