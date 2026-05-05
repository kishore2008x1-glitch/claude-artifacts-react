// ╔══════════════════════════════════════════════════════════════════╗
// ║  AGIS  —  AI-Powered Trading Journal  v5.0                      ║
// ║  ✅ Login system  ✅ Multi-account  ✅ Edit/Delete trades        ║
// ║  ✅ PDF export    ✅ Plan limits    ✅ Strategy fix              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#05080D", s1:"#080D14", s2:"#0C1219", s3:"#101820",
  border:"#172030", accent:"#00C896", accentDim:"#00C89614",
  gold:"#F0A500", goldDim:"#F0A50014", red:"#F04F5A", redDim:"#F04F5A14",
  blue:"#3D9EFF", blueDim:"#3D9EFF14", purple:"#9B7FF0",
  text:"#E2EAF4", muted:"#4E6880", dim:"#1E2D40",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PAIR_CATS   = ["Forex Major","Forex Cross","Forex Exotic","Crypto","Commodity","Index","Stock","Other"];
const STRAT_CATS  = ["Smart Money","Technical","Fundamental","Short Term","Swing","Algorithmic","Hybrid","Other"];
const ALL_TF      = ["1m","3m","5m","15m","30m","1H","2H","4H","6H","8H","12H","D","W","M"];
const EMOTIONS    = ["Confident","Calm","Patient","Neutral","Hesitant","Anxious","Excited","FOMO","Greedy","Revenge"];
const SESSIONS    = ["London","New York","Asian","London/NY Overlap","Sydney"];
const DAYS_OF_WEEK= ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const PALETTE     = ["#3D9EFF","#9B7FF0","#FF6B35","#F0A500","#00C896","#FF6B9D","#34D399","#60A5FA","#FBBF24","#F87171","#818CF8","#FB923C","#84CC16","#E879F9"];
const PAIR_ICONS  = ["🇪🇺","🇬🇧","🇯🇵","🇺🇸","🇦🇺","🇨🇦","🇳🇿","🇨🇭","🥇","🥈","₿","Ξ","📊","📈","🛢️","💱","⚡","🔥","💎","🚀","🌙","⭐","🎯","🏆"];
const STRAT_ICONS = ["🧠","💡","📊","⚡","📈","🎯","📉","🌀","🔥","💎","🚀","📰","🎲","🏹","🔭","⚙️","🧩","✨","🏄","🛡️","🔑","🌊"];
const TRADER_STYLES = ["Scalper","Day Trader","Swing Trader","Position Trader","Algorithmic"];
const EXPERIENCE    = ["Beginner","Intermediate","Advanced","Professional"];
const FREE_PAIR_LIMIT  = 5;
const FREE_STRAT_LIMIT = 3;

// ─── UTILS ────────────────────────────────────────────────────────────────────
const uid      = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const fmtMoney = (n,sign=true) => `${sign&&n>=0?"+":""}${n<0?"-":""}$${Math.abs(n).toFixed(2)}`;
const fmtDate  = iso => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtFull  = iso => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const isoDate  = d => d.toISOString().split("T")[0];
const clamp    = (v,a,b) => Math.min(b,Math.max(a,v));

