const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

const db = new Database('./ai_finance.db');
db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  revenue REAL DEFAULT 0,
  cogs REAL DEFAULT 0,
  expenses REAL DEFAULT 0,
  taxes REAL DEFAULT 0,
  currency TEXT DEFAULT 'UZS',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('password123', 8);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?,?)').run('admin', hash);
  console.log('Created default user: admin / password123');
}

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: generateToken(user), user: { id: user.id, username: user.username } });
});

app.post('/api/analyze', authMiddleware, async (req, res) => {
  try {
    const { period, revenue = 0, cogs = 0, expenses = 0, taxes = 0, currency='UZS' } = req.body;
    const grossProfit = revenue - cogs;
    const operatingProfit = grossProfit - expenses;
    const netProfit = operatingProfit - taxes;
    const grossMargin = revenue ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue ? (netProfit / revenue) * 100 : 0;

    const prompt = `Вы финансовый аналитик. Период: ${period}, валюта: ${currency}.\n`+
      `Выручка: ${revenue}, Себестоимость: ${cogs}, Расходы: ${expenses}, Налоги: ${taxes}.\n`+
      `Посчитайте валовую прибыль=${grossProfit}, операционную прибыль=${operatingProfit}, чистую прибыль=${netProfit}, валовая маржа=${grossMargin.toFixed(2)}%, чистая маржа=${netMargin.toFixed(2)}%.\n`+
      `Дайте краткий, практический анализ на русском с деловыми формулировками: что улучшить и на что обратить внимание.`

    const gptResponse = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'Вы — краткий финансовый аналитик.' }, { role: 'user', content: prompt }],
      max_tokens: 300
    });

    const advice = gptResponse.data.choices?.[0]?.message?.content || 'Нет ответа от AI.';

    const info = db.prepare('INSERT INTO records (user_id, period, revenue, cogs, expenses, taxes, currency) VALUES (?,?,?,?,?,?,?)')
      .run(req.user.id, period, revenue, cogs, expenses, taxes, currency);
    const saved = db.prepare('SELECT * FROM records WHERE id = ?').get(info.lastInsertRowid);

    res.json({ kpis: { grossProfit, operatingProfit, netProfit, grossMargin, netMargin }, advice, record: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.get('/api/records', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const rows = db.prepare('SELECT * FROM records WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  res.json(rows);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
