const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  initDatabase,
  allQuery,
  runQuery,
  resetCompaniesToDefault
} = require('./db');
const {
  DEFAULT_WEIGHTS,
  DEFAULT_CONSTRAINTS,
  evaluateLogisticsPartners
} = require('./math/mcdm');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../dist')));

app.get('/api/init', async (req, res) => {
  try {
    const companies = await allQuery('SELECT * FROM companies ORDER BY id ASC');
    const evaluation = evaluateLogisticsPartners(companies, DEFAULT_WEIGHTS, DEFAULT_CONSTRAINTS);
    const history = await allQuery(
      'SELECT id, created_at, weights_json, constraints_json, result_json FROM experiments ORDER BY id DESC LIMIT 15'
    );
    res.json({
      companies,
      weights: DEFAULT_WEIGHTS,
      constraints: DEFAULT_CONSTRAINTS,
      evaluation,
      history
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/companies', async (req, res) => {
  try {
    const { companies } = req.body;
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ error: 'Список компаній не може бути порожнім.' });
    }

    await runQuery('DELETE FROM companies');
    for (const c of companies) {
      await runQuery(
        'INSERT INTO companies (name, cost, time, reliability, quality) VALUES (?, ?, ?, ?, ?)',
        [String(c.name).trim(), Number(c.cost), Number(c.time), Number(c.reliability), Number(c.quality)]
      );
    }

    const updated = await allQuery('SELECT * FROM companies ORDER BY id ASC');
    res.json({ companies: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    const companies = await resetCompaniesToDefault();
    const evaluation = evaluateLogisticsPartners(companies, DEFAULT_WEIGHTS, DEFAULT_CONSTRAINTS);
    res.json({
      companies,
      weights: DEFAULT_WEIGHTS,
      constraints: DEFAULT_CONSTRAINTS,
      evaluation
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/evaluate', async (req, res) => {
  try {
    const { companies, weights, constraints, saveHistory = true } = req.body;
    const evaluation = evaluateLogisticsPartners(companies, weights, constraints);

    if (saveHistory) {
      await runQuery(
        'INSERT INTO experiments (created_at, weights_json, constraints_json, companies_json, result_json) VALUES (?, ?, ?, ?, ?)',
        [
          new Date().toISOString(),
          JSON.stringify(weights),
          JSON.stringify(constraints),
          JSON.stringify(companies),
          JSON.stringify(evaluation.comparison)
        ]
      );
    }

    const history = await allQuery(
      'SELECT id, created_at, weights_json, constraints_json, result_json FROM experiments ORDER BY id DESC LIMIT 15'
    );

    res.json({ evaluation, history });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Сервер СППР запущено на http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Помилка ініціалізації бази даних:', err);
  });