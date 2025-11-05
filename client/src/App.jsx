import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token')||'');
  const [form, setForm] = useState({period:'', revenue:'', cogs:'', expenses:'', taxes:'', currency:'UZS'});
  const [kpis,setKpis]=useState(null);
  const [advice,setAdvice]=useState('');
  const [history,setHistory]=useState([]);
  const [auth,setAuth]=useState({username:'',password:''});

  useEffect(()=>{ if(token) fetchHistory(); },[token]);

  async function login(){
    const res=await axios.post(`${API}/api/login`, auth);
    setToken(res.data.token);
    localStorage.setItem('token', res.data.token);
  }

  async function submit(){
    const res = await axios.post(`${API}/api/analyze`, {
      ...form,
      revenue:Number(form.revenue||0),
      cogs:Number(form.cogs||0),
      expenses:Number(form.expenses||0),
      taxes:Number(form.taxes||0)
    }, { headers:{ Authorization:`Bearer ${token}` } });
    setKpis(res.data.kpis);
    setAdvice(res.data.advice);
    fetchHistory();
  }

  async function fetchHistory(){
    const res=await axios.get(`${API}/api/records`, { headers:{ Authorization:`Bearer ${token}` } });
    setHistory(res.data.map(r=>({...r, revenue:Number(r.revenue)})));
  }

  if(!token) return (<div style={{padding:20}}><h2>Вход</h2>
    <input placeholder="Логин" value={auth.username} onChange={e=>setAuth({...auth,username:e.target.value})} /><br/>
    <input placeholder="Пароль" type="password" value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})} /><br/>
    <button onClick={login}>Войти</button>
    <p>Default: admin / password123</p>
  </div>);

  return (<div style={{padding:20}}>
    <h1>fin-assist.uz — AI Finance Assistant</h1>
    <div style={{display:'flex',gap:20}}>
      <div style={{flex:1}}>
        <h3>Новая запись (месяц)</h3>
        <input placeholder="Период (YYYY-MM)" value={form.period} onChange={e=>setForm({...form,period:e.target.value})} /><br/>
        <input placeholder="Выручка" value={form.revenue} onChange={e=>setForm({...form,revenue:e.target.value})} /><br/>
        <input placeholder="COGS (себестоимость)" value={form.cogs} onChange={e=>setForm({...form,cogs:e.target.value})} /><br/>
        <input placeholder="Расходы" value={form.expenses} onChange={e=>setForm({...form,expenses:e.target.value})} /><br/>
        <input placeholder="Налоги" value={form.taxes} onChange={e=>setForm({...form,taxes:e.target.value})} /><br/>
        <select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>
          <option value='UZS'>UZS</option>
          <option value='RUB'>RUB</option>
          <option value='USD'>USD</option>
          <option value='KGS'>KGS</option>
        </select><br/>
        <button onClick={submit}>Проанализировать и сохранить</button>

        {kpis && (<div style={{marginTop:20}}>
          <h4>KPIs</h4>
          <div>Валовая прибыль: {kpis.grossProfit}</div>
          <div>Операционная прибыль: {kpis.operatingProfit}</div>
          <div>Чистая прибыль: {kpis.netProfit}</div>
          <div>Валовая маржа: {kpis.grossMargin.toFixed(2)}%</div>
          <div>Чистая маржа: {kpis.netMargin.toFixed(2)}%</div>
          <h4>Анализ (AI)</h4>
          <div style={{whiteSpace:'pre-wrap'}}>{advice}</div>
        </div>)}
      </div>
      <div style={{flex:1}}>
        <h3>История</h3>
        {history.length===0 && <div>Нет записей</div>}
        {history.length>0 && (<div style={{height:300}}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history.slice().reverse()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>)}
        <h4>Таблица</h4>
        <table border="1" cellPadding="6">
          <thead><tr><th>Период</th><th>Выручка</th><th>COGS</th><th>Расходы</th><th>Налоги</th><th>Валюта</th></tr></thead>
          <tbody>
            {history.map(r=>(
              <tr key={r.id}><td>{r.period}</td><td>{r.revenue}</td><td>{r.cogs}</td><td>{r.expenses}</td><td>{r.taxes}</td><td>{r.currency}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>);
}

export default App;