function calcWinStreak(trades) {
  let best=0,cur=0;
  [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(t=>{
    t.result==="WIN"?best=Math.max(best,++cur):cur=0;
  });
  return best;
}
function calcCurrentStreak(trades) {
  let cur=0;
  for(const t of [...trades].sort((a,b)=>new Date(b.date)-new Date(a.date))) {
    if(t.result==="WIN") cur++; else break;
  }
  return cur;
}
function calcPF(trades) {
  const w=trades.filter(t=>t.result==="WIN").reduce((s,t)=>s+t.pnl,0);
  const l=Math.abs(trades.filter(t=>t.result==="LOSS").reduce((s,t)=>s+t.pnl,0))||1;
  return w/l;
}
function calcDiscipline(trades) {
  if(!trades.length) return {total:0,emotional:0,consistency:0,risk:0};
  const badEmo=["FOMO","Revenge","Greedy","Anxious"];
  const badL=trades.filter(t=>badEmo.includes(t.emotionBefore)&&t.result==="LOSS").length;
  const emotional=clamp(100-Math.round((badL/trades.length)*200),0,100);
  const days=new Set(trades.filter(t=>(Date.now()-new Date(t.date))<30*864e5).map(t=>new Date(t.date).toDateString())).size;
  const consistency=clamp(Math.round((days/20)*100),0,100);
  const over=trades.filter(t=>parseFloat(t.risk||0)>2).length;
  const risk=clamp(100-Math.round((over/trades.length)*150),0,100);
  return {total:Math.round(emotional*.35+consistency*.30+risk*.35),emotional,consistency,risk};
}
function computeAnalytics(trades) {
  if(!trades.length) return null;
  const wins=trades.filter(t=>t.result==="WIN");
  const losses=trades.filter(t=>t.result==="LOSS");
  const totalPnl=trades.reduce((s,t)=>s+t.pnl,0);
  const winRate=wins.length/trades.length*100;
  const avgWin=wins.length?wins.reduce((s,t)=>s+t.pnl,0)/wins.length:0;
  const avgLoss=losses.length?Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length):1;
  const pf=wins.reduce((s,t)=>s+t.pnl,0)/Math.abs(losses.reduce((s,t)=>s+t.pnl,0)||1);
  const expectancy=(winRate/100)*avgWin-(1-winRate/100)*avgLoss;
  const sorted=[...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let running=0; let peak=0; let maxDD=0;
  const equityCurve=sorted.map((t,i)=>{
    running+=t.pnl;
    if(running>peak) peak=running;
    const dd=peak>0?(peak-running)/peak*100:0;
    if(dd>maxDD) maxDD=dd;
    const last10=sorted.slice(Math.max(0,i-9),i+1);
    return {date:fmtDate(t.date),equity:parseFloat(running.toFixed(2)),wr10:parseFloat((last10.filter(x=>x.result==="WIN").length/last10.length*100).toFixed(0))};
  });
  const group=key=>{
    const m={};
    trades.forEach(t=>{
      const k=t[key]||"Unknown";
      if(!m[k]) m[k]={pnl:0,trades:0,wins:0,rr:[]};
      m[k].pnl+=t.pnl; m[k].trades++;
      if(t.result==="WIN"){m[k].wins++;if(t.rr>0)m[k].rr.push(t.rr);}
    });
    return Object.entries(m).map(([name,d])=>({
      name,pnl:parseFloat(d.pnl.toFixed(2)),
      wr:parseFloat((d.wins/d.trades*100).toFixed(0)),
      trades:d.trades,wins:d.wins,
      avgRR:d.rr.length?parseFloat((d.rr.reduce((s,v)=>s+v,0)/d.rr.length).toFixed(2)):0
    })).sort((a,b)=>b.pnl-a.pnl);
  };
  const emo={};
  trades.forEach(t=>{
    const e=t.emotionBefore||"Neutral";
    if(!emo[e]) emo[e]={trades:0,wins:0,pnl:0};
    emo[e].trades++; if(t.result==="WIN") emo[e].wins++; emo[e].pnl+=t.pnl;
  });
  const monthly={};
  trades.forEach(t=>{
    const k=new Date(t.date).toLocaleDateString("en-US",{month:"short",year:"2-digit"});
    if(!monthly[k]) monthly[k]={pnl:0,trades:0,wins:0};
    monthly[k].pnl+=t.pnl; monthly[k].trades++; if(t.result==="WIN") monthly[k].wins++;
  });
  const last10=sorted.slice(-10),prev10=sorted.slice(-20,-10);
  const trendWR=last10.length&&prev10.length?(last10.filter(t=>t.result==="WIN").length/last10.length*100)-(prev10.filter(t=>t.result==="WIN").length/prev10.length*100):0;
  return {
    wins:wins.length,losses:losses.length,totalPnl,winRate,avgWin,avgLoss,
    profitFactor:pf,expectancy,equityCurve,maxDD,
    pairData:group("pair"),stratData:group("strategy"),sessionData:group("session"),
    emotionData:Object.entries(emo).map(([e,d])=>({emotion:e,wr:parseFloat((d.wins/d.trades*100).toFixed(0)),pnl:parseFloat(d.pnl.toFixed(2)),trades:d.trades})).sort((a,b)=>b.wr-a.wr),
    monthlyData:Object.entries(monthly).slice(-6).map(([m,d])=>({month:m,pnl:parseFloat(d.pnl.toFixed(2)),trades:d.trades,wr:parseFloat((d.wins/d.trades*100).toFixed(0))})),
    trendWR,discipline:calcDiscipline(trades),
    winStreak:calcWinStreak(trades),currentStreak:calcCurrentStreak(trades),
  };
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const STORE = "agis_v5";
const load = () => { try{const s=localStorage.getItem(STORE);return s?JSON.parse(s):null;}catch(e){return null;} };
const save = d => { try{localStorage.setItem(STORE,JSON.stringify(d));}catch(e){} };

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
function exportPDF(trades, analytics, period, profile, accountName) {
  const now = new Date();
  let filtered = trades;
  let periodLabel = "All Time";
  if(period==="daily"){
    filtered=trades.filter(t=>new Date(t.date).toDateString()===now.toDateString());
    periodLabel=`Daily — ${now.toLocaleDateString("en-US",{dateStyle:"long"})}`;
  } else if(period==="monthly"){
    filtered=trades.filter(t=>new Date(t.date).getMonth()===now.getMonth()&&new Date(t.date).getFullYear()===now.getFullYear());
    periodLabel=`Monthly — ${now.toLocaleDateString("en-US",{month:"long",year:"numeric"})}`;
  }
  const totalPnl=filtered.reduce((s,t)=>s+t.pnl,0);
  const wins=filtered.filter(t=>t.result==="WIN").length;
  const wr=filtered.length?(wins/filtered.length*100).toFixed(1):0;
  const pf=calcPF(filtered).toFixed(2);
  const avgW=wins?fmtMoney(filtered.filter(t=>t.result==="WIN").reduce((s,t)=>s+t.pnl,0)/wins):"-";
  const avgL=filtered.filter(t=>t.result==="LOSS").length?`-$${(Math.abs(filtered.filter(t=>t.result==="LOSS").reduce((s,t)=>s+t.pnl,0))/filtered.filter(t=>t.result==="LOSS").length).toFixed(2)}`:"-";

  const rows=filtered.map(t=>`
    <tr>
      <td>${fmtDate(t.date)}</td>
      <td><strong>${t.pair}</strong></td>
      <td style="color:${t.type==="BUY"?"#00C896":"#F04F5A"};font-weight:700">${t.type}</td>
      <td>${parseFloat(t.entry||0).toFixed(4)}</td>
      <td>${parseFloat(t.exit||0).toFixed(4)}</td>
      <td>${t.sl||"—"}</td>
      <td>${t.tp||"—"}</td>
      <td>${t.lotSize||"—"}</td>
      <td>${t.risk||"—"}%</td>
      <td style="color:${t.pnl>=0?"#00C896":"#F04F5A"};font-weight:700">${fmtMoney(t.pnl)}</td>
      <td>${(t.rr||0).toFixed(2)}R</td>
      <td style="color:${t.result==="WIN"?"#00C896":"#F04F5A"};font-weight:700">${t.result}</td>
      <td>${t.strategy||"—"}</td>
      <td>${t.session||"—"}</td>
      <td>${t.emotionBefore||"—"}</td>
    </tr>`).join("");

  const html=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>AGIS Trading Report</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111;padding:24px 20px;font-size:12px;line-height:1.5}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #00C896}
    .logo{font-size:26px;font-weight:900;letter-spacing:-1px}.logo span{color:#00C896}
    .header-right{text-align:right;color:#666;font-size:11px}
    h2{font-size:15px;font-weight:800;margin:20px 0 12px;color:#05080D}
    .stats{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
    .stat{background:#f4f6f9;border-radius:10px;padding:12px 16px;min-width:110px;flex:1}
    .stat-label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;font-weight:700}
    .stat-val{font-size:18px;font-weight:800;color:#05080D}
    .pos{color:#00C896}.neg{color:#F04F5A}
    table{width:100%;border-collapse:collapse;font-size:10px;margin-top:6px}
    th{background:#05080D;color:#fff;padding:7px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap}
    td{padding:6px;border-bottom:1px solid #eee;vertical-align:middle}
    tr:nth-child(even) td{background:#fafafa}
    .footer{margin-top:24px;padding-top:14px;border-top:1px solid #eee;font-size:10px;color:#aaa;display:flex;justify-content:space-between}
    .print-btn{position:fixed;top:16px;right:16px;background:#00C896;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(0,200,150,.4)}
    @media print{.print-btn{display:none}body{padding:12px}}
  </style>
  </head><body>
  <button class="print-btn" onclick="window.print()">🖨 Download PDF</button>
  <div class="header">
    <div><div class="logo">AG<span>IS</span></div><div style="font-size:11px;color:#888;margin-top:3px">AI-Powered Trading Journal</div></div>
    <div class="header-right">
      <div><strong>${profile?.name||"Trader"}</strong> · ${profile?.style||"Day Trader"}</div>
      <div>${accountName||"Default Account"}</div>
      <div>${periodLabel}</div>
      <div style="margin-top:4px;color:#00C896;font-weight:700">Generated ${now.toLocaleString()}</div>
    </div>
  </div>
  <h2>📊 Performance Summary</h2>
  <div class="stats">
    <div class="stat"><div class="stat-label">Total P&L</div><div class="stat-val ${totalPnl>=0?"pos":"neg"}">${fmtMoney(totalPnl)}</div></div>
    <div class="stat"><div class="stat-label">Total Trades</div><div class="stat-val">${filtered.length}</div></div>
    <div class="stat"><div class="stat-label">Win Rate</div><div class="stat-val pos">${wr}%</div></div>
    <div class="stat"><div class="stat-label">Profit Factor</div><div class="stat-val">${pf}</div></div>
    <div class="stat"><div class="stat-label">Wins / Losses</div><div class="stat-val">${wins} / ${filtered.length-wins}</div></div>
    <div class="stat"><div class="stat-label">Avg Win</div><div class="stat-val pos">${avgW}</div></div>
    <div class="stat"><div class="stat-label">Avg Loss</div><div class="stat-val neg">${avgL}</div></div>
  </div>
  <h2>📋 Trade Log</h2>
  ${!filtered.length?'<p style="color:#aaa;text-align:center;padding:30px">No trades in this period.</p>':`
  <div style="overflow-x:auto">
  <table><thead><tr>
    <th>Date</th><th>Pair</th><th>Type</th><th>Entry</th><th>Exit</th>
    <th>SL</th><th>TP</th><th>Lot</th><th>Risk</th>
    <th>P&L</th><th>R:R</th><th>Result</th><th>Strategy</th><th>Session</th><th>Emotion</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`}
  <div class="footer">
    <span>AGIS Trading Journal © ${now.getFullYear()}</span>
    <span>For journaling purposes only — not financial advice.</span>
  </div>
  </body></html>`;

  // Mobile-friendly: open new tab → user can share/print to PDF
  const blob = new Blob([html], {type:"text/html"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `AGIS_Report_${period}_${isoDate(now)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 3000);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css=`
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;outline:none}
html,body{background:${C.bg};color:${C.text};font-family:'Outfit',sans-serif;overscroll-behavior:none;-webkit-font-smoothing:antialiased}
.recharts-wrapper,.recharts-surface,.recharts-bar-rectangle,.recharts-sector,.recharts-rectangle{outline:none!important}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}

/* APP SHELL */
.app{display:flex;flex-direction:column;height:100vh;max-width:430px;margin:0 auto;background:${C.bg};position:relative;overflow:hidden}
.screen{flex:1;overflow-y:auto;padding-bottom:90px}

/* NAV */
.nav{position:absolute;bottom:0;left:0;right:0;background:${C.s1};border-top:1px solid ${C.border};display:flex;padding:8px 0 18px;z-index:40}
.ni{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:5px 0;color:${C.muted};font-size:8px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;user-select:none;transition:color .18s}
.ni.act{color:${C.accent}}
.nic{font-size:18px;line-height:1.2;transition:transform .2s}
.ni.act .nic{transform:translateY(-2px)}
.fab{position:fixed;bottom:92px;right:16px;width:52px;height:52px;background:${C.accent};border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;box-shadow:0 8px 32px ${C.accent}44;border:none;color:${C.bg};z-index:50;transition:transform .15s}
.fab:active{transform:scale(.92)}

/* CARDS */
.card{background:${C.s2};border:1px solid ${C.border};border-radius:16px;padding:16px;margin:0 14px 10px}
.mg2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 14px 10px}
.stat{background:${C.s2};border:1px solid ${C.border};border-radius:14px;padding:13px 14px}
.stat-label{font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px}
.stat-val{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:600;line-height:1.2}
.stat-sub{font-size:10px;color:${C.muted};margin-top:4px}
.sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:${C.muted};margin:8px 14px 7px}
.hdr{padding:18px 14px 0;display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
.hdr-title{font-size:20px;font-weight:900;letter-spacing:-.4px}
.hdr-title span{color:${C.accent}}

/* HERO */
.hero{padding:18px 14px 10px;background:linear-gradient(180deg,${C.accent}07 0%,transparent 100%)}

/* TRADE ROWS */
.tr{background:${C.s2};border:1px solid ${C.border};border-radius:14px;padding:12px 14px;margin:0 14px 8px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:border-color .2s}
.tr:active{background:${C.s3}}
.tb{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0}
.buy{background:${C.accentDim};color:${C.accent};border:1px solid ${C.accent}33}
.sell{background:${C.redDim};color:${C.red};border:1px solid ${C.red}33}
.ti{flex:1;min-width:0}
.tpair{font-size:14px;font-weight:700}
.tmeta{font-size:11px;color:${C.muted};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tpnl{text-align:right;flex-shrink:0}
.pv{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600}
.prr{font-size:10px;color:${C.muted};margin-top:2px}

/* OVERLAY / SHEETS */
.ov{position:fixed;inset:0;background:rgba(3,6,10,.92);z-index:100;display:flex;align-items:flex-end;backdrop-filter:blur(12px)}
.ov-center{position:fixed;inset:0;background:rgba(3,6,10,.92);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(12px)}
.sh{background:${C.s1};border-top:1px solid ${C.border};border-radius:24px 24px 0 0;width:100%;max-height:95vh;overflow-y:auto;padding-bottom:28px;animation:su .28s cubic-bezier(.4,0,.2,1)}
.modal-box{background:${C.s1};border:1px solid ${C.border};border-radius:18px;width:100%;padding:24px;animation:su .28s cubic-bezier(.4,0,.2,1)}
@keyframes su{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
.hdl{width:32px;height:3px;background:${C.dim};border-radius:2px;margin:10px auto 16px}
.sht{font-size:17px;font-weight:800;padding:0 18px 14px;border-bottom:1px solid ${C.border};display:flex;justify-content:space-between;align-items:center}
.xbtn{background:${C.s3};border:1px solid ${C.border};color:${C.muted};width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;flex-shrink:0}

/* FORMS */
.fg{margin:14px 18px 0}
.fg label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${C.muted};margin-bottom:7px;display:block}
.fi{width:100%;background:${C.s2};border:1px solid ${C.border};border-radius:12px;padding:11px 13px;color:${C.text};font-family:'Outfit',sans-serif;font-size:14px;outline:none;transition:border-color .2s;-webkit-appearance:none}
.fi:focus{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accentDim}}
.fi::placeholder{color:${C.muted}}
.fsel{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234E6880' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;background-color:${C.s2};cursor:pointer}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 18px 0}
.ttog{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 18px 0}
.tbtn{padding:12px;border-radius:12px;border:1px solid ${C.border};background:${C.s2};color:${C.muted};font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s}
.tbtn.ba{background:${C.accentDim};border-color:${C.accent};color:${C.accent}}
.tbtn.sa{background:${C.redDim};border-color:${C.red};color:${C.red}}
.calc{margin:14px 18px 0;background:${C.accentDim};border:1px solid ${C.accent}28;border-radius:12px;padding:13px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.ci{text-align:center}
.cl{font-size:9px;color:${C.muted};text-transform:uppercase;letter-spacing:.5px}
.cv{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;margin-top:3px}
.sbtn{margin:18px 18px 0;width:calc(100% - 36px);padding:15px;background:${C.accent};border:none;border-radius:13px;color:${C.bg};font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;cursor:pointer;letter-spacing:.3px;transition:opacity .18s}
.sbtn:active{opacity:.85}
.sbtn.danger{background:${C.red}}
.sbtn.gold{background:linear-gradient(135deg,${C.gold},#E55A00);color:#000}
.cbtn{margin:10px 18px 0;width:calc(100% - 36px);padding:13px;background:transparent;border:1px solid ${C.border};border-radius:13px;color:${C.muted};font-family:'Outfit',sans-serif;font-size:13px;cursor:pointer}

/* PROGRESS */
.pbar{height:4px;background:${C.dim};border-radius:2px;overflow:hidden}
.pfill{height:100%;border-radius:2px;transition:width .5s ease}

/* BADGES */
.badge-pro{background:linear-gradient(135deg,${C.gold},#FF6B35);color:#000;font-size:9px;font-weight:800;padding:3px 8px;border-radius:5px;letter-spacing:.5px}
.chip{display:inline-flex;align-items:center;gap:4px;background:${C.s3};border:1px solid ${C.border};color:${C.muted};font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;margin:2px}
.chip.active{background:${C.accentDim};border-color:${C.accent}44;color:${C.accent}}

/* COLORS */
.g{color:${C.green}}.r{color:${C.red}}.gold{color:${C.gold}}.bl{color:${C.blue}}

/* FILTERS */
.fb{display:flex;gap:7px;overflow-x:auto;padding:4px 14px 10px;scrollbar-width:none}
.fb::-webkit-scrollbar{display:none}
.pill{flex-shrink:0;padding:6px 13px;border-radius:20px;border:1px solid ${C.border};background:${C.s2};color:${C.muted};font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .18s;user-select:none}
.pill.act{background:${C.accentDim};border-color:${C.accent}55;color:${C.accent}}

/* LIBRARY */
.ltabs{display:flex;margin:0 14px 12px;background:${C.s2};padding:3px;border-radius:11px;border:1px solid ${C.border}}
.ltab{flex:1;padding:9px;border-radius:8px;border:none;background:transparent;color:${C.muted};font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}
.ltab.act{background:${C.accent};color:${C.bg}}
.srch{margin:8px 14px 6px;background:${C.s2};border:1px solid ${C.border};border-radius:12px;padding:9px 13px;display:flex;align-items:center;gap:9px}
.srch input{flex:1;background:transparent;border:none;outline:none;color:${C.text};font-family:'Outfit',sans-serif;font-size:13px}
.srch input::placeholder{color:${C.muted}}
.pi{background:${C.s2};border:1px solid ${C.border};border-radius:13px;padding:12px 13px;margin:0 14px 7px;display:flex;align-items:center;gap:11px}
.pi.off{opacity:.4}
.pico{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.pact{display:flex;align-items:center;gap:7px}
.ibtn{width:28px;height:28px;border-radius:8px;border:1px solid ${C.border};background:${C.s1};display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:${C.muted};transition:all .18s;flex-shrink:0}
.ibtn:active{border-color:${C.accent};color:${C.accent}}
.ibtn.del:active{border-color:${C.red};color:${C.red}}
.tog{width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;position:relative;transition:background .25s;flex-shrink:0}
.tog.on{background:${C.accent}}.tog.off{background:${C.dim}}
.tok{position:absolute;top:3px;width:16px;height:16px;border-radius:8px;background:#fff;transition:left .22s}
.tog.on .tok{left:21px}.tog.off .tok{left:3px}
.si{background:${C.s2};border:1px solid ${C.border};border-radius:13px;padding:13px;margin:0 14px 7px;cursor:pointer}
.si.off{opacity:.4}
.sico{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.tfall{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.tfbadge{padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;background:${C.s3};color:${C.muted};border:1px solid ${C.border}}
.stgt{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
.stg{background:${C.s1};border:1px solid ${C.border};border-radius:9px;padding:8px 10px;text-align:center}
.addnew{margin:2px 14px 8px;width:calc(100% - 28px);padding:12px;border:1.5px dashed ${C.border};border-radius:13px;background:transparent;color:${C.muted};font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:7px}
.addnew:active{border-color:${C.accent};color:${C.accent};background:${C.accentDim}}
.cgrid{display:flex;flex-wrap:wrap;gap:7px;margin-top:7px}
.cdot{width:26px;height:26px;border-radius:7px;cursor:pointer;border:2.5px solid transparent;transition:transform .15s}
.cdot.sel{border-color:#fff;transform:scale(1.18)}
.igrid{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.iopt{width:32px;height:32px;border-radius:8px;border:1px solid ${C.border};background:${C.s2};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px}
.iopt.sel{border-color:${C.accent};background:${C.accentDim}}
.tfopt{padding:5px 9px;border-radius:7px;border:1px solid ${C.border};background:${C.s2};color:${C.muted};font-size:10px;font-weight:700;cursor:pointer}
.tfopt.sel{border-color:${C.accent};background:${C.accentDim};color:${C.accent}}
.infobox{background:${C.blueDim};border:1px solid ${C.blue}28;border-radius:10px;padding:10px 12px;margin:12px 18px 0;font-size:11px;color:${C.muted};line-height:1.6}
.limit-warn{background:${C.goldDim};border:1px solid ${C.gold}33;border-radius:11px;padding:12px 14px;margin:0 14px 8px;display:flex;gap:10px;align-items:center}

/* INSIGHTS */
.ic{margin:0 14px 8px;border-radius:14px;padding:13px 15px;border:1px solid;position:relative;overflow:hidden}
.ic::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.ic.is{background:${C.accentDim};border-color:${C.accent}28}.ic.is::before{background:${C.accent}}
.ic.iw{background:${C.goldDim};border-color:${C.gold}28}.ic.iw::before{background:${C.gold}}
.ic.id{background:${C.redDim};border-color:${C.red}28}.ic.id::before{background:${C.red}}
.ic.ii{background:${C.blueDim};border-color:${C.blue}28}.ic.ii::before{background:${C.blue}}
.ih{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.it{font-size:12px;font-weight:800}
.ix{font-size:12px;color:${C.muted};line-height:1.65}

/* ACHIEVEMENTS */
.ach-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 14px 10px}
.ach{background:${C.s2};border:1px solid ${C.border};border-radius:13px;padding:12px 13px}
.ach.unlocked{border-color:${C.accent}33;background:${C.accentDim}}
.ach.locked{opacity:.35}
.ach-icon{font-size:22px;margin-bottom:5px}
.ach-name{font-size:11px;font-weight:700;margin-bottom:2px}
.ach-desc{font-size:10px;color:${C.muted};line-height:1.4}

/* ANALYTICS */
.atabs{display:flex;gap:4px;margin:0 14px 10px;background:${C.s2};padding:3px;border-radius:11px;border:1px solid ${C.border};overflow-x:auto}
.atab{flex-shrink:0;padding:7px 10px;border-radius:8px;border:none;background:transparent;color:${C.muted};font-family:'Outfit',sans-serif;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .2s}
.atab.act{background:${C.accent};color:${C.bg}}
.cmp{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:12px}
.cmp-side{background:${C.s3};border-radius:10px;padding:10px;text-align:center}
.cmp-vs{font-size:10px;color:${C.muted};font-weight:700}
.date-range{display:flex;gap:5px;margin:0 14px 8px}
.dr-btn{flex:1;padding:8px;border-radius:10px;border:1px solid ${C.border};background:${C.s2};color:${C.muted};font-family:'Outfit',sans-serif;font-size:11px;font-weight:700;cursor:pointer;text-align:center;transition:all .18s}
.dr-btn.act{background:${C.accentDim};border-color:${C.accent}44;color:${C.accent}}

/* ACCOUNTS */
.acc-card{background:${C.s2};border:2px solid ${C.border};border-radius:16px;padding:16px;margin:0 14px 10px;cursor:pointer;transition:all .2s}
.acc-card.active-acc{border-color:${C.accent};background:${C.accentDim}}
.acc-name{font-size:16px;font-weight:800;margin-bottom:4px}
.acc-stats{display:flex;gap:12px;margin-top:10px}
.acc-stat{text-align:center}
.acc-stat-v{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700}
.acc-stat-l{font-size:9px;color:${C.muted};text-transform:uppercase}

/* LOGIN */
.login-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:32px 24px;background:${C.bg}}
.login-logo{font-size:52px;font-weight:900;letter-spacing:-3px;margin-bottom:8px;line-height:1}
.login-logo span{color:${C.accent}}
.login-sub{font-size:13px;color:${C.muted};margin-bottom:40px;text-align:center;line-height:1.6}
.login-card{width:100%;max-width:380px;background:${C.s1};border:1px solid ${C.border};border-radius:20px;padding:28px 24px}
.login-err{background:${C.redDim};border:1px solid ${C.red}33;border-radius:10px;padding:10px 13px;margin-bottom:14px;font-size:12px;color:${C.red}}
.login-toggle{display:flex;justify-content:center;gap:6px;margin-bottom:20px;font-size:13px;color:${C.muted}}
.login-link{color:${C.accent};font-weight:700;cursor:pointer;text-decoration:underline}

/* TOAST */
.toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);background:${C.s2};border:1px solid ${C.accent}44;color:${C.text};padding:10px 20px;border-radius:12px;font-weight:600;font-size:13px;z-index:300;animation:fio 2.8s ease;pointer-events:none;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.4)}
@keyframes fio{0%{opacity:0;transform:translateX(-50%) translateY(-12px)}12%{opacity:1;transform:translateX(-50%) translateY(0)}78%{opacity:1}100%{opacity:0}}

/* MISC */
.empty{text-align:center;padding:52px 20px;color:${C.muted}}
.ei{font-size:44px;margin-bottom:12px}
.plan-card{margin:0 14px 10px;border-radius:16px;padding:18px;border:2px solid}
.plan-free{background:${C.s2};border-color:${C.border}}
.plan-pro{background:linear-gradient(135deg,${C.gold}10,${C.accent}08);border-color:${C.gold}40}
.detail-row{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;border-bottom:1px solid ${C.border}15}
.dk{font-size:12px;color:${C.muted}}
.dv{font-size:12px;font-weight:600;font-family:'JetBrains Mono',monospace}
.ctt{background:${C.s2};border:1px solid ${C.border};border-radius:9px;padding:9px 12px;font-size:11px;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.avatar{width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,${C.accent},#006644);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:${C.bg}}
.priority-insight{margin:8px 14px;border-radius:14px;padding:14px 16px;background:linear-gradient(135deg,${C.accent}12,${C.blue}08);border:1px solid ${C.accent}33;cursor:pointer;position:relative}
.priority-insight::after{content:'PRIORITY';position:absolute;top:10px;right:12px;font-size:8px;font-weight:800;color:${C.accent};letter-spacing:1px;opacity:.7}
.export-row{display:flex;gap:8px;margin:0 14px 10px}
.exp-btn{flex:1;padding:11px;border-radius:12px;border:1px solid ${C.border};background:${C.s2};color:${C.muted};font-family:'Outfit',sans-serif;font-size:11px;font-weight:700;cursor:pointer;text-align:center;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px}
.exp-btn:active{background:${C.accentDim};border-color:${C.accent};color:${C.accent}}
.del-confirm{position:fixed;inset:0;background:rgba(3,6,10,.92);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px)}
.del-box{background:${C.s1};border:1px solid ${C.border};border-radius:18px;padding:22px;width:100%}
.monthly-bar{display:flex;align-items:flex-end;gap:5px;height:80px;margin-top:12px}
.month-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.month-bar{width:100%;border-radius:4px 4px 0 0;min-height:3px}
.month-lbl{font-size:9px;color:${C.muted};white-space:nowrap}
.weekly-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:8px}
.wday{height:26px;border-radius:5px}
.score-ring text{font-family:'JetBrains Mono',monospace}
.date-picker-row{display:flex;gap:8px;margin:0 14px 8px;align-items:center}
.date-input{background:${C.s2};border:1px solid ${C.border};border-radius:10px;padding:8px 12px;color:${C.text};font-family:'Outfit',sans-serif;font-size:12px;flex:1;cursor:pointer}
.trend-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700}
.trend-up{background:${C.accentDim};color:${C.accent};border:1px solid ${C.accent}33}
.trend-dn{background:${C.redDim};color:${C.red};border:1px solid ${C.red}33}
.trend-nt{background:${C.s3};color:${C.muted};border:1px solid ${C.border}}
.rules-preview{margin-top:9px;font-size:11px;color:${C.muted};line-height:1.8;background:${C.s1};border-radius:8px;padding:8px 10px;white-space:pre-line;border:1px solid ${C.border}}
.acc-switcher{margin:0 14px 10px;background:${C.s2};border:1px solid ${C.border};border-radius:12px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}
`;

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Toggle({on,onChange}){
  return <button className={`tog ${on?"on":"off"}`} onClick={()=>onChange(!on)}><div className="tok"/></button>;
}
function ColorPicker({value,onChange}){
  return <div className="cgrid">{PALETTE.map(c=><div key={c} className={`cdot${value===c?" sel":""}`} style={{background:c}} onClick={()=>onChange(c)}/>)}</div>;
}
function IconPicker({value,onChange,icons}){
  return <div className="igrid">{icons.map(ic=><div key={ic} className={`iopt${value===ic?" sel":""}`} onClick={()=>onChange(ic)}>{ic}</div>)}</div>;
}
function ScoreRing({score,size=80}){
  const r=30,circ=2*Math.PI*r,dash=circ*(clamp(score,0,100)/100);
  const col=score>=70?C.accent:score>=50?C.gold:C.red;
  return(
    <svg width={size} height={size} viewBox="0 0 80 80" className="score-ring">
      <circle cx="40" cy="40" r={r} fill="none" stroke={C.dim} strokeWidth="6"/>
      <circle cx="40" cy="40" r={r} fill="none" stroke={col} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 40 40)"
        style={{transition:"stroke-dasharray .6s"}}/>
      <text x="40" y="45" textAnchor="middle" fill={col} fontSize="16" fontWeight="800">{score}</text>
    </svg>
  );
}
function CTT({active,payload,label}){
  if(!active||!payload?.length) return null;
  return(
    <div className="ctt">
      {label&&<div style={{fontSize:10,color:C.muted,marginBottom:3}}>{label}</div>}
      {payload.map((p,i)=><div key={i} style={{color:p.color||C.accent,fontFamily:"monospace",fontWeight:600}}>{typeof p.value==="number"&&Math.abs(p.value)>100?`$${parseFloat(p.value).toFixed(2)}`:p.value}</div>)}
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [mode,setMode]=useState("login"); // login | signup
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [name,setName]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const USERS_KEY="agis_users";
  const getUsers=()=>{ try{return JSON.parse(localStorage.getItem(USERS_KEY)||"[]");}catch(e){return[];} };
  const saveUsers=u=>localStorage.setItem(USERS_KEY,JSON.stringify(u));

  const handleLogin=()=>{
    setErr("");
    if(!email.trim()||!pass.trim()){setErr("Please enter email and password.");return;}
    const users=getUsers();
    const user=users.find(u=>u.email.toLowerCase()===email.trim().toLowerCase()&&u.password===pass);
    if(!user){setErr("Incorrect email or password.");return;}
    setLoading(true);
    setTimeout(()=>{ setLoading(false); onLogin(user); },400);
  };

  const handleSignup=()=>{
    setErr("");
    if(!name.trim()){setErr("Please enter your name.");return;}
    if(!email.trim()||!email.includes("@")){setErr("Please enter a valid email.");return;}
    if(pass.length<6){setErr("Password must be at least 6 characters.");return;}
    const users=getUsers();
    if(users.find(u=>u.email.toLowerCase()===email.trim().toLowerCase())){setErr("Email already registered. Please log in.");return;}
    const user={id:uid(),email:email.trim().toLowerCase(),password:pass,name:name.trim(),createdAt:new Date().toISOString()};
    saveUsers([...users,user]);
    setLoading(true);
    setTimeout(()=>{ setLoading(false); onLogin(user); },400);
  };

  return(
    <div className="login-screen">
      <div className="login-logo">AG<span>IS</span></div>
      <div className="login-sub">AI-Powered Trading Journal<br/>Track. Analyse. Improve.</div>
      <div className="login-card">
        {err&&<div className="login-err">⚠️ {err}</div>}
        {mode==="signup"&&(
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:C.muted,display:"block",marginBottom:7}}>Your Name</label>
            <input className="fi" placeholder="John Doe" value={name} onChange={e=>setName(e.target.value)}/>
          </div>
        )}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:C.muted,display:"block",marginBottom:7}}>Email</label>
          <input className="fi" type="email" placeholder="trader@example.com" value={email} onChange={e=>setEmail(e.target.value)} inputMode="email"/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:C.muted,display:"block",marginBottom:7}}>Password</label>
          <input className="fi" type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)}/>
        </div>
        <button className="sbtn" style={{margin:0,width:"100%"}} onClick={mode==="login"?handleLogin:handleSignup} disabled={loading}>
          {loading?"Loading…":mode==="login"?"Sign In →":"Create Account →"}
        </button>
        <div className="login-toggle" style={{marginTop:16}}>
          {mode==="login"?<><span>Don't have an account?</span><span className="login-link" onClick={()=>{setMode("signup");setErr("");}}>Sign Up</span></>
            :<><span>Already have an account?</span><span className="login-link" onClick={()=>{setMode("login");setErr("");}}>Sign In</span></>}
        </div>
      </div>
    </div>
  );
}

// ─── ACCOUNT SWITCHER ─────────────────────────────────────────────────────────
function AccountSwitcher({accounts,currentAccId,onSwitch,onAdd,setScreen}){
  return(
    <div className="screen">
      <div className="hdr"><div className="hdr-title">My <span>Accounts</span></div></div>
      <div style={{margin:"14px 14px 6px",fontSize:12,color:C.muted}}>Tap an account to switch. Each account tracks trades separately.</div>
      {accounts.map(acc=>{
        const isActive=acc.id===currentAccId;
        const pnl=acc.trades?.reduce((s,t)=>s+t.pnl,0)||0;
        const trades=acc.trades?.length||0;
        const wr=trades?(acc.trades.filter(t=>t.result==="WIN").length/trades*100).toFixed(0):0;
        return(
          <div key={acc.id} className={`acc-card${isActive?" active-acc":""}`} onClick={()=>{onSwitch(acc.id);setScreen("dashboard");}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div className="acc-name">{acc.name}</div>
                <div style={{fontSize:11,color:C.muted}}>{acc.broker||"No broker"} · {acc.leverage||"1:1"}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:16,fontWeight:700,color:pnl>=0?C.green:C.red}}>{fmtMoney(pnl)}</div>
                {isActive&&<span style={{fontSize:9,color:C.accent,fontWeight:700,letterSpacing:.5}}>ACTIVE</span>}
              </div>
            </div>
            <div className="acc-stats">
              <div className="acc-stat"><div className="acc-stat-v">{trades}</div><div className="acc-stat-l">Trades</div></div>
              <div className="acc-stat"><div className="acc-stat-v" style={{color:C.accent}}>{wr}%</div><div className="acc-stat-l">Win Rate</div></div>
              <div className="acc-stat"><div className="acc-stat-v" style={{color:C.blue}}>${parseFloat(acc.balance||10000).toLocaleString()}</div><div className="acc-stat-l">Balance</div></div>
              <div className="acc-stat"><div className="acc-stat-v" style={{color:C.gold}}>{acc.leverage||"1:100"}</div><div className="acc-stat-l">Leverage</div></div>
            </div>
          </div>
        );
      })}
      <button className="addnew" style={{margin:"4px 14px 8px",width:"calc(100% - 28px)"}} onClick={onAdd}>
        <span style={{fontSize:18}}>+</span> Add New Account
      </button>
    </div>
  );
}

function AddAccountModal({onSave,onClose}){
  const [f,setF]=useState({name:"",balance:"10000",leverage:"1:100",broker:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const [err,setErr]=useState("");
  const submit=()=>{
    if(!f.name.trim()){setErr("Account name is required.");return;}
    onSave({id:uid(),name:f.name.trim(),balance:f.balance,leverage:f.leverage,broker:f.broker,trades:[]});
  };
  return(
    <div className="ov">
      <div className="sh">
        <div className="hdl"/>
        <div className="sht"><span>New Trading Account</span><button className="xbtn" onClick={onClose}>×</button></div>
        {err&&<div style={{margin:"10px 18px 0",padding:"9px 12px",background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,fontSize:12,color:C.red}}>{err}</div>}
        <div className="fg"><label>Account Name *</label><input className="fi" placeholder="e.g. Forex Live, Crypto Demo..." value={f.name} onChange={e=>{s("name",e.target.value);setErr("");}}/></div>
        <div className="fg"><label>Broker (optional)</label><input className="fi" placeholder="e.g. IC Markets, Pepperstone..." value={f.broker} onChange={e=>s("broker",e.target.value)}/></div>
        <div className="fr">
          <div><label>Starting Balance ($)</label><input className="fi" type="number" value={f.balance} onChange={e=>s("balance",e.target.value)} inputMode="decimal"/></div>
          <div><label>Leverage</label>
            <select className="fi fsel" value={f.leverage} onChange={e=>s("leverage",e.target.value)} style={{background:C.s2,color:C.text}}>
              {["1:1","1:10","1:30","1:50","1:100","1:200","1:500","1:1000"].map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <button className="sbtn" onClick={submit}>CREATE ACCOUNT ✦</button>
        <button className="cbtn" onClick={onClose}>Cancel</button>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

// ─── PAIR FORM ─────────────────────────────────────────────────────────────────
function PairForm({pair,onSave,onClose,existingPairs}){
  const isEdit=!!pair?.id;
  const [f,setF]=useState(pair||{symbol:"",category:"Forex Major",pip:0.0001,color:PALETTE[0],icon:"💱",active:true,notes:""});
  const [pipStr,setPipStr]=useState(String(pair?.pip??0.0001));
  const [err,setErr]=useState("");
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const HINTS={"Forex Major":"0.0001","Forex Cross":"0.0001","Forex Exotic":"0.0001","Crypto":"1 (BTC) or 0.01 (ETH)","Commodity":"0.01 Gold / 0.001 Silver","Index":"0.1 NAS / 1 DOW","Stock":"0.01","Other":"0.0001"};

  const submit=()=>{
    const sym=f.symbol.trim().toUpperCase();
    if(!sym){setErr("Symbol required.");return;}
    if(existingPairs.find(p=>p.symbol===sym&&p.id!==f.id)){setErr(`${sym} already exists.`);return;}
    const pip=parseFloat(pipStr);
    if(isNaN(pip)||pip<=0){setErr("Enter valid pip size.");return;}
    onSave({...f,id:pair?.id||uid(),symbol:sym,pip});
  };

  return(
    <div className="ov">
      <div className="sh">
        <div className="hdl"/>
        <div className="sht"><span>{isEdit?"Edit Pair":"Add Custom Pair"}</span><button className="xbtn" onClick={onClose}>×</button></div>
        <div style={{margin:"12px 18px 0",background:C.s2,border:`1px solid ${f.color}44`,borderRadius:13,padding:"11px 14px",display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:40,height:40,borderRadius:10,background:f.color+"20",border:`1px solid ${f.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19}}>{f.icon}</div>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:16,color:f.color}}>{f.symbol||"SYMBOL"}</div><div style={{fontSize:11,color:C.muted}}>{f.category} · pip {pipStr}</div></div>
          <Toggle on={f.active} onChange={v=>s("active",v)}/>
        </div>
        {err&&<div style={{margin:"10px 18px 0",padding:"9px 12px",background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,fontSize:12,color:C.red}}>{err}</div>}
        <div className="fg"><label>Symbol *</label><input className="fi" placeholder="e.g. EURAUD, BTCETH..." value={f.symbol} onChange={e=>{s("symbol",e.target.value.toUpperCase());setErr("");}}/></div>
        <div className="fr">
          <div><label>Category</label><select className="fi fsel" value={f.category} onChange={e=>s("category",e.target.value)} style={{background:C.s2,color:C.text}}>{PAIR_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label>Pip Size</label><input className="fi" placeholder="0.0001" value={pipStr} onChange={e=>{setPipStr(e.target.value);setErr("");}} onBlur={()=>{const v=parseFloat(pipStr);if(!isNaN(v)&&v>0)setPipStr(String(v));}} inputMode="decimal"/>
            <div style={{fontSize:9,color:C.muted,marginTop:4}}>{HINTS[f.category]}</div>
          </div>
        </div>
        <div className="fg"><label>Colour</label><ColorPicker value={f.color} onChange={v=>s("color",v)}/></div>
        <div className="fg"><label>Icon</label><IconPicker value={f.icon} onChange={v=>s("icon",v)} icons={PAIR_ICONS}/></div>
        <div className="fg"><label>Notes</label><textarea className="fi" rows={2} placeholder="Best sessions, correlations..." value={f.notes||""} onChange={e=>s("notes",e.target.value)} style={{resize:"none",lineHeight:1.6}}/></div>
        <div className="infobox">💡 Pip size powers P&L accuracy. Forex=0.0001, JPY=0.01, Gold=0.01, Crypto=1.</div>
        <button className="sbtn" onClick={submit}>{isEdit?"SAVE CHANGES":"ADD PAIR ✦"}</button>
        <button className="cbtn" onClick={onClose}>Cancel</button>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

// ─── STRATEGY FORM ─────────────────────────────────────────────────────────────
function StrategyForm({strategy,onSave,onClose}){
  const isEdit=!!strategy?.id;
  // FIXED: initialise all fields to safe defaults
  const [f,setF]=useState(()=>({
    name:"",category:"Technical",color:PALETTE[2],icon:STRAT_ICONS[0],
    timeframes:["1H"],description:"",rules:"",winTarget:55,rrTarget:2.0,active:true,notes:"",
    ...(strategy||{}),
    // Ensure number fields are numbers
    winTarget:Number(strategy?.winTarget??55),
    rrTarget:Number(strategy?.rrTarget??2.0),
  }));
  const [err,setErr]=useState("");
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleTF=tf=>s("timeframes",(f.timeframes||[]).includes(tf)?(f.timeframes||[]).filter(t=>t!==tf):[...(f.timeframes||[]),tf]);

  const submit=()=>{
    if(!(f.name||"").trim()){setErr("Strategy name is required.");return;}
    const saved={
      ...f,
      id:strategy?.id||uid(),
      name:f.name.trim(),
      winTarget:Number(f.winTarget)||55,
      rrTarget:Number(f.rrTarget)||2.0,
      timeframes:f.timeframes||[],
    };
    onSave(saved);
  };

  return(
    <div className="ov">
      <div className="sh">
        <div className="hdl"/>
        <div className="sht"><span>{isEdit?"Edit Strategy":"New Strategy"}</span><button className="xbtn" onClick={onClose}>×</button></div>
        <div style={{margin:"12px 18px 0",background:C.s2,border:`1px solid ${f.color}44`,borderRadius:13,padding:"11px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <div style={{width:37,height:37,borderRadius:9,background:f.color+"20",border:`1px solid ${f.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{f.icon}</div>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:f.color}}>{f.name||"Strategy Name"}</div><div style={{fontSize:11,color:C.muted}}>{f.category}</div></div>
            <Toggle on={!!f.active} onChange={v=>s("active",v)}/>
          </div>
          <div style={{display:"flex",gap:10,fontSize:11}}><span style={{color:C.green}}>🎯 {f.winTarget}%</span><span style={{color:C.blue}}>📐 {f.rrTarget}R</span></div>
        </div>
        {err&&<div style={{margin:"10px 18px 0",padding:"9px 12px",background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,fontSize:12,color:C.red}}>{err}</div>}
        <div className="fg"><label>Name *</label><input className="fi" placeholder="e.g. London Killzone Break" value={f.name||""} onChange={e=>{s("name",e.target.value);setErr("");}}/></div>
        <div className="fg"><label>Category</label><select className="fi fsel" value={f.category||"Technical"} onChange={e=>s("category",e.target.value)} style={{background:C.s2,color:C.text}}>{STRAT_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="fg"><label>Description</label><textarea className="fi" rows={2} placeholder="Your edge in one sentence..." value={f.description||""} onChange={e=>s("description",e.target.value)} style={{resize:"none",lineHeight:1.6}}/></div>
        <div className="fg"><label>Entry Rules</label><textarea className="fi" rows={4} placeholder={"1. HTF bias\n2. Session timing\n3. Entry signal\n4. SL placement"} value={f.rules||""} onChange={e=>s("rules",e.target.value)} style={{resize:"none",lineHeight:1.8}}/></div>
        <div className="fg"><label>Timeframes</label><div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:7}}>{ALL_TF.map(tf=><button key={tf} className={`tfopt${(f.timeframes||[]).includes(tf)?" sel":""}`} onClick={()=>toggleTF(tf)}>{tf}</button>)}</div></div>
        <div className="fr">
          <div><label>Win Rate Target %</label><input className="fi" type="number" min="0" max="100" value={f.winTarget||55} onChange={e=>s("winTarget",Math.max(0,Math.min(100,parseInt(e.target.value)||50))}/></div>
          <div><label>R:R Target</label><input className="fi" type="number" min="0" step="0.1" value={f.rrTarget||2.0} onChange={e=>s("rrTarget",Math.max(0,parseFloat(e.target.value)||1.5))}/></div>
        </div>
        <div className="fg"><label>Colour</label><ColorPicker value={f.color||PALETTE[2]} onChange={v=>s("color",v)}/></div>
        <div className="fg"><label>Icon</label><IconPicker value={f.icon||STRAT_ICONS[0]} onChange={v=>s("icon",v)} icons={STRAT_ICONS}/></div>
        <div className="fg"><label>Notes</label><textarea className="fi" rows={2} placeholder="Best conditions, pairs, avoid when..." value={f.notes||""} onChange={e=>s("notes",e.target.value)} style={{resize:"none",lineHeight:1.6}}/></div>
        <button className="sbtn" onClick={submit}>{isEdit?"SAVE CHANGES":"ADD STRATEGY ✦"}</button>
        <button className="cbtn" onClick={onClose}>Cancel</button>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

// ─── LIBRARY ──────────────────────────────────────────────────────────────────
function Library({pairs,strategies,onPairs,onStrats,showToast,isPro,onUpgrade}){
  const [tab,setTab]=useState("pairs");
  const [q,setQ]=useState("");
  const [pForm,setPForm]=useState(null);
  const [sForm,setSForm]=useState(null);
  const [del,setDel]=useState(null);
  const [expand,setExpand]=useState(null);

  const fp=pairs.filter(p=>(p.symbol||"").toLowerCase().includes(q.toLowerCase()));
  const fs=strategies.filter(s=>(s.name||"").toLowerCase().includes(q.toLowerCase()));

  const savePair=useCallback(p=>{
    onPairs(prev=>(prev.find(x=>x.id===p.id)?prev.map(x=>x.id===p.id?p:x):[p,...prev]));
    setPForm(null);
    showToast(`${p.symbol} saved ✦`);
  },[onPairs,showToast]);

  // FIXED: strategy save uses functional update, guaranteed correct
  const saveStrat=useCallback(s=>{
    onStrats(prev=>{
      const exists=prev.find(x=>x.id===s.id);
      const next=exists?prev.map(x=>x.id===s.id?s:x):[s,...prev];
      return next;
    });
    setSForm(null);
    showToast(`${s.name} saved ✦`);
  },[onStrats,showToast]);

  const confirmDel=()=>{
    if(del.type==="pair") onPairs(p=>p.filter(x=>x.id!==del.id));
    else onStrats(s=>s.filter(x=>x.id!==del.id));
    showToast("Removed");setDel(null);
  };

  const tryAddPair=()=>{
    if(!isPro&&pairs.length>=FREE_PAIR_LIMIT){showToast(`Free plan: max ${FREE_PAIR_LIMIT} pairs`);return;}
    setPForm({});
  };
  const tryAddStrat=()=>{
    if(!isPro&&strategies.length>=FREE_STRAT_LIMIT){showToast(`Free plan: max ${FREE_STRAT_LIMIT} strategies`);return;}
    setSForm({});
  };

  return(
    <div className="screen">
      <div className="hdr">
        <div className="hdr-title">My <span>Library</span></div>
        <div style={{fontSize:11,color:C.muted,display:"flex",gap:10}}>
          <span><b style={{color:C.accent}}>{pairs.filter(p=>p.active).length}</b>/{pairs.length} pairs</span>
          <span><b style={{color:C.purple}}>{strategies.filter(s=>s.active).length}</b>/{strategies.length} strats</span>
        </div>
      </div>
      <div className="ltabs" style={{marginTop:14}}>
        <button className={`ltab${tab==="pairs"?" act":""}`} onClick={()=>{setTab("pairs");setQ("");}}>💱 Pairs ({pairs.length})</button>
        <button className={`ltab${tab==="strategies"?" act":""}`} onClick={()=>{setTab("strategies");setQ("");}}>🧠 Strategies ({strategies.length})</button>
      </div>
      <div className="srch">
        <span style={{fontSize:13,color:C.muted}}>🔍</span>
        <input placeholder={tab==="pairs"?"Search pairs...":"Search strategies..."} value={q} onChange={e=>setQ(e.target.value)}/>
        {q&&<span style={{cursor:"pointer",color:C.muted,fontSize:17}} onClick={()=>setQ("")}>×</span>}
      </div>
      {/* Plan limit banners */}
      {tab==="pairs"&&!isPro&&pairs.length>=FREE_PAIR_LIMIT&&(
        <div className="limit-warn">
          <span style={{fontSize:20}}>🔒</span>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:C.gold}}>Pair limit reached ({FREE_PAIR_LIMIT}/{FREE_PAIR_LIMIT})</div><div style={{fontSize:11,color:C.muted}}>Upgrade to Pro for unlimited pairs.</div></div>
          <button onClick={onUpgrade} style={{background:`linear-gradient(135deg,${C.gold},#E55A00)`,border:"none",borderRadius:9,padding:"8px 12px",color:"#000",fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>Upgrade</button>
        </div>
      )}
      {tab==="strategies"&&!isPro&&strategies.length>=FREE_STRAT_LIMIT&&(
        <div className="limit-warn">
          <span style={{fontSize:20}}>🔒</span>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:C.gold}}>Strategy limit reached ({FREE_STRAT_LIMIT}/{FREE_STRAT_LIMIT})</div><div style={{fontSize:11,color:C.muted}}>Upgrade to Pro for unlimited strategies.</div></div>
          <button onClick={onUpgrade} style={{background:`linear-gradient(135deg,${C.gold},#E55A00)`,border:"none",borderRadius:9,padding:"8px 12px",color:"#000",fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>Upgrade</button>
        </div>
      )}
      <button className="addnew" onClick={tab==="pairs"?tryAddPair:tryAddStrat}>
        <span style={{fontSize:18}}>+</span> Add {tab==="pairs"?"Pair":"Strategy"}
        {!isPro&&<span style={{fontSize:9,color:C.muted,marginLeft:4}}>({tab==="pairs"?`${pairs.length}/${FREE_PAIR_LIMIT}`:`${strategies.length}/${FREE_STRAT_LIMIT}`})</span>}
      </button>
      {tab==="pairs"&&(
        <>
          {fp.length===0&&<div className="empty"><div className="ei">🔍</div><div style={{fontSize:13}}>No pairs found</div></div>}
          {fp.map(p=>(
            <div key={p.id} className={`pi${p.active?"":" off"}`}>
              <div className="pico" style={{background:(p.color||C.accent)+"18",border:`1px solid ${p.color||C.accent}33`}}>{p.icon||"💱"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14}}>{p.symbol}</div>
                <div style={{fontSize:10,color:p.color||C.accent}}>{p.category}</div>
                <div style={{fontSize:10,color:C.muted}}>pip: {p.pip}</div>
              </div>
              <div className="pact">
                <div className="ibtn" onClick={()=>setPForm(p)}>✏️</div>
                <div className="ibtn del" onClick={()=>setDel({type:"pair",id:p.id,name:p.symbol})}>🗑</div>
                <Toggle on={!!p.active} onChange={()=>onPairs(prev=>prev.map(x=>x.id===p.id?{...x,active:!x.active}:x))}/>
              </div>
            </div>
          ))}
        </>
      )}
      {tab==="strategies"&&(
        <>
          {fs.length===0&&<div className="empty"><div className="ei">🔍</div><div style={{fontSize:13}}>No strategies found</div></div>}
          {fs.map(s=>(
            <div key={s.id} className={`si${s.active?"":" off"}`} onClick={()=>setExpand(expand===s.id?null:s.id)}>
              <div style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:7}}>
                <div className="sico" style={{background:(s.color||C.purple)+"18",border:`1px solid ${s.color||C.purple}33`}}>{s.icon||"📊"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:13,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span>{s.name}</span>
                    <span style={{fontSize:9,color:s.color||C.purple,background:(s.color||C.purple)+"18",padding:"2px 6px",borderRadius:4}}>{s.category}</span>
                  </div>
                  {s.description&&<div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.5}}>{s.description}</div>}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                  <div className="ibtn" onClick={()=>setSForm(s)}>✏️</div>
                  <div className="ibtn del" onClick={()=>setDel({type:"strategy",id:s.id,name:s.name})}>🗑</div>
                  <Toggle on={!!s.active} onChange={()=>onStrats(prev=>prev.map(x=>x.id===s.id?{...x,active:!x.active}:x))}/>
                </div>
              </div>
              {(s.timeframes||[]).length>0&&<div className="tfall">{(s.timeframes||[]).map(tf=><span key={tf} className="tfbadge">{tf}</span>)}</div>}
              <div className="stgt">
                <div className="stg"><div style={{fontSize:9,color:C.muted}}>Win Target</div><div style={{fontFamily:"JetBrains Mono,monospace",fontSize:14,fontWeight:700,color:C.green,marginTop:2}}>{s.winTarget||55}%</div></div>
                <div className="stg"><div style={{fontSize:9,color:C.muted}}>R:R Target</div><div style={{fontFamily:"JetBrains Mono,monospace",fontSize:14,fontWeight:700,color:C.blue,marginTop:2}}>{s.rrTarget||2.0}R</div></div>
              </div>
              {expand===s.id&&s.rules&&<div className="rules-preview">📋 Rules:{"\n"}{s.rules}</div>}
            </div>
          ))}
        </>
      )}
      {del&&(
        <div className="del-confirm">
          <div className="del-box">
            <div style={{fontSize:16,fontWeight:800,marginBottom:9}}>Delete "{del.name}"?</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:18,lineHeight:1.6}}>Removed from library. Existing trades keep this label.</div>
            <div style={{display:"flex",gap:9}}>
              <button onClick={()=>setDel(null)} style={{flex:1,padding:12,borderRadius:11,border:`1px solid ${C.border}`,background:"none",color:C.text,fontFamily:"'Outfit',sans-serif",fontWeight:700,cursor:"pointer"}}>Cancel</button>
              <button onClick={confirmDel} style={{flex:1,padding:12,borderRadius:11,border:"none",background:C.red,color:"#fff",fontFamily:"'Outfit',sans-serif",fontWeight:800,cursor:"pointer"}}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {pForm!==null&&<PairForm pair={pForm} onSave={savePair} onClose={()=>setPForm(null)} existingPairs={pairs}/>}
      {sForm!==null&&<StrategyForm strategy={sForm} onSave={saveStrat} onClose={()=>setSForm(null)}/>}
    </div>
  );
}

// ─── TRADE FORM (ADD + EDIT) ──────────────────────────────────────────────────
function TradeForm({trade,pairs,strategies,onSave,onClose,profile}){
  const isEdit=!!trade?.id;
  const ap=pairs.filter(p=>p.active);
  const as=strategies.filter(s=>s.active);
  const [quickMode,setQuickMode]=useState(!isEdit);
  const [f,setF]=useState({
    pair:ap[0]?.symbol||"",type:"BUY",entry:"",exit:"",sl:"",tp:"",
    lot:"0.10",risk:profile?.defaultRisk||"1",
    strategy:as[0]?.name||"",session:profile?.session||"London",
    emotionBefore:"Neutral",emotionAfter:"Neutral",notes:"",
    ...(trade||{}),
  });
  const [err,setErr]=useState("");
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const pO=ap.find(p=>p.symbol===f.pair);
  const sO=as.find(x=>x.name===f.strategy);

  // Live P&L: (exit-entry)/pip * lot * 10
  const pnl=useMemo(()=>{
    const e=parseFloat(f.entry),x=parseFloat(f.exit),l=parseFloat(f.lot);
    if(!e||!x||!l||isNaN(e)||isNaN(x)||isNaN(l)) return null;
    const pip=pO?.pip||0.0001;
    return parseFloat(((f.type==="BUY"?x-e:e-x)/pip*l*10).toFixed(2));
  },[f.entry,f.exit,f.lot,f.type,pO]);

  // Live R:R = |TP-Entry| / |Entry-SL|
  const rr=useMemo(()=>{
    const e=parseFloat(f.entry),sl=parseFloat(f.sl),tp=parseFloat(f.tp);
    if(!e||!sl||!tp||isNaN(e)||isNaN(sl)||isNaN(tp)) return null;
    const risk=Math.abs(e-sl);
    if(risk===0) return null;
    return parseFloat((Math.abs(tp-e)/risk).toFixed(2));
  },[f.entry,f.sl,f.tp]);

  const result=pnl===null?null:pnl>0?"WIN":pnl<0?"LOSS":"BREAKEVEN";

  const submit=()=>{
    if(!f.pair){setErr("Select a trading pair.");return;}
    if(!f.entry||isNaN(parseFloat(f.entry))){setErr("Enter a valid entry price.");return;}
    if(!f.exit||isNaN(parseFloat(f.exit))){setErr("Enter a valid exit price.");return;}
    const finalPnl=pnl!==null?pnl:(isEdit?parseFloat(trade.pnl||0):0);
    const finalRR=rr!==null?rr:(isEdit?parseFloat(trade.rr||0):0);
    onSave({
      ...(trade||{}),
      id:trade?.id||uid(),
      pair:f.pair,type:f.type,entry:f.entry,exit:f.exit,
      sl:f.sl,tp:f.tp,lotSize:f.lot,risk:f.risk,
      strategy:f.strategy,session:f.session,
      emotionBefore:f.emotionBefore,emotionAfter:f.emotionAfter,
      notes:f.notes,tags:[],
      date:trade?.date||new Date().toISOString(),
      pnl:finalPnl,rr:finalRR,
      result:result||(isEdit?trade.result:"BREAKEVEN"),
    });
  };

  return(
    <div className="ov">
      <div className="sh">
        <div className="hdl"/>
        <div className="sht">
          <span>{isEdit?"Edit Trade":"Log Trade ⚡"}</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!isEdit&&<button onClick={()=>setQuickMode(!quickMode)} style={{background:C.s3,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px",color:C.muted,fontFamily:"'Outfit',sans-serif",fontSize:11,fontWeight:700,cursor:"pointer"}}>{quickMode?"+ Details":"− Simple"}</button>}
            <button className="xbtn" onClick={onClose}>×</button>
          </div>
        </div>
        {err&&<div style={{margin:"10px 18px 0",padding:"9px 12px",background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,fontSize:12,color:C.red}}>{err}</div>}
        <div className="ttog">
          <button className={`tbtn${f.type==="BUY"?" ba":""}`} onClick={()=>s("type","BUY")}>▲ BUY</button>
          <button className={`tbtn${f.type==="SELL"?" sa":""}`} onClick={()=>s("type","SELL")}>▼ SELL</button>
        </div>
        <div className="fg"><label>Pair *</label>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <div style={{width:36,height:36,borderRadius:9,background:(pO?.color||C.accent)+"18",border:`1px solid ${pO?.color||C.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{pO?.icon||"💱"}</div>
            <select className="fi fsel" value={f.pair} onChange={e=>s("pair",e.target.value)} style={{background:C.s2,color:C.text,flex:1}}>
              {ap.length===0&&<option value="">No active pairs — add in Library</option>}
              {ap.map(p=><option key={p.id} value={p.symbol}>{p.symbol} ({p.category})</option>)}
            </select>
          </div>
        </div>
        <div className="fr">
          <div><label>Entry *</label><input className="fi" placeholder="1.08500" value={f.entry} onChange={e=>{s("entry",e.target.value);setErr("");}} inputMode="decimal"/></div>
          <div><label>Exit *</label><input className="fi" placeholder="1.08750" value={f.exit} onChange={e=>{s("exit",e.target.value);setErr("");}} inputMode="decimal"/></div>
        </div>
        <div className="fr">
          <div><label>Stop Loss</label><input className="fi" placeholder="1.08200" value={f.sl||""} onChange={e=>s("sl",e.target.value)} inputMode="decimal"/></div>
          <div><label>Take Profit</label><input className="fi" placeholder="1.09000" value={f.tp||""} onChange={e=>s("tp",e.target.value)} inputMode="decimal"/></div>
        </div>
        <div className="fr">
          <div><label>Lot Size</label><input className="fi" value={f.lot||"0.10"} onChange={e=>s("lot",e.target.value)} inputMode="decimal"/></div>
          <div><label>Risk %</label><input className="fi" value={f.risk||"1"} onChange={e=>s("risk",e.target.value)} inputMode="decimal"/></div>
        </div>
        {pnl!==null&&(
          <div className="calc">
            <div className="ci"><div className="cl">P&L</div><div className="cv" style={{color:pnl>=0?C.green:C.red}}>{fmtMoney(pnl)}</div></div>
            <div className="ci"><div className="cl">R:R</div><div className="cv" style={{color:C.blue}}>{rr!=null?`${rr}R`:"Need SL+TP"}</div></div>
            <div className="ci"><div className="cl">Result</div><div className="cv" style={{color:result==="WIN"?C.green:result==="LOSS"?C.red:C.muted}}>{result}</div></div>
          </div>
        )}
        <div className="fg"><label>Strategy</label>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <div style={{width:36,height:36,borderRadius:9,background:(sO?.color||C.purple)+"18",border:`1px solid ${sO?.color||C.purple}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{sO?.icon||"📊"}</div>
            <select className="fi fsel" value={f.strategy||""} onChange={e=>s("strategy",e.target.value)} style={{background:C.s2,color:C.text,flex:1}}>
              {as.length===0&&<option value="">No active strategies</option>}
              {as.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}
            </select>
          </div>
        </div>
        {(!quickMode||isEdit)&&(
          <>
            <div className="fr">
              <div><label>Session</label><select className="fi fsel" value={f.session||"London"} onChange={e=>s("session",e.target.value)} style={{background:C.s2,color:C.text}}>{SESSIONS.map(x=><option key={x}>{x}</option>)}</select></div>
              <div><label>Emotion Before</label><select className="fi fsel" value={f.emotionBefore||"Neutral"} onChange={e=>s("emotionBefore",e.target.value)} style={{background:C.s2,color:C.text}}>{EMOTIONS.map(x=><option key={x}>{x}</option>)}</select></div>
            </div>
            <div className="fg"><label>Emotion After</label><select className="fi fsel" value={f.emotionAfter||"Neutral"} onChange={e=>s("emotionAfter",e.target.value)} style={{background:C.s2,color:C.text}}>{EMOTIONS.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="fg"><label>Notes</label><textarea className="fi" rows={3} placeholder="Setup, confluences, what you saw..." value={f.notes||""} onChange={e=>s("notes",e.target.value)} style={{resize:"none",lineHeight:1.6}}/></div>
          </>
        )}
        <button className="sbtn" onClick={submit}>{isEdit?"SAVE CHANGES":"LOG TRADE ⚡"}</button>
        <button className="cbtn" onClick={onClose}>Cancel</button>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({trades,analytics,insights,setScreen}){
  const todayPnl=trades.filter(t=>new Date(t.date).toDateString()===new Date().toDateString()).reduce((s,t)=>s+t.pnl,0);
  const weekTrades=trades.filter(t=>(Date.now()-new Date(t.date))<7*864e5);
  const weekPnl=weekTrades.reduce((s,t)=>s+t.pnl,0);
  const pi=insights[0];
  const cm={success:C.accent,warning:C.gold,danger:C.red,info:C.blue};

  return(
    <div className="screen" style={{paddingTop:0}}>
      <div className="hero">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5,fontWeight:600,letterSpacing:.5}}>TOTAL P&L</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:36,fontWeight:700,letterSpacing:-1,color:(analytics?.totalPnl||0)>=0?C.green:C.red,lineHeight:1}}>
              {analytics?fmtMoney(analytics.totalPnl):"+$0.00"}
            </div>
            <div style={{display:"flex",gap:10,marginTop:6,fontSize:11,flexWrap:"wrap"}}>
              <span style={{color:C.muted}}>{trades.length} trades</span>
              <span style={{color:todayPnl>=0?C.green:C.red}}>Today: {fmtMoney(todayPnl)}</span>
              {(analytics?.currentStreak||0)>=2&&<span style={{color:C.gold}}>🔥 {analytics.currentStreak}-streak</span>}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>WIN RATE</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:26,fontWeight:700,color:C.accent,lineHeight:1}}>{analytics?.winRate.toFixed(0)||0}%</div>
            {analytics&&<div className={`trend-badge ${analytics.trendWR>3?"trend-up":analytics.trendWR<-5?"trend-dn":"trend-nt"}`} style={{marginTop:5,fontSize:10}}>
              {analytics.trendWR>3?"▲":analytics.trendWR<-5?"▼":"●"} {Math.abs(analytics.trendWR).toFixed(0)}%
            </div>}
          </div>
        </div>
      </div>
      <div className="mg2" style={{marginTop:12}}>
        {[
          {l:"Profit Factor",v:analytics?.profitFactor.toFixed(2)||"–",c:(analytics?.profitFactor||0)>=1.5?C.green:C.gold,sub:(analytics?.profitFactor||0)>=1.5?"Healthy":"Needs work"},
          {l:"Discipline",v:analytics?.discipline.total||0,c:analytics?.discipline.total>=70?C.green:analytics?.discipline.total>=50?C.gold:C.red,sub:`${analytics?.discipline.total||0}/100`,big:true},
          {l:"Avg Win",v:analytics?fmtMoney(analytics.avgWin):"–",c:C.green,sub:`vs -$${analytics?.avgLoss.toFixed(0)||0} loss`},
          {l:"Max Drawdown",v:analytics?`${analytics.maxDD.toFixed(1)}%`:"–",c:C.red,sub:"Peak to trough"},
        ].map((m,i)=>(
          <div key={i} className="stat"><div className="stat-label">{m.l}</div><div className="stat-val" style={{color:m.c,fontSize:m.big?24:16}}>{m.v}</div>{m.sub&&<div className="stat-sub">{m.sub}</div>}</div>
        ))}
      </div>
      {pi&&(
        <div className="priority-insight" onClick={()=>setScreen("insights")}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <span style={{fontSize:15}}>{pi.icon}</span>
            <span style={{fontSize:12,fontWeight:800,color:cm[pi.type]}}>{pi.title}</span>
          </div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{pi.text.slice(0,120)}{pi.text.length>120?"…":""}</div>
          <div style={{fontSize:10,color:C.accent,marginTop:8,fontWeight:700}}>View all coaching insights →</div>
        </div>
      )}
      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <div><div style={{fontSize:13,fontWeight:800}}>Equity Curve</div><div style={{fontSize:10,color:C.muted}}>P&L growth</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"JetBrains Mono,monospace",fontSize:13,fontWeight:700,color:C.accent}}>{fmtMoney(analytics?.totalPnl||0)}</div><div style={{fontSize:10,color:C.muted}}>net P&L</div></div>
        </div>
        {analytics?(
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={analytics.equityCurve.slice(-30)} margin={{left:-22,right:0}}>
              <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={.25}/><stop offset="100%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
              <Area type="monotone" dataKey="equity" stroke={C.accent} strokeWidth={2} fill="url(#eg)" dot={false} isAnimationActive={false}/>
              <Tooltip content={<CTT/>} cursor={{stroke:C.muted,strokeWidth:1,strokeDasharray:"3 3"}}/>
            </AreaChart>
          </ResponsiveContainer>
        ):<div style={{height:110,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:12}}>Add trades to see curve</div>}
      </div>
      <div className="card" style={{padding:"13px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:10,color:C.muted,marginBottom:3}}>THIS WEEK</div><div style={{fontFamily:"JetBrains Mono,monospace",fontSize:18,fontWeight:700,color:weekPnl>=0?C.green:C.red}}>{fmtMoney(weekPnl)}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.muted}}>TRADES</div><div style={{fontSize:18,fontWeight:700,marginTop:2}}>{weekTrades.length}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.muted}}>WIN RATE</div><div style={{fontFamily:"JetBrains Mono,monospace",fontSize:18,fontWeight:700,color:C.accent,marginTop:2}}>{weekTrades.length?(weekTrades.filter(t=>t.result==="WIN").length/weekTrades.length*100).toFixed(0):0}%</div></div>
        </div>
      </div>
      <div className="sec">RECENT TRADES</div>
      {trades.length===0&&<div className="empty"><div className="ei">📋</div><div style={{fontSize:13}}>No trades yet — tap + to log one.</div></div>}
      {trades.slice(0,6).map(t=><TradeRow key={t.id} trade={t}/>)}
    </div>
  );
}

// ─── TRADE ROW ────────────────────────────────────────────────────────────────
function TradeRow({trade,onClick}){
  return(
    <div className="tr" onClick={onClick}>
      <div className={`tb ${trade.type==="BUY"?"buy":"sell"}`}>{trade.type}</div>
      <div className="ti"><div className="tpair">{trade.pair}</div><div className="tmeta">{trade.strategy||"—"} · {fmtDate(trade.date)}</div></div>
      <div className="tpnl"><div className={`pv ${trade.pnl>=0?"g":"r"}`}>{fmtMoney(trade.pnl)}</div><div className="prr">{(trade.rr||0).toFixed(1)}R · {trade.result}</div></div>
    </div>
  );
}

// ─── HISTORY (Edit + Delete) ──────────────────────────────────────────────────
function History({trades,pairs,strategies,onEdit,onDelete,profile}){
  const [filter,setFilter]=useState("ALL");
  const [dateMode,setDateMode]=useState("ALL");
  const [customDate,setCustomDate]=useState(isoDate(new Date()));
  const [detail,setDetail]=useState(null);
  const [editTrade,setEditTrade]=useState(null);
  const [delTrade,setDelTrade]=useState(null);
  const now=Date.now();

  const dateFiltered=useMemo(()=>{
    if(dateMode==="7D")  return trades.filter(t=>(now-new Date(t.date))<7*864e5);
    if(dateMode==="30D") return trades.filter(t=>(now-new Date(t.date))<30*864e5);
    if(dateMode==="90D") return trades.filter(t=>(now-new Date(t.date))<90*864e5);
    if(dateMode==="day") return trades.filter(t=>new Date(t.date).toDateString()===new Date(customDate).toDateString());
    if(dateMode==="week"){const d=new Date(customDate);const st=new Date(d);st.setDate(d.getDate()-d.getDay());const en=new Date(st);en.setDate(st.getDate()+7);return trades.filter(t=>{const dt=new Date(t.date);return dt>=st&&dt<en;});}
    if(dateMode==="month"){const d=new Date(customDate);return trades.filter(t=>{const dt=new Date(t.date);return dt.getFullYear()===d.getFullYear()&&dt.getMonth()===d.getMonth();});}
    return trades;
  },[trades,dateMode,customDate]);

  const pairFilters=["ALL","WIN","LOSS",...Array.from(new Set(trades.map(t=>t.pair))).slice(0,5)];
  const fd=useMemo(()=>filter==="ALL"?dateFiltered:["WIN","LOSS"].includes(filter)?dateFiltered.filter(t=>t.result===filter):dateFiltered.filter(t=>t.pair===filter),[filter,dateFiltered]);
  const summary=useMemo(()=>{const pnl=fd.reduce((s,t)=>s+t.pnl,0);const wr=fd.length?fd.filter(t=>t.result==="WIN").length/fd.length*100:0;return{pnl,wr,count:fd.length};},[fd]);

  const pc=sym=>pairs?.find(p=>p.symbol===sym)?.color||C.accent;

  return(
    <div className="screen">
      <div className="hdr"><div className="hdr-title">Trade <span>Journal</span></div><div style={{fontSize:12,color:C.muted}}>{fd.length} trades</div></div>
      <div className="date-range" style={{marginTop:12}}>
        {["7D","30D","90D","ALL"].map(r=><button key={r} className={`dr-btn${dateMode===r?" act":""}`} onClick={()=>setDateMode(r)}>{r}</button>)}
      </div>
      <div className="date-picker-row">
        <input type="date" className="date-input" value={customDate} onChange={e=>setCustomDate(e.target.value)}/>
        <div style={{display:"flex",gap:5}}>
          {[["day","📅"],["week","📆"],["month","🗓"]].map(([m,icon])=>(
            <button key={m} className={`dr-btn${dateMode===m?" act":""}`} style={{padding:"7px",fontSize:16}} onClick={()=>setDateMode(m)}>{icon}</button>
          ))}
        </div>
      </div>
      <div className="card" style={{padding:"11px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:10,color:C.muted}}>FILTERED P&L</div><div style={{fontFamily:"JetBrains Mono,monospace",fontSize:18,fontWeight:700,color:summary.pnl>=0?C.green:C.red,marginTop:2}}>{fmtMoney(summary.pnl)}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.muted}}>TRADES</div><div style={{fontSize:18,fontWeight:700,marginTop:2}}>{summary.count}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.muted}}>WIN RATE</div><div style={{fontFamily:"JetBrains Mono,monospace",fontSize:18,fontWeight:700,color:C.accent,marginTop:2}}>{summary.wr.toFixed(0)}%</div></div>
        </div>
      </div>
      <div className="fb">{pairFilters.map(f=><div key={f} className={`pill${filter===f?" act":""}`} onClick={()=>setFilter(f)}>{f}</div>)}</div>
      {fd.length===0&&<div className="empty"><div className="ei">📋</div><div style={{fontSize:13}}>No trades in this filter</div></div>}
      {fd.map(t=><TradeRow key={t.id} trade={t} onClick={()=>setDetail(t)}/>)}

      {/* Detail sheet with edit/delete */}
      {detail&&(
        <div className="ov" onClick={()=>setDetail(null)}>
          <div className="sh" onClick={e=>e.stopPropagation()}>
            <div className="hdl"/>
            <div style={{padding:"0 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:10,height:10,borderRadius:3,background:pc(detail.pair)}}/>
                  <div style={{fontSize:19,fontWeight:900}}>{detail.pair}</div>
                </div>
                <div style={{fontSize:11,color:C.muted}}>{detail.id} · {fmtFull(detail.date)}</div>
              </div>
              <div>
                <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:20,fontWeight:700,color:detail.pnl>=0?C.green:C.red,textAlign:"right"}}>{fmtMoney(detail.pnl)}</div>
                <div style={{fontSize:10,color:C.muted,textAlign:"right"}}>{detail.result} · {(detail.rr||0).toFixed(2)}R</div>
              </div>
            </div>
            {[["Type",detail.type],["Strategy",detail.strategy||"—"],["Session",detail.session||"—"],["Entry",detail.entry],["Exit",detail.exit],["Lot",detail.lotSize],["Stop Loss",detail.sl||"—"],["Take Profit",detail.tp||"—"],["Risk %",`${detail.risk||0}%`],["Emotion Before",detail.emotionBefore||"—"],["Emotion After",detail.emotionAfter||"—"]].map(([k,v])=>(
              <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{color:k==="Type"?(v==="BUY"?C.green:C.red):C.text}}>{v}</span></div>
            ))}
            {detail.notes&&<div style={{padding:"12px 18px",color:C.muted,fontSize:12,lineHeight:1.7}}>📝 {detail.notes}</div>}
            {/* Edit / Delete buttons */}
            <div style={{display:"flex",gap:9,margin:"14px 18px 0"}}>
              <button onClick={()=>{setEditTrade(detail);setDetail(null);}} style={{flex:1,padding:12,borderRadius:11,border:`1px solid ${C.accent}44`,background:C.accentDim,color:C.accent,fontFamily:"'Outfit',sans-serif",fontWeight:700,cursor:"pointer",fontSize:13}}>✏️ Edit</button>
              <button onClick={()=>{setDelTrade(detail);setDetail(null);}} style={{flex:1,padding:12,borderRadius:11,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,fontFamily:"'Outfit',sans-serif",fontWeight:700,cursor:"pointer",fontSize:13}}>🗑 Delete</button>
            </div>
            <div style={{height:20}}/>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTrade&&(
        <TradeForm trade={editTrade} pairs={pairs} strategies={strategies} profile={profile}
          onSave={t=>{onEdit(t);setEditTrade(null);}}
          onClose={()=>setEditTrade(null)}/>
      )}

      {/* Delete confirm */}
      {delTrade&&(
        <div className="del-confirm">
          <div className="del-box">
            <div style={{fontSize:16,fontWeight:800,marginBottom:9}}>Delete {delTrade.pair} trade?</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:6}}>{fmtDate(delTrade.date)} · {delTrade.type} · <span style={{color:delTrade.pnl>=0?C.green:C.red}}>{fmtMoney(delTrade.pnl)}</span></div>
            <div style={{fontSize:12,color:C.muted,marginBottom:18,lineHeight:1.6}}>This action cannot be undone. The trade will be permanently removed.</div>
            <div style={{display:"flex",gap:9}}>
              <button onClick={()=>setDelTrade(null)} style={{flex:1,padding:12,borderRadius:11,border:`1px solid ${C.border}`,background:"none",color:C.text,fontFamily:"'Outfit',sans-serif",fontWeight:700,cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>{onDelete(delTrade.id);setDelTrade(null);}} style={{flex:1,padding:12,borderRadius:11,border:"none",background:C.red,color:"#fff",fontFamily:"'Outfit',sans-serif",fontWeight:800,cursor:"pointer"}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function Analytics({trades,analytics,pairs,strategies}){
  const [tab,setTab]=useState("overview");
  const [dateMode,setDateMode]=useState("ALL");
  const now=Date.now();
  const filtered=useMemo(()=>trades.filter(t=>{
    if(dateMode==="7D") return (now-new Date(t.date))<7*864e5;
    if(dateMode==="30D") return (now-new Date(t.date))<30*864e5;
    if(dateMode==="90D") return (now-new Date(t.date))<90*864e5;
    return true;
  }),[trades,dateMode]);
  const a=useMemo(()=>computeAnalytics(filtered),[filtered]);
  if(!a) return <div className="empty" style={{paddingTop:80}}><div className="ei">📊</div><div style={{fontSize:13}}>Add trades to unlock analytics</div></div>;
  const pc=sym=>pairs.find(p=>p.symbol===sym)?.color||C.accent;
  const sc=name=>strategies.find(s=>s.name===name)?.color||C.purple;
  const BP={isAnimationActive:false};

  return(
    <div className="screen">
      <div className="hdr"><div className="hdr-title">Deep <span>Analytics</span></div><span className="badge-pro">PRO</span></div>
      <div className="date-range" style={{marginTop:12}}>
        {["7D","30D","90D","ALL"].map(r=><button key={r} className={`dr-btn${dateMode===r?" act":""}`} onClick={()=>setDateMode(r)}>{r}</button>)}
      </div>
      <div className="atabs">
        {[["overview","Overview"],["pairs","Pairs"],["strats","Strategies"],["timing","Timing"],["emotions","Psychology"]].map(([id,lbl])=>(
          <button key={id} className={`atab${tab===id?" act":""}`} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>
      {tab==="overview"&&(
        <>
          <div className="mg2">
            {[
              {l:"Total P&L",v:fmtMoney(a.totalPnl),c:a.totalPnl>=0?C.green:C.red},
              {l:"Win Rate",v:`${a.winRate.toFixed(1)}%`,c:C.accent},
              {l:"Profit Factor",v:a.profitFactor.toFixed(2),c:a.profitFactor>=1.5?C.green:C.gold},
              {l:"Expectancy",v:fmtMoney(a.expectancy),c:a.expectancy>0?C.green:C.red},
              {l:"Max Drawdown",v:`${a.maxDD.toFixed(1)}%`,c:C.red},
              {l:"Avg Win",v:fmtMoney(a.avgWin),c:C.green},
              {l:"Avg Loss",v:`-$${a.avgLoss.toFixed(0)}`,c:C.red},
              {l:"Win Streak",v:`${a.winStreak}W`,c:C.gold},
            ].map((m,i)=>(
              <div key={i} className="stat"><div className="stat-label">{m.l}</div><div className="stat-val" style={{color:m.c,fontSize:15}}>{m.v}</div></div>
            ))}
          </div>
          <div className="card">
            <div style={{fontSize:13,fontWeight:800,marginBottom:8}}>Win / Loss</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <ResponsiveContainer width={110} height={110}>
                <PieChart><Pie data={[{value:a.wins},{value:a.losses}]} innerRadius={35} outerRadius={52} dataKey="value" paddingAngle={4} {...BP}>
                  <Cell fill={C.green}/><Cell fill={C.red}/>
                </Pie><Tooltip content={<CTT/>}/></PieChart>
              </ResponsiveContainer>
              <div style={{flex:1}}>
                {[{l:"Wins",v:a.wins,c:C.green},{l:"Losses",v:a.losses,c:C.red},{l:"Win Rate",v:`${a.winRate.toFixed(1)}%`,c:C.accent}].map((x,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:9}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:7,height:7,borderRadius:2,background:x.c}}/><span style={{fontSize:12,color:C.muted}}>{x.l}</span></div>
                    <span style={{fontSize:12,fontWeight:700,color:x.c,fontFamily:"monospace"}}>{x.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {a.monthlyData.length>1&&(
            <div className="card">
              <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>Monthly P&L</div>
              <div className="monthly-bar">
                {a.monthlyData.map((m,i)=>{
                  const mx=Math.max(...a.monthlyData.map(x=>Math.abs(x.pnl)),1);
                  const h=Math.max((Math.abs(m.pnl)/mx)*70,4);
                  return <div key={i} className="month-col"><div className="month-bar" style={{height:h,background:m.pnl>=0?C.green:C.red,opacity:.85}}/><div className="month-lbl">{m.month.split(" ")[0]}</div></div>;
                })}
              </div>
            </div>
          )}
        </>
      )}
      {tab==="pairs"&&(
        <>
          <div className="card">
            <div style={{fontSize:13,fontWeight:800,marginBottom:14}}>P&L by Pair</div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={a.pairData.slice(0,8)} margin={{left:-15,right:5}} {...BP}>
                <XAxis dataKey="name" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                <ReferenceLine y={0} stroke={C.dim}/>
                <Tooltip content={<CTT/>} cursor={{fill:C.dim+"30"}}/>
                <Bar dataKey="pnl" radius={[4,4,0,0]} isAnimationActive={false}>{a.pairData.slice(0,8).map((e,i)=><Cell key={i} fill={pc(e.name)}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {a.pairData.length>=2&&(
            <div className="card">
              <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>Best vs Worst</div>
              <div className="cmp">
                <div className="cmp-side" style={{background:C.accentDim,border:`1px solid ${C.accent}28`}}>
                  <div style={{fontSize:9,color:C.muted}}>BEST</div>
                  <div style={{fontSize:14,fontWeight:800,color:C.accent,marginTop:3}}>{a.pairData[0]?.name}</div>
                  <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:12,fontWeight:700,color:C.green,marginTop:2}}>{fmtMoney(a.pairData[0]?.pnl||0)}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{a.pairData[0]?.wr}% WR</div>
                </div>
                <div className="cmp-vs">VS</div>
                <div className="cmp-side" style={{background:C.redDim,border:`1px solid ${C.red}28`}}>
                  <div style={{fontSize:9,color:C.muted}}>WORST</div>
                  <div style={{fontSize:14,fontWeight:800,color:C.red,marginTop:3}}>{[...a.pairData].sort((x,y)=>x.pnl-y.pnl)[0]?.name}</div>
                  <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:12,fontWeight:700,color:C.red,marginTop:2}}>{fmtMoney([...a.pairData].sort((x,y)=>x.pnl-y.pnl)[0]?.pnl||0)}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{[...a.pairData].sort((x,y)=>x.pnl-y.pnl)[0]?.wr}% WR</div>
                </div>
              </div>
            </div>
          )}
          {a.pairData.map((p,i)=>(
            <div key={i} style={{margin:"0 14px 10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:8,height:8,borderRadius:2,background:pc(p.name)}}/><span style={{fontSize:13,fontWeight:700}}>{p.name}</span><span style={{fontSize:10,color:C.muted}}>{p.trades}T</span></div>
                <div><span style={{fontFamily:"JetBrains Mono,monospace",fontSize:12,fontWeight:700,color:p.pnl>=0?C.green:C.red}}>{fmtMoney(p.pnl)}</span><span style={{fontSize:10,color:C.muted,marginLeft:8}}>{p.wr}%</span></div>
              </div>
              <div className="pbar"><div className="pfill" style={{width:`${p.wr}%`,background:p.wr>=55?C.green:p.wr>=45?C.gold:C.red}}/></div>
            </div>
          ))}
        </>
      )}
      {tab==="strats"&&(
        <>
          <div className="card">
            <div style={{fontSize:13,fontWeight:800,marginBottom:14}}>P&L by Strategy</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={a.stratData} margin={{left:-15,right:5}} {...BP}>
                <XAxis dataKey="name" tick={{fontSize:8,fill:C.muted}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                <ReferenceLine y={0} stroke={C.dim}/>
                <Tooltip content={<CTT/>} cursor={{fill:C.dim+"30"}}/>
                <Bar dataKey="pnl" radius={[4,4,0,0]} isAnimationActive={false}>{a.stratData.map((e,i)=><Cell key={i} fill={sc(e.name)}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {a.stratData.map((s,i)=>{
            const obj=strategies.find(x=>x.name===s.name);
            const t=obj?.winTarget||55;
            return(
              <div key={i} className="card" style={{padding:"13px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
                  <div style={{width:34,height:34,borderRadius:8,background:sc(s.name)+"18",border:`1px solid ${sc(s.name)}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{obj?.icon||"📊"}</div>
                  <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13}}>{s.name}</div><div style={{fontSize:10,color:C.muted}}>{s.trades} trades · Avg RR {s.avgRR}R</div></div>
                  <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:14,fontWeight:700,color:s.pnl>=0?C.green:C.red}}>{fmtMoney(s.pnl)}</div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:C.muted}}>WR vs Target</span>
                  <span style={{fontSize:11,fontFamily:"monospace",color:s.wr>=t?C.green:C.red}}>{s.wr}% / {t}%</span>
                </div>
                <div className="pbar"><div className="pfill" style={{width:`${Math.min(s.wr,100)}%`,background:s.wr>=t?C.green:C.red}}/></div>
              </div>
            );
          })}
        </>
      )}
      {tab==="timing"&&(
        <>
          <div className="sec">SESSION PERFORMANCE</div>
          {a.sessionData.length>=2&&(
            <div className="card">
              <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>Best vs Worst Session</div>
              <div className="cmp">
                <div className="cmp-side" style={{background:C.accentDim,border:`1px solid ${C.accent}28`}}>
                  <div style={{fontSize:9,color:C.muted}}>BEST</div>
                  <div style={{fontSize:12,fontWeight:800,color:C.accent,marginTop:2}}>{a.sessionData[0]?.name.split("/")[0]}</div>
                  <div style={{fontSize:11,fontWeight:700,color:C.green,marginTop:2}}>{a.sessionData[0]?.wr}% WR</div>
                </div>
                <div className="cmp-vs">VS</div>
                <div className="cmp-side" style={{background:C.redDim,border:`1px solid ${C.red}28`}}>
                  <div style={{fontSize:9,color:C.muted}}>WORST</div>
                  <div style={{fontSize:12,fontWeight:800,color:C.red,marginTop:2}}>{[...a.sessionData].sort((x,y)=>x.wr-y.wr)[0]?.name.split("/")[0]}</div>
                  <div style={{fontSize:11,fontWeight:700,color:C.red,marginTop:2}}>{[...a.sessionData].sort((x,y)=>x.wr-y.wr)[0]?.wr}% WR</div>
                </div>
              </div>
            </div>
          )}
          {a.sessionData.map((s,i)=>(
            <div key={i} style={{margin:"0 14px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,fontWeight:700}}>{s.name}</span><div><span style={{fontSize:11,color:C.muted}}>{s.trades}T</span><span style={{fontFamily:"JetBrains Mono,monospace",fontSize:12,fontWeight:700,color:s.pnl>=0?C.green:C.red,marginLeft:10}}>{fmtMoney(s.pnl)}</span></div></div>
              <div className="pbar" style={{height:6}}><div className="pfill" style={{width:`${s.wr}%`,background:s.wr>=55?C.green:s.wr>=45?C.gold:C.red,height:6}}/></div>
              <div style={{fontSize:10,color:C.muted,marginTop:4}}>{s.wr}% win rate</div>
            </div>
          ))}
          <div className="sec">BY DAY OF WEEK</div>
          <div className="card">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={a.dayData} margin={{left:-15,right:5}} {...BP}>
                <XAxis dataKey="name" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                <ReferenceLine y={0} stroke={C.dim}/>
                <Tooltip content={<CTT/>} cursor={{fill:C.dim+"30"}}/>
                <Bar dataKey="pnl" radius={[4,4,0,0]} isAnimationActive={false}>{a.dayData.map((e,i)=><Cell key={i} fill={e.pnl>=0?C.accent:C.red}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      {tab==="emotions"&&(
        <>
          <div className="card">
            <div style={{fontSize:13,fontWeight:800,marginBottom:14}}>Win Rate by Emotion</div>
            {a.emotionData.map((e,i)=>{
              const isBad=["FOMO","Revenge","Greedy","Anxious"].includes(e.emotion);
              const isGood=["Confident","Calm","Patient"].includes(e.emotion);
              return(
                <div key={i} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:12}}>{isGood?"😊":isBad?"😤":"😐"}</span><span style={{fontSize:12,fontWeight:700}}>{e.emotion}</span>{isBad&&<span style={{fontSize:9,color:C.red,background:C.redDim,padding:"1px 6px",borderRadius:4}}>RISK</span>}</div>
                    <div style={{display:"flex",gap:8}}><span style={{fontSize:10,color:C.muted}}>{e.trades}T</span><span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:e.wr>=60?C.green:e.wr>=45?C.gold:C.red}}>{e.wr}%</span></div>
                  </div>
                  <div className="pbar" style={{height:5}}><div className="pfill" style={{width:`${e.wr}%`,background:e.wr>=60?C.green:e.wr>=45?C.gold:C.red,height:5}}/></div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── INSIGHTS ─────────────────────────────────────────────────────────────────
function generateInsights(trades,analytics,pairs,strategies){
  if(!trades.length||!analytics) return [];
  const out=[];
  if(analytics.pairData.length>1){const b=analytics.pairData[0];out.push({priority:1,type:"success",icon:"🎯",category:"Pair Edge",title:`${b.name} is your highest-alpha pair`,text:`${fmtMoney(b.pnl)} P&L with ${b.wr}% WR over ${b.trades} trades. Prioritise this pair.`});}
  const ws=[...analytics.sessionData].sort((a,b)=>a.wr-b.wr)[0];
  if(ws&&ws.wr<45) out.push({priority:2,type:"danger",icon:"🕐",category:"Session Risk",title:`Avoid the ${ws.name} session`,text:`Only ${ws.wr}% WR during ${ws.name}. Focus on ${analytics.sessionData[0]?.name} where you have ${analytics.sessionData[0]?.wr}% WR.`});
  const bad=analytics.emotionData.filter(e=>["FOMO","Revenge","Greedy"].includes(e.emotion));
  const good=analytics.emotionData.filter(e=>["Confident","Calm","Patient"].includes(e.emotion));
  if(bad.length&&good.length){const bA=bad.reduce((s,e)=>s+e.wr,0)/bad.length;const gA=good.reduce((s,e)=>s+e.wr,0)/good.length;if(gA-bA>10) out.push({priority:1,type:"danger",icon:"🧠",category:"Psychology",title:`Emotional trades cost ${(gA-bA).toFixed(0)}% win rate`,text:`Calm/Patient: ${gA.toFixed(0)}% WR. FOMO/Revenge: ${bA.toFixed(0)}% WR. Fix this first.`});}
  if(analytics.trendWR>5) out.push({priority:2,type:"success",icon:"📈",category:"Momentum",title:"Performance trending up",text:`Win rate improved ${analytics.trendWR.toFixed(0)}% in last 10 trades. Keep your process.`});
  else if(analytics.trendWR<-10) out.push({priority:1,type:"warning",icon:"📉",category:"Slump",title:"Performance declining",text:`Win rate dropped ${Math.abs(analytics.trendWR).toFixed(0)}% in recent trades. Review your last 10 losses before trading again.`});
  if(analytics.profitFactor<1.2) out.push({priority:1,type:"danger",icon:"💹",category:"Risk",title:"Profit factor critically low",text:`At ${analytics.profitFactor.toFixed(2)}, losses outpace wins. Cut losses faster.`});
  if(analytics.currentStreak>=3) out.push({priority:2,type:"success",icon:"🔥",category:"Streak",title:`${analytics.currentStreak}-win streak — stay disciplined`,text:"Maintain standard lot sizes. Overconfidence after streaks is a top account killer."});
  const sorted=[...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let rev=0; for(let i=1;i<sorted.length;i++) if(sorted[i-1].result==="LOSS"&&sorted[i].emotionBefore==="Revenge") rev++;
  if(rev>=2) out.push({priority:1,type:"danger",icon:"😤",category:"Revenge",title:`${rev} revenge trades detected`,text:"30-minute break after every loss. Revenge trading has a statistically negative edge."});
  return out.sort((a,b)=>a.priority-b.priority);
}

function Insights({trades,analytics,insights,profile}){
  const cm={success:C.accent,warning:C.gold,danger:C.red,info:C.blue};
  const ds=analytics?.discipline||{total:0,emotional:0,consistency:0,risk:0};
  const todayT=trades.filter(t=>new Date(t.date).toDateString()===new Date().toDateString());
  return(
    <div className="screen">
      <div className="hdr"><div className="hdr-title">AI <span>Coaching</span></div><span className="badge-pro">PRO</span></div>
      <div className="card" style={{marginTop:12}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <ScoreRing score={ds.total} size={82}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:3}}>Discipline Score</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:10,lineHeight:1.5}}>{ds.total>=75?"Strong. Maintain your process.":`${ds.total}/100 — areas to improve:`}</div>
            {[["Emotional",ds.emotional,C.green],["Consistency",ds.consistency,C.blue],["Risk Adherence",ds.risk,C.gold]].map(([l,v,c],i)=>(
              <div key={i} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:C.muted}}>{l}</span><span style={{fontSize:11,fontWeight:700,fontFamily:"monospace",color:c}}>{v}</span></div>
                <div className="pbar"><div className="pfill" style={{width:`${v}%`,background:c}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {(analytics?.currentStreak||0)>=3&&(
        <div style={{margin:"0 14px 10px",background:`linear-gradient(135deg,${C.gold}12,#FF6B3508)`,border:`1px solid ${C.gold}33`,borderRadius:14,padding:"13px 15px",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>🔥</span>
          <div><div style={{fontWeight:800,fontSize:14}}>{analytics.currentStreak}-Trade Win Streak</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Best: {analytics.winStreak}. Stay disciplined.</div></div>
          <div style={{marginLeft:"auto",fontFamily:"JetBrains Mono,monospace",fontSize:22,fontWeight:700,color:C.gold}}>{analytics.currentStreak}</div>
        </div>
      )}
      <div className="sec">DAILY TARGETS</div>
      <div className="card">
        {[
          {l:"Trades Today",lim:parseInt(profile?.dailyTradeLimit||5),used:todayT.length,c:C.accent},
          {l:"Risk Today",lim:parseFloat(profile?.dailyRiskLimit||3),used:todayT.reduce((s,t)=>s+parseFloat(t.risk||0),0),u:"%",c:C.gold},
          {l:"Profit Target",lim:parseFloat(profile?.dailyProfitTarget||200),used:Math.max(0,todayT.reduce((s,t)=>s+t.pnl,0)),u:"$",c:C.green},
        ].map((g,i)=>{
          const pct=Math.min((g.used/Math.max(g.lim,.001))*100,100); const over=g.used>g.lim;
          return(
            <div key={i} style={{marginBottom:i<2?14:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12}}>{g.l}</span><span style={{fontSize:12,fontFamily:"monospace",color:over?C.red:C.muted}}>{g.u||""}{typeof g.used==="number"?g.used.toFixed(g.u==="%"?1:0):g.used}/{g.u||""}{g.lim}{over?" ⚠️":""}</span></div>
              <div className="pbar"><div className="pfill" style={{width:`${pct}%`,background:over?C.red:g.c}}/></div>
            </div>
          );
        })}
      </div>
      <div className="sec">14-DAY ACTIVITY</div>
      <div className="card">
        <div className="weekly-grid">
          {DAYS_OF_WEEK.map(d=><div key={d} style={{fontSize:8,color:C.muted,textAlign:"center",paddingBottom:3}}>{d[0]}</div>)}
          {Array.from({length:14},(_,i)=>{
            const date=new Date(Date.now()-(13-i)*864e5);
            const dt=trades.filter(t=>new Date(t.date).toDateString()===date.toDateString());
            const bg=!dt.length?C.dim:dt.every(t=>t.result==="WIN")?C.accent:dt.every(t=>t.result==="LOSS")?C.red:C.gold;
            return <div key={i} className="wday" style={{background:bg,opacity:dt.length?1:.3}}/>;
          })}
        </div>
        <div style={{display:"flex",gap:10,marginTop:10}}>
          {[[C.accent,"Win"],[C.red,"Loss"],[C.gold,"Mixed"],[C.dim,"None"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:9,height:9,borderRadius:2,background:c}}/><span style={{fontSize:9,color:C.muted}}>{l}</span></div>
          ))}
        </div>
      </div>
      <div className="sec">COACHING INSIGHTS ({insights.length})</div>
      {!insights.length&&<div style={{margin:"0 14px 10px",padding:"18px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:14,textAlign:"center",color:C.muted,fontSize:12}}>Add more trades for personalised coaching.</div>}
      {insights.map((ins,i)=>(
        <div key={i} className={`ic i${ins.type}`}>
          <div className="ih"><span style={{fontSize:15}}>{ins.icon}</span><span className="it" style={{color:cm[ins.type]}}>{ins.title}</span><span style={{marginLeft:"auto",fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.5}}>{ins.category}</span></div>
          <div className="ix">{ins.text}</div>
        </div>
      ))}
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
const ACHS=[
  {id:"first_trade",icon:"🎯",name:"First Trade",desc:"Logged your first trade",check:t=>t.length>=1},
  {id:"ten_trades",icon:"📊",name:"10 Trades",desc:"Logged 10 trades",check:t=>t.length>=10},
  {id:"fifty_trades",icon:"📈",name:"50 Trades",desc:"Logged 50 trades",check:t=>t.length>=50},
  {id:"win5",icon:"🔥",name:"5-Win Streak",desc:"5 consecutive wins",check:t=>calcWinStreak(t)>=5},
  {id:"win10",icon:"⚡",name:"10-Win Streak",desc:"10 consecutive wins",check:t=>calcWinStreak(t)>=10},
  {id:"profit1k",icon:"💰",name:"$1K Profit",desc:"Earned $1,000 total P&L",check:t=>t.reduce((s,x)=>s+x.pnl,0)>=1000},
  {id:"disciplined",icon:"🧘",name:"Disciplined",desc:"≥60% WR with 20+ trades",check:t=>t.length>=20&&t.filter(x=>x.result==="WIN").length/t.length>=0.6},
  {id:"risk_master",icon:"🛡️",name:"Risk Master",desc:"Profit factor above 2.0",check:t=>calcPF(t)>=2.0},
];

function Profile({trades,analytics,isPro,setIsPro,pairs,strategies,profile,setProfile,showToast,accounts,currentAccId}){
  const [editing,setEditing]=useState(false);
  const [pf,setPf]=useState(null);
  const unlocked=ACHS.filter(a=>a.check(trades));
  const locked=ACHS.filter(a=>!a.check(trades));
  const bestPair=useMemo(()=>{const m={};trades.forEach(t=>{if(!m[t.pair])m[t.pair]=0;m[t.pair]+=t.pnl;});return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]?.[0]||"–";},[trades]);
  const monthTrades=trades.filter(t=>new Date(t.date).getMonth()===new Date().getMonth());
  const monthPnl=monthTrades.reduce((s,t)=>s+t.pnl,0);
  const currentAcc=accounts?.find(a=>a.id===currentAccId);

  return(
    <div className="screen">
      <div className="hdr"><div className="hdr-title">My <span>Profile</span></div><button onClick={()=>{setPf({...profile});setEditing(true);}} style={{background:C.s2,border:`1px solid ${C.border}`,color:C.muted,padding:"6px 12px",borderRadius:9,fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Edit</button></div>
      <div className="card" style={{marginTop:14,display:"flex",gap:13,alignItems:"center"}}>
        <div className="avatar">{(profile.name||"T")[0].toUpperCase()}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:18}}>{profile.name||"Trader"}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{profile.style||"Day Trader"} · {profile.experience||"Intermediate"}</div>
          {currentAcc&&<div style={{fontSize:11,color:C.accent,marginTop:3}}>📊 {currentAcc.name}</div>}
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            <span className={isPro?"badge-pro":"chip"}>{isPro?"PRO MEMBER":"FREE PLAN"}</span>
            {(analytics?.currentStreak||0)>=3&&<span className="chip active">🔥 {analytics.currentStreak}-streak</span>}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:18,fontWeight:700,color:(analytics?.totalPnl||0)>=0?C.green:C.red}}>{fmtMoney(analytics?.totalPnl||0)}</div>
          <div style={{fontSize:10,color:C.muted}}>Total P&L</div>
        </div>
      </div>
      <div className="sec">PERFORMANCE</div>
      <div className="mg2">
        {[
          {l:"Win Rate",v:`${analytics?.winRate.toFixed(0)||0}%`,c:C.accent,sub:`${analytics?.wins||0}W / ${analytics?.losses||0}L`},
          {l:"This Month",v:fmtMoney(monthPnl),c:monthPnl>=0?C.green:C.red,sub:`${monthTrades.length} trades`},
          {l:"Best Pair",v:bestPair,c:pairs.find(p=>p.symbol===bestPair)?.color||C.blue,sub:"by P&L"},
          {l:"Discipline",v:`${analytics?.discipline.total||0}`,c:analytics?.discipline.total>=70?C.green:analytics?.discipline.total>=50?C.gold:C.red,sub:"/100 score"},
        ].map((m,i)=>(
          <div key={i} className="stat"><div className="stat-label">{m.l}</div><div className="stat-val" style={{color:m.c,fontSize:15}}>{m.v}</div>{m.sub&&<div className="stat-sub">{m.sub}</div>}</div>
        ))}
      </div>
      <div className="sec">EXPORT REPORTS</div>
      <div className="export-row">
        <button className="exp-btn" onClick={()=>{exportPDF(trades,analytics,"daily",profile,currentAcc?.name);showToast("📄 Report opened — tap Print/Share to save PDF");}}>📅 Daily</button>
        <button className="exp-btn" onClick={()=>{exportPDF(trades,analytics,"monthly",profile,currentAcc?.name);showToast("📄 Report opened — tap Print/Share to save PDF");}}>📆 Monthly</button>
        <button className="exp-btn" onClick={()=>{exportPDF(trades,analytics,"all",profile,currentAcc?.name);showToast("📄 Report opened — tap Print/Share to save PDF");}}>📋 All</button>
      </div>
      <div style={{margin:"0 14px 10px",background:C.blueDim,border:`1px solid ${C.blue}28`,borderRadius:10,padding:"10px 12px",fontSize:11,color:C.muted,lineHeight:1.6}}>
        💡 A new tab will open with your report. Tap <b style={{color:C.text}}>🖨 Download PDF</b> at the top, then use your browser's <b style={{color:C.text}}>Share → Print → Save as PDF</b>.
      </div>
      <div className="sec">ACHIEVEMENTS ({unlocked.length}/{ACHS.length})</div>
      <div className="ach-grid">
        {[...unlocked,...locked].map(a=>(
          <div key={a.id} className={`ach ${unlocked.includes(a)?"unlocked":"locked"}`}>
            <div className="ach-icon">{a.icon}</div>
            <div className="ach-name">{a.name}</div>
            <div className="ach-desc">{a.desc}</div>
          </div>
        ))}
      </div>
      <div className="sec">SUBSCRIPTION</div>
      <div className="plan-card plan-free">
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontWeight:800,fontSize:14}}>Free Plan</div>{!isPro&&<span style={{fontSize:11,color:C.accent}}>ACTIVE</span>}</div>
        {[`20 trades/month`,`Max ${FREE_PAIR_LIMIT} pairs & ${FREE_STRAT_LIMIT} strategies`,"Basic analytics"].map((f,i)=><div key={i} style={{fontSize:12,color:C.muted,marginBottom:3}}>· {f}</div>)}
        <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:20,fontWeight:700,marginTop:10}}>$0 <span style={{fontSize:11,color:C.muted}}>/mo</span></div>
      </div>
      <div className="plan-card plan-pro" style={{borderColor:isPro?C.gold:`${C.gold}35`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontWeight:800,fontSize:14}}>Pro Plan</div>{isPro?<span style={{fontSize:11,color:C.gold}}>ACTIVE</span>:<span className="badge-pro">BEST</span>}</div>
        {["Unlimited trades, pairs & strategies","AI Coaching Engine","Deep multi-period analytics","PDF export reports","Multi-account management"].map((f,i)=><div key={i} style={{fontSize:12,color:C.text,marginBottom:3}}>· {f}</div>)}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
          <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:20,fontWeight:700,color:C.gold}}>$19 <span style={{fontSize:11,color:C.muted}}>/mo</span></div>
          {!isPro&&<button onClick={()=>{setIsPro(true);showToast("Welcome to Pro! 🚀");}} style={{background:`linear-gradient(135deg,${C.gold},#E55A00)`,border:"none",borderRadius:10,padding:"10px 18px",color:"#000",fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:13,cursor:"pointer"}}>Upgrade →</button>}
        </div>
      </div>
      <div style={{height:20}}/>

      {editing&&pf&&(
        <div className="ov">
          <div className="sh">
            <div className="hdl"/>
            <div className="sht"><span>Edit Profile</span><button className="xbtn" onClick={()=>setEditing(false)}>×</button></div>
            <div className="fg"><label>Display Name</label><input className="fi" value={pf.name||""} onChange={e=>setPf(p=>({...p,name:e.target.value}))} placeholder="Your name"/></div>
            <div className="fg"><label>Trading Style</label><select className="fi fsel" value={pf.style||TRADER_STYLES[1]} onChange={e=>setPf(p=>({...p,style:e.target.value}))} style={{background:C.s2,color:C.text}}>{TRADER_STYLES.map(s=><option key={s}>{s}</option>)}</select></div>
            <div className="fg"><label>Experience</label><select className="fi fsel" value={pf.experience||EXPERIENCE[1]} onChange={e=>setPf(p=>({...p,experience:e.target.value}))} style={{background:C.s2,color:C.text}}>{EXPERIENCE.map(e=><option key={e}>{e}</option>)}</select></div>
            <div className="fg"><label>Preferred Session</label><select className="fi fsel" value={pf.session||"London"} onChange={e=>setPf(p=>({...p,session:e.target.value}))} style={{background:C.s2,color:C.text}}>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></div>
            <div className="fr">
              <div><label>Default Risk %</label><input className="fi" type="number" step="0.1" min="0" max="10" value={pf.defaultRisk||"1"} onChange={e=>setPf(p=>({...p,defaultRisk:e.target.value}))} inputMode="decimal"/></div>
              <div><label>Daily Trade Limit</label><input className="fi" type="number" min="1" max="50" value={pf.dailyTradeLimit||"5"} onChange={e=>setPf(p=>({...p,dailyTradeLimit:e.target.value}))} inputMode="numeric"/></div>
            </div>
            <div className="fr">
              <div><label>Daily Risk Limit %</label><input className="fi" type="number" step="0.1" min="0" value={pf.dailyRiskLimit||"3"} onChange={e=>setPf(p=>({...p,dailyRiskLimit:e.target.value}))} inputMode="decimal"/></div>
              <div><label>Daily Profit Target $</label><input className="fi" type="number" min="0" value={pf.dailyProfitTarget||"200"} onChange={e=>setPf(p=>({...p,dailyProfitTarget:e.target.value}))} inputMode="decimal"/></div>
            </div>
            <button className="sbtn" onClick={()=>{setProfile({...pf});setEditing(false);showToast("Profile saved ✓");}}>SAVE PROFILE ✓</button>
            <button className="cbtn" onClick={()=>setEditing(false)}>Cancel</button>
            <div style={{height:8}}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
const DEFAULT_PAIRS=[
  {id:"p1",symbol:"EURUSD",category:"Forex Major",pip:0.0001,color:"#3D9EFF",icon:"🇪🇺",active:true,notes:""},
  {id:"p2",symbol:"GBPUSD",category:"Forex Major",pip:0.0001,color:"#9B7FF0",icon:"🇬🇧",active:true,notes:""},
  {id:"p3",symbol:"USDJPY",category:"Forex Major",pip:0.01,color:"#FF6B35",icon:"🇯🇵",active:true,notes:""},
  {id:"p4",symbol:"XAUUSD",category:"Commodity",pip:0.01,color:"#F0A500",icon:"🥇",active:true,notes:""},
  {id:"p5",symbol:"BTCUSD",category:"Crypto",pip:1,color:"#FF9500",icon:"₿",active:true,notes:""},
];
const DEFAULT_STRATEGIES=[
  {id:"s1",name:"ICT Concepts",category:"Smart Money",color:"#3D9EFF",icon:"🧠",timeframes:["15m","1H","4H"],description:"Order blocks, FVGs, liquidity sweeps.",rules:"1. HTF bias\n2. Draw on liquidity\n3. CISD LTF\n4. FVG entry",winTarget:65,rrTarget:2.5,active:true,notes:""},
  {id:"s2",name:"Price Action",category:"Technical",color:"#00C896",icon:"📊",timeframes:["1H","4H"],description:"Pure candlestick patterns & S/R.",rules:"1. Key S/R\n2. Rejection candle\n3. Volume confirm\n4. SL below structure",winTarget:55,rrTarget:1.8,active:true,notes:""},
  {id:"s3",name:"Supply & Demand",category:"Smart Money",color:"#FF6B35",icon:"🎯",timeframes:["1H","4H","D"],description:"Institutional S/D zones.",rules:"1. Fresh zone\n2. First touch\n3. LTF confirm\n4. TP opposing zone",winTarget:60,rrTarget:2.2,active:true,notes:""},
];

export default function AGIS(){
  const saved=useMemo(()=>load(),[]);

  // Auth state
  const [user,setUser]=useState(saved?.user||null);

  // Accounts: each user gets their own accounts array
  const [accounts,setAccounts]=useState(()=>{
    if(saved?.accounts) return saved.accounts;
    const defaultAcc={id:"acc_default",name:"Main Account",balance:"10000",leverage:"1:100",broker:"",trades:[]};
    return [defaultAcc];
  });
  const [currentAccId,setCurrentAccId]=useState(saved?.currentAccId||accounts[0]?.id);
  const [showAddAcc,setShowAddAcc]=useState(false);

  // Per-account data
  const currentAcc=useMemo(()=>accounts.find(a=>a.id===currentAccId)||accounts[0],[accounts,currentAccId]);
  const trades=currentAcc?.trades||[];

  // Shared library (across accounts, per user)
  const [pairs,setPairs]=useState(saved?.pairs||DEFAULT_PAIRS);
  const [strategies,setStrategies]=useState(saved?.strategies||DEFAULT_STRATEGIES);
  const [isPro,setIsPro]=useState(saved?.isPro||false);
  const [profile,setProfile]=useState(saved?.profile||{name:"Trader",style:"Day Trader",experience:"Intermediate",defaultRisk:"1",session:"London",dailyTradeLimit:"5",dailyRiskLimit:"3",dailyProfitTarget:"200"});

  const [screen,setScreen]=useState("dashboard");
  const [showAdd,setShowAdd]=useState(false);
  const [toast,setToast]=useState(null);

  // Persist everything
  useEffect(()=>{
    save({user,accounts,currentAccId,pairs,strategies,isPro,profile});
  },[user,accounts,currentAccId,pairs,strategies,isPro,profile]);

  const showToast=useCallback((msg)=>{setToast(msg);setTimeout(()=>setToast(null),2800);},[]);

  // Trade operations — update inside correct account
  const setTrades=useCallback(fn=>{
    setAccounts(prev=>prev.map(a=>a.id===currentAccId?{...a,trades:typeof fn==="function"?fn(a.trades||[]):fn}:a));
  },[currentAccId]);

  const handleAddTrade=useCallback(t=>{setTrades(p=>[t,...p]);showToast("Trade logged ⚡");},[setTrades,showToast]);
  const handleEditTrade=useCallback(t=>{setTrades(p=>p.map(x=>x.id===t.id?t:x));showToast("Trade updated ✓");},[setTrades,showToast]);
  const handleDeleteTrade=useCallback(id=>{setTrades(p=>p.filter(x=>x.id!==id));showToast("Trade deleted");},[setTrades,showToast]);

  const analytics=useMemo(()=>computeAnalytics(trades),[trades]);
  const insights=useMemo(()=>generateInsights(trades,analytics,pairs,strategies),[trades,analytics,pairs,strategies]);

  const handleLogin=user=>{setUser(user);showToast(`Welcome back, ${user.name}! 👋`);};
  const handleLogout=()=>{setUser(null);setScreen("dashboard");};
  const handleUpgrade=()=>{setIsPro(true);showToast("Welcome to Pro! 🚀");setScreen("profile");};

  const handleAddAccount=acc=>{
    setAccounts(prev=>[...prev,acc]);
    setCurrentAccId(acc.id);
    setShowAddAcc(false);
    setScreen("dashboard");
    showToast(`${acc.name} created ✦`);
  };

  // Show login if no user
  if(!user){
    return(
      <>
        <style>{css}</style>
        <div style={{maxWidth:430,margin:"0 auto",height:"100vh",background:C.bg,overflow:"hidden"}}>
          <LoginScreen onLogin={handleLogin}/>
        </div>
      </>
    );
  }

  const NAV=[
    {id:"dashboard",icon:"◈",label:"Home"},
    {id:"history",  icon:"≡",label:"Journal"},
    {id:"analytics",icon:"◎",label:"Analytics"},
    {id:"library",  icon:"⊞",label:"Library"},
    {id:"insights", icon:"✦",label:"Coach"},
    {id:"accounts", icon:"◉",label:"Accounts"},
    {id:"profile",  icon:"○",label:"Profile"},
  ];

  return(
    <>
      <style>{css}</style>
      <div className="app">
        {/* Active account banner */}
        {currentAcc&&screen==="dashboard"&&(
          <div className="acc-switcher" style={{marginTop:8}} onClick={()=>setScreen("accounts")}>
            <div>
              <div style={{fontSize:11,color:C.muted}}>ACTIVE ACCOUNT</div>
              <div style={{fontWeight:800,fontSize:14}}>{currentAcc.name}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,color:C.muted,fontSize:12}}>
              <span>{accounts.length} accounts</span>
              <span>›</span>
            </div>
          </div>
        )}

        {screen==="dashboard" && <Dashboard trades={trades} analytics={analytics} insights={insights} setScreen={setScreen}/>}
        {screen==="history"   && <History   trades={trades} pairs={pairs} strategies={strategies} onEdit={handleEditTrade} onDelete={handleDeleteTrade} profile={profile}/>}
        {screen==="analytics" && <Analytics trades={trades} analytics={analytics} pairs={pairs} strategies={strategies}/>}
        {screen==="library"   && <Library   pairs={pairs} strategies={strategies} onPairs={setPairs} onStrats={setStrategies} showToast={showToast} isPro={isPro} onUpgrade={handleUpgrade}/>}
        {screen==="insights"  && <Insights  trades={trades} analytics={analytics} insights={insights} profile={profile}/>}
        {screen==="accounts"  && <AccountSwitcher accounts={accounts} currentAccId={currentAccId} onSwitch={setCurrentAccId} onAdd={()=>setShowAddAcc(true)} setScreen={setScreen}/>}
        {screen==="profile"   && <Profile   trades={trades} analytics={analytics} isPro={isPro} setIsPro={setIsPro} pairs={pairs} strategies={strategies} profile={profile} setProfile={setProfile} showToast={showToast} accounts={accounts} currentAccId={currentAccId}/>}

        <button className="fab" onClick={()=>setShowAdd(true)}>+</button>

        <nav className="nav">
          {NAV.map(item=>(
            <div key={item.id} className={`ni${screen===item.id?" act":""}`} onClick={()=>setScreen(item.id)}>
              <span className="nic">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        {showAdd&&<TradeForm pairs={pairs} strategies={strategies} onSave={t=>{handleAddTrade(t);setShowAdd(false);}} onClose={()=>setShowAdd(false)} profile={profile}/>}
        {showAddAcc&&<AddAccountModal onSave={handleAddAccount} onClose={()=>setShowAddAcc(false)}/>}
        {toast&&<div className="toast">{toast}</div>}
      </div>
    </>
  );
}
