import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { supabase } from "./supabase";
import Drowsiness from "./Drowsiness";

// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL HELPERS — UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const now = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const destination = [18.5310, 73.8440];

function beep(ctx) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES (injected via <style> tag)
// ─────────────────────────────────────────────────────────────────────────────
const APP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');

*  { box-sizing: border-box; }

:root {
  --color-green:      #00ff88;
  --color-green-glow: rgba(0,255,136,0.5);
  --color-red-bright: #ff4444;
  --color-blue:       #4488ff;
  --color-yellow:     #ffcc00;
  --color-text-main:  #c8e6c9;
  --color-text-dim:   #4a7a55;
  --bg-panel:         rgba(6,15,9,0.88);
  --font-primary:     'Rajdhani', sans-serif;
  --font-display:     'Orbitron', monospace;
  --font-mono:        'Share Tech Mono', monospace;
}

body {
  margin: 0;
  background: #010a05;
  font-family: var(--font-primary);
  color: var(--color-text-main);
}

::-webkit-scrollbar            { width: 4px; height: 4px; }
::-webkit-scrollbar-track      { background: rgba(0,0,0,0.3); }
::-webkit-scrollbar-thumb      { background: rgba(0,255,136,0.2); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover{ background: rgba(0,255,136,0.4); }

/* Glass */
.glass-panel {
  background: var(--bg-panel);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 16px;
}

/* Cyber buttons */
.cyber-btn {
  position: relative; overflow: hidden;
  transition: all 0.3s ease !important;
  font-family: var(--font-display) !important;
  letter-spacing: 1.5px !important;
}
.cyber-btn::before {
  content: '';
  position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
  transition: left 0.5s ease;
}
.cyber-btn:hover::before { left: 100%; }
.cyber-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.15); }
.cyber-btn:active:not(:disabled) { transform: translateY(0); }

/* Map */
.map-tiles-dark { filter: invert(1) hue-rotate(180deg) saturate(0.4) brightness(0.8); }

/* Keyframes */
@keyframes fadeIn       { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideInRight { from{opacity:0;transform:translateX(30px)} to{opacity:1;transform:translateX(0)} }
@keyframes pulse        { 0%,100%{opacity:1;box-shadow:none} 50%{opacity:0.85;box-shadow:0 0 22px rgba(255,50,50,0.45)} }
@keyframes blink        { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes radarPing    { 0%{transform:scale(0.5);opacity:0.8} 100%{transform:scale(2);opacity:0} }
@keyframes radarSweep   { 0%{left:-50%} 100%{left:150%} }
@keyframes flashNeon    { 0%,100%{filter:drop-shadow(0 0 8px red)} 50%{filter:drop-shadow(0 0 22px red) drop-shadow(0 0 44px red)} }
@keyframes scanAcross   { 0%{transform:translateX(-100vw)} 100%{transform:translateX(100vw)} }
@keyframes cardIn       { from{opacity:0;transform:scale(0.98) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
@keyframes ekg          { 0%{stroke-dashoffset:600} 100%{stroke-dashoffset:0} }
@keyframes drown-pulse  { 0%,100%{box-shadow:0 0 18px rgba(255,0,0,0.18)} 50%{box-shadow:0 0 36px rgba(255,0,0,0.48)} }
@keyframes shimmerLeft  { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }

/* Titles in cards */
.safe-card-title {
  font-family: var(--font-display) !important;
  font-size: 10px !important;
  letter-spacing: 2.5px !important;
  color: var(--color-text-dim) !important;
  text-transform: uppercase !important;
  margin-bottom: 16px !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}

/* System status bar */
.sys-bar { display:flex; align-items:center; gap:6px; padding:4px 10px; background:rgba(0,0,0,0.35); border-radius:6px; border:1px solid rgba(0,255,136,0.07); }
.sys-item { display:flex; align-items:center; gap:4px; font-family:var(--font-mono); font-size:8px; letter-spacing:1.2px; color:rgba(0,255,136,0.45); }
.sys-divider { width:1px; height:10px; background:rgba(0,255,136,0.1); }
.sys-dot  { width:5px; height:5px; border-radius:50%; background:#00ff88; box-shadow:0 0 6px #00ff88; }
.sys-dot.warn   { background:#ffcc00; box-shadow:0 0 6px #ffcc00; }
.sys-dot.danger { background:#ff4444; box-shadow:0 0 6px #ff4444; animation:blink 0.8s ease infinite; }

/* Drowsiness status card */
.drw-mini-card {
  background: var(--bg-panel);
  border: 1px solid rgba(0,255,136,0.1);
  border-radius: 18px; padding: 18px 20px;
  transition: all 0.4s ease; position: relative; overflow: hidden;
  animation: cardIn 0.5s ease;
}
.drw-mini-card.drowsy {
  border-color: rgba(255,50,50,0.45);
  box-shadow: 0 0 28px rgba(255,0,0,0.14);
  animation: drown-pulse 0.9s ease infinite;
}
.drw-mini-card::before {
  content: ''; position:absolute; top:0; left:-100%; width:60%; height:100%;
  background: linear-gradient(90deg, transparent, rgba(0,255,136,0.04), transparent);
  animation: shimmerLeft 5s linear infinite;
}

/* Heartbeat / EKG */
.ekg-wrap { position:relative; height:38px; overflow:hidden; }
.ekg-line { overflow:visible; }
.ekg-path {
  fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 600; stroke-dashoffset: 600;
  animation: ekg 2.5s ease forwards infinite;
}

/* Right sidebar panel */
.sidebar-panel {
  display: flex; flex-direction: column;
  background: rgba(1,10,5,0.95);
  border-left: 1px solid rgba(0,255,136,0.1);
}
.sidebar-header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(0,255,136,0.08);
  background: rgba(0,0,0,0.3);
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-display); font-size: 8px;
  letter-spacing: 3px; color: rgba(0,255,136,0.5);
  text-transform: uppercase; flex-shrink: 0;
}

/* Active section glow on cards */
.card-active-glow {
  animation: cardIn 0.4s ease;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL-ONLY SUB-COMPONENTS (no logic)
// ─────────────────────────────────────────────────────────────────────────────

function MapPanel({ active, ambulanceProgress }) {
  return (
    <div style={{ position:"relative", width:"100%", height:"100%", background:"transparent", borderRadius:16, overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at center, rgba(0,255,136,0.1), transparent)", pointerEvents:"none" }} />
      <svg width="100%" height="100%" style={{ position:"absolute", inset:0 }}>
        <defs>
          <pattern id="g" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,255,136,0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />

        {active && (
          <circle cx="52%" cy="48%" r="100" fill="none" stroke="rgba(255,68,68,0.2)" strokeWidth="1">
            <animate attributeName="r" values="0;200" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(20,40,25,0.7)" strokeWidth="18" />
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(20,40,25,0.7)" strokeWidth="14" />
        <line x1="20%" y1="0" x2="80%" y2="100%" stroke="rgba(15,30,20,0.6)" strokeWidth="10" />

        {[10,25,40,55,70,85].map((x) => (
          <line key={x} x1={`${x}%`} y1="calc(50% - 2px)" x2={`${x+5}%`} y2="calc(50% - 2px)" stroke="rgba(0,255,136,0.4)" strokeWidth="2" strokeDasharray="8,8" />
        ))}

        <g transform="translate(78, 60)">
          <circle r="14" fill="rgba(0,50,20,0.8)" stroke="var(--color-green)" strokeWidth="2" style={{ filter:"drop-shadow(0 0 8px var(--color-green-glow))" }} />
          <text x="-5" y="5" fill="var(--color-green)" fontSize="14" fontWeight="bold">H</text>
        </g>

        {active && (
          <g transform="translate(52%, 48%)">
            <circle r="16" fill="rgba(255,0,0,0.2)" stroke="var(--color-red-bright)" strokeWidth="2" style={{ filter:"drop-shadow(0 0 10px rgba(255,0,0,0.5))" }}>
              <animate attributeName="r" values="14;24;14" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <text x="-8" y="6" fill="#fff" fontSize="18">⚠</text>
          </g>
        )}

        {active && ambulanceProgress > 0 && (
          <>
            <line x1="78" y1="60" x2="52%" y2="48%" stroke="var(--color-green)" strokeWidth="2" strokeDasharray="6,4" opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
            </line>
            <circle
              cx={`calc(78px + (52% - 78px) * ${ambulanceProgress / 100})`}
              cy={`calc(60px + (48% - 60px) * ${ambulanceProgress / 100})`}
              r="8" fill="var(--color-green)"
              style={{ filter:"drop-shadow(0 0 10px var(--color-green))" }}>
              <animate attributeName="opacity" values="1;0.6;1" dur="0.3s" repeatCount="indefinite" />
            </circle>
            <text
              x={`calc(78px + (52% - 78px) * ${ambulanceProgress / 100} - 6px)`}
              y={`calc(60px + (48% - 60px) * ${ambulanceProgress / 100} + 5px)`}
              fontSize="12" fill="#001a08">🚑</text>
          </>
        )}

        {active && ambulanceProgress > 20 && (
          <line x1="10%" y1="90%" x2="52%" y2="48%" stroke="var(--color-blue)" strokeWidth="2" strokeDasharray="6,4" opacity="0.6">
            <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
          </line>
        )}

        <text x="68" y="90" fill="var(--color-green)" fontSize="10" fontFamily="'Share Tech Mono',monospace" style={{ filter:"drop-shadow(0 0 4px var(--color-green-glow))" }}>CITY HOSPITAL</text>
        <text x="8%" y="95%" fill="var(--color-blue)" fontSize="10" fontFamily="'Share Tech Mono',monospace">POLICE HQ</text>
        {active && <text x="54%" y="46%" fill="var(--color-red-bright)" fontSize="10" fontFamily="'Share Tech Mono',monospace" style={{ filter:"drop-shadow(0 0 4px rgba(255,0,0,0.5))" }}>ACCIDENT</text>}
        <text x="2%" y="4%" fill="var(--color-text-dim)" fontSize="9" fontFamily="'Share Tech Mono',monospace">PUNE - BANGALORE HWY</text>
      </svg>
      <div style={{ position:"absolute", top:12, right:12, width:32, height:32, borderRadius:"50%", border:"1px solid rgba(0,255,136,0.3)", display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,255,136,0.05)", color:"var(--color-green)", fontSize:11, fontFamily:"monospace", backdropFilter:"blur(4px)" }}>N</div>
    </div>
  );
}

function NotifPopup({ notifs, onDismiss }) {
  return (
    <div style={{ position:"fixed", top:20, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:12, maxWidth:320 }}>
      {notifs.map((n) => (
        <div key={n.id} className="glass-panel" style={{
          background: n.color==="red" ? "rgba(40,0,0,0.9)" : n.color==="green" ? "rgba(0,30,10,0.9)" : "rgba(0,10,40,0.9)",
          border: `1px solid ${n.color==="red" ? "var(--color-red-bright)" : n.color==="green" ? "var(--color-green)" : "var(--color-blue)"}`,
          padding:"16px 20px", color:"#fff", fontSize:14,
          boxShadow: `0 8px 32px ${n.color==="red" ? "rgba(255,0,0,0.35)" : n.color==="green" ? "rgba(0,255,136,0.2)" : "rgba(68,136,255,0.2)"}`,
          animation:"slideInRight 0.4s cubic-bezier(0.175,0.885,0.32,1.275)",
          display:"flex", gap:14, alignItems:"flex-start",
          position:"relative", overflow:"hidden"
        }}>
          <div style={{ position:"absolute", top:0, left:"-50%", width:"200%", height:"100%", background:`linear-gradient(90deg,transparent,${n.color==="red"?"rgba(255,51,51,0.15)":"rgba(0,255,136,0.08)"},transparent)`, animation:"radarSweep 3s linear infinite" }} />
          <span style={{ fontSize:24, zIndex:1 }}>{n.icon}</span>
          <div style={{ zIndex:1, flex:1 }}>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:11, textTransform:"uppercase", letterSpacing:1.5, color:n.color==="red"?"var(--color-red-bright)":n.color==="green"?"var(--color-green)":"var(--color-blue)", marginBottom:4 }}>{n.title}</div>
            <div style={{ color:"rgba(255,255,255,0.8)", fontSize:13, lineHeight:1.4, fontFamily:"var(--font-primary)" }}>{n.msg}</div>
          </div>
          <button onClick={() => onDismiss(n.id)} style={{ zIndex:1, marginLeft:"auto", background:"none", border:"none", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:20, lineHeight:1, transition:"color 0.2s" }} onMouseOver={e=>e.target.style.color="#fff"} onMouseOut={e=>e.target.style.color="rgba(255,255,255,0.5)"}>×</button>
        </div>
      ))}
    </div>
  );
}

function SirenIcon({ active }) {
  return (
    <div style={{ position:"relative", width:48, height:48, display:"flex", alignItems:"center", justifyContent:"center", background:active?"rgba(255,0,0,0.1)":"rgba(255,255,255,0.04)", borderRadius:"50%", border:`1px solid ${active?"rgba(255,0,0,0.3)":"transparent"}`, boxShadow:active?"0 0 20px rgba(255,0,0,0.4)":"none" }}>
      {active && (
        <>
          <div style={{ position:"absolute", width:48, height:48, borderRadius:"50%", background:"rgba(255,0,0,0.15)", animation:"radarPing 1.5s ease infinite" }} />
          <div style={{ position:"absolute", width:36, height:36, borderRadius:"50%", background:"rgba(255,0,0,0.25)", animation:"radarPing 1.5s ease infinite 0.4s" }} />
        </>
      )}
      <span style={{ fontSize:26, zIndex:1, animation:active?"flashNeon 0.8s ease infinite":"none", filter:active?"drop-shadow(0 0 8px red)":"none" }}>🚨</span>
    </div>
  );
}

function Badge({ label, color }) {
  const colors = {
    red:    ["var(--color-red-bright)","rgba(50,0,0,0.5)","rgba(255,68,68,0.3)"],
    green:  ["var(--color-green)","rgba(0,30,10,0.5)","rgba(0,255,136,0.3)"],
    yellow: ["var(--color-yellow)","rgba(40,30,0,0.5)","rgba(255,204,0,0.3)"],
    blue:   ["var(--color-blue)","rgba(0,10,40,0.5)","rgba(68,136,255,0.3)"],
    gray:   ["#888","rgba(30,30,30,0.5)","rgba(100,100,100,0.3)"]
  };
  const [fg,bg,border] = colors[color]||colors.gray;
  return (
    <span style={{ background:bg, color:fg, border:`1px solid ${border}`, borderRadius:"20px", padding:"4px 14px", fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", backdropFilter:"blur(4px)", boxShadow:`0 0 12px ${border}`, fontFamily:"var(--font-display)" }}>
      {label}
    </span>
  );
}

// ── NEW: System status bar ─────────────────────────────────────────────────
function SystemStatusBar({ isDrowsy, ambulanceDispatched, policeDispatched, phase }) {
  const items = [
    { label:"AI ENGINE",  val:"ONLINE",                         dot:"" },
    { label:"GPS",        val:"LIVE",                           dot:"" },
    { label:"DROWSY AI",  val:isDrowsy?"ALERT":"OK",            dot:isDrowsy?"danger":"" },
    { label:"AMBULANCE",  val:ambulanceDispatched?"ACTIVE":"IDLE", dot:ambulanceDispatched?"warn":"" },
    { label:"POLICE",     val:policeDispatched?"ACTIVE":"IDLE",    dot:policeDispatched?"warn":"" },
  ];
  return (
    <div className="sys-bar">
      {items.map((item,i) => (
        <React.Fragment key={i}>
          {i>0 && <div className="sys-divider"/>}
          <div className="sys-item">
            <div className={`sys-dot ${item.dot}`}/>
            <span>{item.label}</span>
            <span style={{ color: item.dot==="danger"?"#ff4444":item.dot==="warn"?"#ffcc00":"rgba(0,255,136,0.7)", marginLeft:2 }}>{item.val}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── NEW: Drowsiness monitor mini-card ─────────────────────────────────────
function DrowsinessMonitorCard({ isDrowsy }) {
  const eyeOpen = !isDrowsy;
  const c = isDrowsy ? "#ff4444" : "#00ff88";
  return (
    <div className={`drw-mini-card ${isDrowsy?"drowsy":""}`}>
      <div style={{ fontSize:9, fontFamily:"var(--font-display)", letterSpacing:3, color:"var(--color-text-dim)", marginBottom:12, textTransform:"uppercase" }}>
        Drowsiness Monitor
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        {/* Animated eye */}
        <svg width="52" height="32" viewBox="0 0 52 32">
          <ellipse cx="26" cy="16" rx="20" ry={eyeOpen?10:1.5}
            fill={`rgba(${isDrowsy?"255,50,50":"0,255,136"},0.07)`}
            stroke={c} strokeWidth="1.5"
            style={{ transition:"all 0.4s ease", filter:`drop-shadow(0 0 6px ${c})` }}
          />
          {eyeOpen && <circle cx="26" cy="16" r="5" fill={c} opacity="0.9" style={{ transition:"all 0.4s ease" }}/>}
          {eyeOpen && <circle cx="28" cy="14" r="2" fill="rgba(255,255,255,0.5)"/>}
          {!eyeOpen && <line x1="9" y1="16" x2="43" y2="16" stroke={c} strokeWidth="2" strokeLinecap="round" style={{ filter:"drop-shadow(0 0 5px #ff4444)" }}/>}
        </svg>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:700, fontFamily:"var(--font-display)", color:c, letterSpacing:1.5, textTransform:"uppercase", textShadow:`0 0 12px ${isDrowsy?"rgba(255,0,0,0.5)":"rgba(0,255,136,0.4)"}`, transition:"all 0.4s ease" }}>
            {isDrowsy ? "DROWSY" : "ALERT"}
          </div>
          <div style={{ fontSize:11, color:"var(--color-text-dim)", letterSpacing:1, fontFamily:"var(--font-primary)", marginTop:2 }}>
            {isDrowsy ? "Fatigue detected" : "Driver state normal"}
          </div>
        </div>
        {/* Status dot ring */}
        <div style={{ width:28, height:28, borderRadius:"50%", border:`2px solid ${c}`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 12px ${c}40` }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:c, boxShadow:`0 0 8px ${c}`, animation:isDrowsy?"blink 0.8s ease infinite":"none" }}/>
        </div>
      </div>
    </div>
  );
}

// ── NEW: Animated EKG line ─────────────────────────────────────────────────
function EkgLine({ isDrowsy }) {
  const color = isDrowsy ? "#ff4444" : "#00ff88";
  // More erratic path when drowsy
  const normalPath  = "M0,19 L28,19 L32,8 L36,30 L40,12 L44,26 L48,19 L140,19 L144,8 L148,30 L152,12 L156,26 L160,19 L280,19";
  const drowsyPath  = "M0,19 L18,19 L22,4 L26,34 L30,2 L34,36 L38,14 L42,24 L46,19 L120,19 L124,4 L128,34 L132,2 L136,36 L140,14 L144,24 L148,19 L280,19";
  const path = isDrowsy ? drowsyPath : normalPath;
  return (
    <div className="ekg-wrap">
      <svg className="ekg-line" width="100%" height="38" viewBox="0 0 280 38" preserveAspectRatio="none">
        {/* faint trail */}
        <polyline points={path.replace(/[ML]/g,"").split(" ").join(" ")}
          fill="none" stroke={color} strokeWidth="0.5" opacity="0.15" strokeLinecap="round" strokeLinejoin="round"
        />
        <polyline points={path.replace(/[ML]/g,"").split(" ").join(" ")}
          className="ekg-path"
          fill="none" stroke={color} strokeWidth="1.8" opacity="0.9" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter:`drop-shadow(0 0 4px ${color})`, transition:"stroke 0.5s ease" }}
        />
        {/* moving dot */}
        <circle r="3" fill={color} style={{ filter:`drop-shadow(0 0 6px ${color})` }}>
          <animateMotion dur="2.5s" repeatCount="indefinite" rotate="auto">
            <mpath href="#ekgShape"/>
          </animateMotion>
        </circle>
        <path id="ekgShape" d={path} fill="none" opacity="0"/>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDUCATION & SUSTAINABILITY PANELS (visual only)
// ─────────────────────────────────────────────────────────────────────────────

// ── NEW: Drowsiness & Risk Zone Prevention Module ────────────────────────────
function RiskPreventionPanel() {
  const [drowsinessLevel, setDrowsinessLevel] = useState("Low");
  const [zoneRisk, setZoneRisk] = useState("Safe");
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate random values
      const drowsyVals = ["Low", "Medium", "High"];
      const zoneVals = ["Safe", "Risk Zone"];
      const nextDrowsy = drowsyVals[Math.floor(Math.random() * drowsyVals.length)];
      const nextZone = zoneVals[Math.floor(Math.random() * zoneVals.length)];
      
      setDrowsinessLevel(nextDrowsy);
      setZoneRisk(nextZone);

      if (nextDrowsy === "High" && nextZone === "Risk Zone") {
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 5000); // 5 sec popup
      } else {
        setShowWarning(false);
      }
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const isHighRisk = drowsinessLevel === "High" && zoneRisk === "Risk Zone";

  return (
    <>
      <div className={`drw-mini-card ${isHighRisk ? "drowsy" : ""}`} style={{ borderColor: isHighRisk ? "rgba(255,68,68,0.4)" : "rgba(0,255,136,0.12)" }}>
        <div style={{ fontSize:9, fontFamily:"var(--font-display)", letterSpacing:3, color:"var(--color-text-dim)", marginBottom:12, textTransform:"uppercase", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:14 }}>🧠</span> Driver Monitoring System
        </div>
        
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, fontFamily:"var(--font-primary)" }}>
            <span style={{ color:"var(--color-text-dim)" }}>Drowsiness Level:</span>
            <span style={{
              padding: "2px 8px", borderRadius: "4px", background: "rgba(0,0,0,0.3)",
              color: drowsinessLevel === "High" ? "#ff4444" : drowsinessLevel === "Medium" ? "#ffcc00" : "#00ff88",
              fontFamily: "var(--font-mono)", fontWeight: "bold"
            }}>{drowsinessLevel}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, fontFamily:"var(--font-primary)" }}>
            <span style={{ color:"var(--color-text-dim)" }}>Zone Risk:</span>
            <span style={{
              padding: "2px 8px", borderRadius: "4px", background: "rgba(0,0,0,0.3)",
              color: zoneRisk === "Risk Zone" ? "#ff4444" : "#00ff88",
              fontFamily: "var(--font-mono)", fontWeight: "bold"
            }}>{zoneRisk}</span>
          </div>

          <div style={{ marginTop:6, padding:"8px 10px", background:"rgba(0,255,136,0.04)", borderRadius:8, border:"1px solid rgba(0,255,136,0.08)", fontSize:10, color:"rgba(0,255,136,0.7)", fontFamily:"var(--font-primary)", lineHeight:1.4 }}>
            🌱 Preventing accidents reduces resource loss and supports sustainable transport systems.
          </div>
        </div>
      </div>

      {showWarning && (
        <div style={{
          position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)",
          background: "rgba(30, 0, 0, 0.95)", border: "2px solid #ff4444", borderRadius: "12px",
          padding: "20px 24px", zIndex: 10000, boxShadow: "0 0 40px rgba(255, 0, 0, 0.6)",
          textAlign: "center", animation: "cardIn 0.3s ease, drown-pulse 0.9s ease infinite",
          backdropFilter: "blur(8px)"
        }}>
          <div style={{ fontSize: "20px", marginBottom: "8px", fontWeight: "bold", fontFamily: "var(--font-display)", color: "#ff4444", textTransform: "uppercase", letterSpacing: "2px" }}>
            ⚠️ High Risk Alert
          </div>
          <div style={{ fontSize: "14px", color: "#ffa0a0", lineHeight: 1.5, fontFamily: "var(--font-primary)", fontWeight: 500 }}>
            Driver fatigue detected in accident-prone zone.<br/>
            Please take a break or stay alert.
          </div>
        </div>
      )}
    </>
  );
}

function RoadSafetyPanel() {
  const tips = [
    { icon: "🪖", text: "Always wear a helmet while riding" },
    { icon: "🔒", text: "Wear seatbelt — it saves lives" },
    { icon: "🚫", text: "Avoid overspeeding — follow speed limits" },
    { icon: "📵", text: "Do not use mobile while driving" },
    { icon: "🚦", text: "Always follow traffic signals" },
    { icon: "🍺", text: "Never drink and drive" },
    { icon: "💡", text: "Use indicators before turning" },
  ];
  return (
    <div className="drw-mini-card" style={{ borderColor: "rgba(0,255,136,0.12)" }}>
      <div style={{ fontSize:9, fontFamily:"var(--font-display)", letterSpacing:3, color:"var(--color-text-dim)", marginBottom:12, textTransform:"uppercase", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:14 }}>🛡️</span> Road Safety Tips
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {tips.map((tip, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:"var(--color-text-main)", fontFamily:"var(--font-primary)", padding:"6px 12px", background:"rgba(0,255,136,0.03)", borderRadius:8, border:"1px solid rgba(0,255,136,0.06)", transition:"all 0.3s ease", cursor:"default" }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(0,255,136,0.07)"; e.currentTarget.style.borderColor = "rgba(0,255,136,0.18)"; e.currentTarget.style.transform = "translateX(3px)"; }}
            onMouseOut={e => { e.currentTarget.style.background = "rgba(0,255,136,0.03)"; e.currentTarget.style.borderColor = "rgba(0,255,136,0.06)"; e.currentTarget.style.transform = "translateX(0)"; }}
          >
            <span style={{ fontSize:14, flexShrink:0 }}>{tip.icon}</span>
            <span style={{ lineHeight:1.4 }}>{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SustainabilityImpactPanel() {
  const impacts = [
    { icon: "⚡", text: "Reduces fatalities", color: "#00ff88" },
    { icon: "🏙️", text: "Improves traffic efficiency", color: "#4488ff" },
    { icon: "🌐", text: "Supports smart city systems", color: "#ffcc00" },
    { icon: "⏱️", text: "Saves critical response time", color: "#00dd77" },
  ];
  return (
    <div className="drw-mini-card" style={{ borderColor: "rgba(0,255,136,0.08)", background: "rgba(4,18,8,0.7)" }}>
      <div style={{ fontSize:9, fontFamily:"var(--font-display)", letterSpacing:3, color:"var(--color-text-dim)", marginBottom:10, textTransform:"uppercase", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:14 }}>🌱</span> Sustainability Impact
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {impacts.map((item, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:"var(--color-text-main)", fontFamily:"var(--font-primary)", padding:"5px 10px", borderLeft:`2px solid ${item.color}`, background:"rgba(0,0,0,0.15)", borderRadius:"0 6px 6px 0", transition:"all 0.3s ease" }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(0,255,136,0.05)"; e.currentTarget.style.paddingLeft = "14px"; }}
            onMouseOut={e => { e.currentTarget.style.background = "rgba(0,0,0,0.15)"; e.currentTarget.style.paddingLeft = "10px"; }}
          >
            <span style={{ fontSize:13, flexShrink:0 }}>{item.icon}</span>
            <span style={{ lineHeight:1.4 }}>{item.text}</span>
          </div>
        ))}
      </div>
      {/* Key metric */}
      <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(0,255,136,0.06)", borderRadius:8, border:"1px solid rgba(0,255,136,0.12)", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:22, fontFamily:"var(--font-display)", fontWeight:800, color:"var(--color-green)", textShadow:"0 0 12px rgba(0,255,136,0.4)" }}>35%</span>
        <span style={{ fontSize:10, color:"var(--color-text-main)", fontFamily:"var(--font-primary)", lineHeight:1.4 }}>Avg Response Time Improved by AI-assisted dispatch</span>
      </div>
      <div style={{ marginTop:8, fontSize:10, color:"rgba(0,255,136,0.35)", fontFamily:"var(--font-mono)", letterSpacing:1, fontStyle:"italic", lineHeight:1.5 }}>
        "Educating drivers. Saving lives. Building sustainable cities."
      </div>
    </div>
  );
}

function GoldenHourMessage() {
  return (
    <div className="drw-mini-card" style={{ borderColor:"rgba(255,68,68,0.25)", background:"rgba(20,4,4,0.75)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <span style={{ fontSize:22 }}>🚨</span>
        <div style={{ fontSize:10, fontFamily:"var(--font-display)", letterSpacing:2.5, color:"#ff4444", textTransform:"uppercase" }}>Golden Hour Alert</div>
      </div>
      <div style={{ fontSize:13, color:"rgba(255,180,180,0.9)", lineHeight:1.75, fontFamily:"var(--font-primary)", fontWeight:600 }}>
        "This delay could cost a life. Faster response during the <span style={{ color:"#ffcc00", fontWeight:800 }}>golden hour</span> saves lives."
      </div>
      <div style={{ fontSize:10, color:"rgba(200,150,150,0.6)", marginTop:10, fontFamily:"var(--font-mono)", letterSpacing:1, lineHeight:1.5 }}>
        The first 60 minutes after traumatic injury are critical. Every second of delay matters.
      </div>
      <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(0,255,136,0.04)", borderRadius:8, border:"1px solid rgba(0,255,136,0.08)", fontSize:11, color:"rgba(0,255,136,0.6)", fontFamily:"var(--font-primary)", lineHeight:1.5 }}>
        💡 This system educates users about road safety and emergency response
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP — ALL ORIGINAL LOGIC PRESERVED EXACTLY
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [phase, setPhase] = useState("idle");
  const [severity, setSeverity] = useState("HIGH");
  const [logs, setLogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [ambulanceProgress, setAmbulanceProgress] = useState(0);
  const [policeDispatched, setPoliceDispatched] = useState(false);
  const [ambulanceDispatched, setAmbulanceDispatched] = useState(false);
  const [aiData, setAiData] = useState({ confidence:0, severity:"Analyzing...", falseAlert:"N/A", injury:"N/A" });
  const [eta, setEta] = useState(null);
  const [position, setPosition] = useState([18.5204, 73.8567]);
  const [blink, setBlink] = useState(true);
  const [isDrowsy, setIsDrowsy] = useState(false);
  const [learningMode, setLearningMode] = useState(false);
  const [passengerCount, setPassengerCount] = useState(1);

  useEffect(() => {
    const channel = supabase
      .channel('realtime messages')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, (payload) => {
        console.log("New message:", payload);
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => { setBlink((prev) => !prev); }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setPosition((prev) => {
        const lat = prev[0], lng = prev[1];
        const newLat = lat + (destination[0] - lat) * 0.05;
        const newLng = lng + (destination[1] - lng) * 0.05;
        return [newLat, newLng];
      });
    }, 500);
    return () => clearInterval(moveInterval);
  }, []);

  const ambulanceIcon = new L.Icon({
    iconUrl:"https://cdn-icons-png.flaticon.com/512/2967/2967350.png",
    iconSize:[60,60], iconAnchor:[30,60], popupAnchor:[0,-60],
  });

  const [user, setUser] = useState({ name:"", phone:"" });

  const speak = (msg) => {
    const speech = new SpeechSynthesisUtterance(msg);
    speech.rate = 1; speech.pitch = 1;
    window.speechSynthesis.speak(speech);
  };

  const [demoRunning, setDemoRunning] = useState(false);
  const [communityAlert, setCommunityAlert] = useState(false);
  const audioCtx = useRef(null);
  const notifId  = useRef(0);

  const addLog = useCallback((msg) => setLogs((l) => [...l, { t:now(), msg }]), []);

  const addNotif = useCallback((title, msg, icon, color, duration = 5000) => {
    const id = ++notifId.current;
    setNotifs((n) => [...n, { id, title, msg, icon, color }]);
    setTimeout(() => setNotifs((n) => n.filter((x) => x.id !== id)), duration);
    return id;
  }, []);

  const dismissNotif = (id) => setNotifs((n) => n.filter((x) => x.id !== id));

  const playBeep = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < 3; i++) setTimeout(() => beep(audioCtx.current), i * 500);
    } catch(e) {}
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      playBeep();
      addNotif(
        "Driver Safety Assistant",
        <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:4, fontSize:12 }}>
          <div style={{ fontWeight:700, color:"#ffcc00", marginBottom:2 }}>⚠️ Pre-Drive Safety Check:</div>
          <div>• Wear seatbelt</div>
          <div>• Avoid overspeeding</div>
          <div>• Do not use mobile while driving</div>
          <div>• Stay alert</div>
        </div>,
        "🚗",
        "green",
        8000
      );
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSimulation = useCallback((sev = severity) => {
    if (phase !== "idle") return;
    setPhase("detecting");
    setLogs([]);
    setAmbulanceProgress(0);
    setPoliceDispatched(false);
    setAmbulanceDispatched(false);
    setEta(null);
    setCommunityAlert(false);
    setAiData({ confidence:0, severity:"Analyzing...", falseAlert:"Checking...", injury:"Assessing..." });

    addLog("Impact sensors triggered");
    playBeep();

    setTimeout(() => { addLog("Accelerometer data anomaly detected"); setAiData((a) => ({ ...a, confidence:47 })); }, 800);
    setTimeout(() => { addLog("AI model processing sensor data..."); setAiData((a) => ({ ...a, confidence:71, falseAlert:"Unlikely" })); }, 1600);
    setTimeout(() => {
      setPhase("confirmed");
      addLog("✅ Accident CONFIRMED by AI system");
      const conf = sev==="HIGH"?94:sev==="MEDIUM"?82:67;
      const inj  = sev==="HIGH"?"High Injury Risk":sev==="MEDIUM"?"Moderate Risk":"Minor Risk";
      setAiData({ confidence:conf, severity:`${sev} IMPACT`, falseAlert:"Negative", injury:inj });
      addNotif("ACCIDENT DETECTED", `Vehicle MH14-4587 — ${sev} severity. Passengers involved: ${passengerCount} people`, "⚠️", "red");
      playBeep();
      addLog("GPS coordinates locked: 18.5204°N, 73.8567°E");
    }, 2800);
    setTimeout(() => { addLog(`🏥 Alert sent to City Hospital — Passengers involved: ${passengerCount} people`); addNotif("HOSPITAL ALERTED",`Incoming trauma patient — prepare ER. Passengers involved: ${passengerCount} people`,"🏥","red"); }, 3600);
    setTimeout(() => { addLog("🚔 Police Station notified"); addNotif("POLICE NOTIFIED","Accident on Pune-Bangalore Hwy","🚔","blue"); }, 4400);
    setTimeout(() => { addLog("📡 Emergency Control Center alerted"); setCommunityAlert(true); addLog("📢 Community alert broadcast: 200m radius"); }, 5200);
    setTimeout(() => {
      setPhase("responding"); setAmbulanceDispatched(true); setEta("6 min");
      addLog("🚑 Ambulance dispatched — ETA 6 min");
      addNotif("AMBULANCE DISPATCHED","Unit 7 en route — ETA 6 min","🚑","green");
      let prog = 0;
      const interval = setInterval(() => { prog += 2; setAmbulanceProgress(prog); if (prog >= 100) clearInterval(interval); }, 180);
    }, 6200);
    setTimeout(() => { setPoliceDispatched(true); addLog("🚔 Police Unit 3 on route"); }, 7000);
    setTimeout(() => { setEta("3 min"); addLog("🚑 Ambulance approaching — ETA 3 min"); }, 10000);
    setTimeout(() => {
      setPhase("resolved"); setEta("Arrived");
      addLog("✅ Ambulance arrived at scene");
      addLog("✅ Police secured perimeter");
      addNotif("SCENE SECURED","All units on-site — situation under control","✅","green");
    }, 16000);
  }, [phase, severity, addLog, addNotif, passengerCount]);

  const runDemo = useCallback(() => {
    if (!user.name || !user.phone) { alert("Please enter name and phone number"); return; }
    if (demoRunning || phase !== "idle") return;
    setDemoRunning(true); setPhase("detecting");
    addLog("🚨 Sudden impact detected!");
    addLog("⚙️ AI analyzing sensor data...");
    setAiData({ confidence:10, severity:"Analyzing...", falseAlert:"Checking...", injury:"Assessing..." });

    setTimeout(() => {
      addLog("🧠 Validating crash pattern...");
      setAiData({ confidence:40, severity:"Validating...", falseAlert:"Checking...", injury:"Assessing..." });
      setTimeout(() => {
        addLog("📊 Calculating severity...");
        setAiData({ confidence:70, severity:"Processing...", falseAlert:"Checking...", injury:"Assessing..." });
        setTimeout(() => {
          const confidence = Math.floor(Math.random() * 20) + 80;
          let severityLevel = confidence > 90 ? "HIGH" : confidence > 85 ? "MEDIUM" : "LOW";
          setAiData({ confidence, severity:severityLevel, falseAlert:"Negative", injury:severityLevel==="HIGH"?"High Risk":severityLevel==="MEDIUM"?"Moderate Risk":"Low Risk" });
          setSeverity(severityLevel); setPhase("confirmed");
          addLog(`✅ Accident confirmed (${severityLevel}) — Passengers involved: ${passengerCount} people`);
          addNotif("Accident Detected", `Severity: ${severityLevel}. Passengers involved: ${passengerCount} people`, "🚨", "red");
          addLog(`📡 SOS sent for ${user.name} (${user.phone})`);
          speak("Accident detected. Emergency services have been notified.");
          addLog("📡 Sending SOS to emergency services...");
          addNotif("SOS Sent","Location shared with ambulance & police","📡","blue");
          addLog("📞 Calling ambulance...");
          let progress = 0;
          const progressInterval = setInterval(() => {
            progress = Math.min(progress + 20, 100);
            setAmbulanceProgress(progress);
            setPosition((prev) => [prev[0] + 0.001, prev[1] + 0.001]);
            if (progress >= 100) {
              clearInterval(progressInterval);
              setAmbulanceDispatched(true); addLog("🚑 Ambulance dispatched successfully"); setEta("6 min");
              let etaRemaining = 6;
              const etaInterval = setInterval(() => {
                etaRemaining = Math.max(etaRemaining - 1, 0);
                setEta(etaRemaining > 0 ? `${etaRemaining} min` : "Arrived");
                if (etaRemaining <= 0) { clearInterval(etaInterval); addLog("🚑 Ambulance reached location"); }
              }, 2000);
            }
          }, 600);
          setTimeout(() => { setPoliceDispatched(true); addLog("🚓 Police notified and dispatched"); }, 2000);
          setTimeout(() => { addLog(`🏥 Hospital emergency team alerted — Passengers: ${passengerCount}`); setCommunityAlert(true); }, 2500);
          setTimeout(() => { setDemoRunning(false); }, 3200);
        }, 1200);
      }, 1200);
    }, 1200);
  }, [demoRunning, phase, addLog, addNotif, user, passengerCount]);

  const reset = () => {
    setPhase("idle"); setLogs([]); setNotifs([]); setAmbulanceProgress(0);
    setPoliceDispatched(false); setAmbulanceDispatched(false); setEta(null);
    setCommunityAlert(false);
    setAiData({ confidence:0, severity:"Analyzing...", falseAlert:"N/A", injury:"N/A" });
  };

  const active   = phase !== "idle";
  const sevColor = severity === "HIGH" ? "red" : severity === "MEDIUM" ? "yellow" : "green";

  // ── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    app: { minHeight:"100vh", display:"flex", flexDirection:"column" },
    header: { background:"rgba(4,10,6,0.92)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderBottom:"1px solid rgba(0,255,136,0.08)", padding:"14px 28px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap", position:"sticky", top:0, zIndex:100 },
    title: { fontSize:22, fontWeight:900, color:"var(--color-green)", letterSpacing:4, textTransform:"uppercase", flex:1, textShadow:"0 0 24px var(--color-green-glow)", fontFamily:"var(--font-display)" },
    nav: { display:"flex", gap:10 },
    navBtn: (s) => ({ background:screen===s?"rgba(0,255,136,0.12)":"transparent", border:`1px solid ${screen===s?"var(--color-green)":"rgba(255,255,255,0.08)"}`, color:screen===s?"var(--color-green)":"var(--color-text-dim)", borderRadius:"20px", padding:"7px 20px", cursor:"pointer", fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", transition:"all 0.3s ease", boxShadow:screen===s?"0 0 18px rgba(0,255,136,0.18)":"none", fontFamily:"var(--font-display)" }),
    body: { flex:1, padding:22, display:"grid", gap:20, animation:"fadeIn 0.6s ease" },
    card: (glowColor) => ({ background:"var(--bg-panel)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", border:`1px solid ${active&&glowColor?glowColor:"rgba(255,255,255,0.04)"}`, borderRadius:20, padding:22, boxShadow:active&&glowColor?`0 0 32px ${glowColor}33`:"0 8px 32px rgba(0,0,0,0.45)", transition:"all 0.4s ease", position:"relative", overflow:"hidden" }),
    cardTitle: { fontSize:10, fontWeight:700, letterSpacing:2.5, color:"var(--color-text-dim)", textTransform:"uppercase", marginBottom:16, display:"flex", alignItems:"center", gap:10, fontFamily:"var(--font-display)" },
    stat: { fontSize:32, fontWeight:800, lineHeight:1, textShadow:"0 2px 10px rgba(0,0,0,0.5)", fontFamily:"var(--font-display)" },
    statLabel: { fontSize:10, color:"var(--color-text-dim)", textTransform:"uppercase", letterSpacing:1.5, marginTop:6, fontWeight:600 },
    btn: (color) => ({ className:"cyber-btn", background:color==="red"?(active?"rgba(80,0,0,0.85)":"rgba(40,0,0,0.65)"):color==="green"?"rgba(0,40,20,0.65)":color==="blue"?"rgba(0,10,40,0.65)":"var(--bg-panel)", border:`1px solid ${color==="red"?"var(--color-red-bright)":color==="green"?"var(--color-green)":color==="blue"?"var(--color-blue)":"rgba(255,255,255,0.1)"}`, color:color==="red"?"var(--color-red-bright)":color==="green"?"var(--color-green)":color==="blue"?"var(--color-blue)":"var(--color-text-main)", borderRadius:12, padding:"13px 22px", cursor:"pointer", fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase", transition:"all 0.3s ease", display:"flex", alignItems:"center", gap:10, boxShadow:`0 4px 15px rgba(0,0,0,0.25)`, fontFamily:"var(--font-display)" }),
    logEntry: { fontSize:12, fontFamily:"var(--font-mono)", color:"var(--color-text-main)", padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.03)", display:"flex", gap:12 },
    grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
    grid3: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 },
    progress: { height:8, background:"rgba(0,0,0,0.5)", borderRadius:4, overflow:"hidden", marginTop:8, border:"1px solid rgba(255,255,255,0.04)", boxShadow:"inset 0 2px 4px rgba(0,0,0,0.5)" },
    progressFill: (pct,color) => ({ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg, transparent, ${color})`, borderRadius:4, transition:"width 0.5s cubic-bezier(0.4,0,0.2,1)", boxShadow:`0 0 10px ${color}` }),
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{APP_CSS}</style>

      {/* Ambient scanline effect */}
      <div style={{ position:"fixed", top:0, left:0, width:"200px", height:"2px", background:"linear-gradient(90deg,transparent,rgba(0,255,136,0.12),transparent)", animation:"scanAcross 9s linear infinite", pointerEvents:"none", zIndex:9997 }} />

      {/* User setup bar */}
      <div className="glass-panel" style={{ margin:"14px 22px 0", padding:"14px 22px", display:"flex", alignItems:"center", gap:14, background:"rgba(8,20,11,0.7)", borderRadius:12, border:"1px solid rgba(0,255,136,0.09)" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--color-green)", textTransform:"uppercase", letterSpacing:2.5, fontFamily:"var(--font-display)", flexShrink:0 }}>
          <span style={{ marginRight:8 }}>👤</span>USER SETUP
        </div>
        {["Enter Name","Enter Phone Number"].map((ph,i) => (
          <input key={i}
            placeholder={ph}
            value={i===0?user.name:user.phone}
            onChange={(e) => setUser({ ...user, [i===0?"name":"phone"]:e.target.value })}
            style={{ padding:"9px 15px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.45)", color:"#fff", outline:"none", fontSize:13, minWidth:180, fontFamily:"var(--font-primary)", transition:"border-color 0.3s" }}
            onFocus={e=>e.target.style.borderColor="rgba(0,255,136,0.4)"}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}
          />
        ))}
        {/* Passenger Count Selector */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:9, fontFamily:"var(--font-display)", letterSpacing:1.5, color:"var(--color-text-dim)", textTransform:"uppercase", whiteSpace:"nowrap" }}>👥 Passengers</span>
          <select
            value={passengerCount}
            onChange={(e) => setPassengerCount(Number(e.target.value))}
            style={{ padding:"8px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.45)", color:"#fff", outline:"none", fontSize:13, fontFamily:"var(--font-primary)", cursor:"pointer", appearance:"none", WebkitAppearance:"none", MozAppearance:"none", backgroundImage:"url('data:image/svg+xml;utf8,<svg fill=\'%2300ff88\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M7 10l5 5 5-5z\'/></svg>')", backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center", backgroundSize:"14px", paddingRight:"28px", transition:"border-color 0.3s" }}
            onFocus={e => e.target.style.borderColor="rgba(0,255,136,0.4)"}
            onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.08)"}
          >
            {[1,2,3,4,5,6].map(n => <option key={n} value={n} style={{ background:"#0a1a0f", color:"#fff" }}>{n}</option>)}
          </select>
        </div>
        <SystemStatusBar isDrowsy={isDrowsy} ambulanceDispatched={ambulanceDispatched} policeDispatched={policeDispatched} phase={phase} />
        {/* Quick Status Indicators */}
        <div style={{ display:"flex", gap:10, marginLeft:"auto" }}>
          <div style={{ padding:"5px 14px", borderRadius:8, background:"rgba(0,0,0,0.3)", border:"1px solid rgba(0,255,136,0.08)", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:8, fontFamily:"var(--font-mono)", letterSpacing:1.2, color:"rgba(0,255,136,0.4)" }}>PHASE</span>
            <span style={{ fontSize:10, fontFamily:"var(--font-display)", color:phase==="idle"?"rgba(0,255,136,0.5)":phase==="confirmed"?"#ff4444":"#00ff88", letterSpacing:1 }}>{phase.toUpperCase()}</span>
          </div>
          <div style={{ padding:"5px 14px", borderRadius:8, background:"rgba(0,0,0,0.3)", border:"1px solid rgba(0,255,136,0.08)", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:8, fontFamily:"var(--font-mono)", letterSpacing:1.2, color:"rgba(0,255,136,0.4)" }}>ETA</span>
            <span style={{ fontSize:10, fontFamily:"var(--font-display)", color:"#00dd77", letterSpacing:1 }}>{eta || "—"}</span>
          </div>
          <div style={{ padding:"5px 14px", borderRadius:8, background:"rgba(0,0,0,0.3)", border:"1px solid rgba(0,255,136,0.08)", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:8, fontFamily:"var(--font-mono)", letterSpacing:1.2, color:"rgba(0,255,136,0.4)" }}>AI</span>
            <span style={{ fontSize:10, fontFamily:"var(--font-display)", color:aiData.confidence>80?"#ff4444":aiData.confidence>50?"#ffcc00":"#00ff88", letterSpacing:1 }}>{aiData.confidence}%</span>
          </div>
        </div>
      </div>

      <div style={{ ...S.app, flexDirection:"row" }}>
        <NotifPopup notifs={notifs} onDismiss={dismissNotif} />

        <div style={{ display:"flex", width:"100%", minHeight:"100vh", flexDirection:"column" }}>

          {/* ── HEADER ── */}
          <div style={S.header}>
            <SirenIcon active={phase==="confirmed"||phase==="responding"} />
            <div>
              <div style={S.title}>SAFEDRIVE‑AI</div>
              <div style={{ fontSize:9, color:"rgba(0,255,136,0.3)", letterSpacing:2, fontFamily:"var(--font-mono)" }}>ROAD SAFETY EDUCATION & SMART EMERGENCY RESPONSE SYSTEM</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {phase==="idle"       && <Badge label="STANDBY"          color="gray" />}
              {phase==="detecting"  && <Badge label="DETECTING..."      color="yellow" />}
              {phase==="confirmed"  && <Badge label="ACCIDENT CONFIRMED" color="red" />}
              {phase==="responding" && <Badge label="RESPONDING"        color="green" />}
              {phase==="resolved"   && <Badge label="RESOLVED"          color="green" />}
            </div>
            {/* Learning Mode Toggle */}
            <div
              onClick={() => setLearningMode(m => !m)}
              style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"6px 16px", borderRadius:20, border:`1px solid ${learningMode?"var(--color-green)":"rgba(255,255,255,0.08)"}`, background:learningMode?"rgba(0,255,136,0.1)":"transparent", transition:"all 0.3s ease", userSelect:"none" }}
            >
              <div style={{ width:28, height:14, borderRadius:7, background:learningMode?"var(--color-green)":"rgba(255,255,255,0.12)", position:"relative", transition:"all 0.3s ease" }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:learningMode?"#001a08":"#666", position:"absolute", top:2, left:learningMode?16:2, transition:"all 0.3s ease", boxShadow:learningMode?"0 0 6px var(--color-green)":"none" }} />
              </div>
              <span style={{ fontSize:9, fontFamily:"var(--font-display)", letterSpacing:2, color:learningMode?"var(--color-green)":"var(--color-text-dim)", textTransform:"uppercase" }}>Learn</span>
            </div>
            <div style={S.nav}>
              <button style={S.navBtn("dashboard")}  onClick={() => setScreen("dashboard")}>Dashboard</button>
              <button style={S.navBtn("emergency")}  onClick={() => setScreen("emergency")}>Emergency Room</button>
            </div>
          </div>

          {/* ── DASHBOARD ── */}
          {screen === "dashboard" && (
            <div style={{ ...S.body, gridTemplateColumns:"300px 1fr 280px" }}>

              {/* COL 1 */}
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

                {/* NEW — Drowsiness monitor card */}
                <DrowsinessMonitorCard isDrowsy={isDrowsy} />
                
                {/* Simulated Risk Prevention Panel */}
                <RiskPreventionPanel />

                {/* Vehicle Info */}
                <div style={{ ...S.card("#ff3333"), animation:active?"blink 1.5s ease infinite":"none" }}>
                  <div style={S.cardTitle}><span>🚗</span> Vehicle Info</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {[["Vehicle ID","MH14-4587"],["Location","Pune-Blore Hwy, KM 42"],["Speed","0 km/h"],["GPS","18.5204°N, 73.8567°E"]].map(([k,v]) => (
                      <div key={k}>
                        <div style={{ fontSize:9, color:"var(--color-text-dim)", textTransform:"uppercase", letterSpacing:1.5, fontFamily:"var(--font-mono)" }}>{k}</div>
                        <div style={{ fontSize:13, color:"var(--color-text-main)", fontWeight:600, fontFamily:"var(--font-primary)", marginTop:1 }}>{v}</div>
                      </div>
                    ))}
                    <h3 style={{ marginTop:14, marginBottom:6, fontSize:11, fontFamily:"var(--font-display)", letterSpacing:2, color:"var(--color-text-dim)" }}>📢 LIVE ALERTS</h3>
                    {messages.map((msg,i) => (
                      <p key={i} style={{ fontSize:12, color:"var(--color-green)", margin:0, fontFamily:"var(--font-mono)" }}>{msg.text}</p>
                    ))}
                    {/* Passenger Count Display */}
                    <div>
                      <div style={{ fontSize:9, color:"var(--color-text-dim)", textTransform:"uppercase", letterSpacing:1.5, fontFamily:"var(--font-mono)" }}>Passengers</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                        <span style={{ fontSize:18 }}>👥</span>
                        <span style={{ fontSize:18, fontWeight:800, fontFamily:"var(--font-display)", color:"var(--color-green)", textShadow:"0 0 10px rgba(0,255,136,0.3)" }}>{passengerCount}</span>
                        <span style={{ fontSize:10, color:"var(--color-text-dim)", fontFamily:"var(--font-primary)" }}>in vehicle</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:9, color:"var(--color-text-dim)", textTransform:"uppercase", letterSpacing:1.5, fontFamily:"var(--font-mono)", marginBottom:5 }}>Impact Severity</div>
                      <Badge label={active?severity:"NONE"} color={active?sevColor:"gray"} />
                    </div>
                  </div>
                </div>

                {/* Severity selector */}
                <div style={S.card(null)}>
                  <div style={S.cardTitle}>Severity Level</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {["LOW","MEDIUM","HIGH"].map((s) => (
                      <button key={s} disabled={active} onClick={() => setSeverity(s)} style={{ ...S.btn(s==="HIGH"?"red":s==="MEDIUM"?"yellow":"green"), background:severity===s?(s==="HIGH"?"#2a0000":s==="MEDIUM"?"#1a1400":"#001a0a"):"transparent", opacity:active?0.5:1 }}>
                        {s==="HIGH"?"🔴":s==="MEDIUM"?"🟡":"🟢"} {s}
                      </button>
                    ))}
                  </div>
                </div>

                <button disabled={active} onClick={() => runSimulation()} style={{ ...S.btn("red"), justifyContent:"center", padding:16, fontSize:12, opacity:active?0.4:1, animation:!active?"pulse 2s ease infinite":"none" }}>
                  🚨 TRIGGER AI CRASH DETECTION
                </button>
                <button disabled={active||demoRunning} onClick={runDemo} style={{ ...S.btn("blue"), justifyContent:"center", padding:12, opacity:active?0.4:1 }}>
                  ▶ AI LIVE SIMULATION
                </button>
                {phase==="resolved" && (
                  <button onClick={reset} style={{ ...S.btn("green"), justifyContent:"center", padding:12 }}>
                    ↺ RESET SYSTEM
                  </button>
                )}
              </div>

              {/* COL 2 — Map + EKG + Timeline */}
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

                {/* NEW — EKG heartbeat line */}
                <div style={{ ...S.card(null), padding:"14px 20px" }}>
                  <div style={S.cardTitle}><span>💓</span> Driver Vitals — EKG Monitor</div>
                  <EkgLine isDrowsy={isDrowsy} />
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:9, fontFamily:"var(--font-mono)", color:"var(--color-text-dim)" }}>
                    <span>BIOMETRIC SIGNAL</span>
                    <span style={{ color: isDrowsy?"#ff4444":"var(--color-green)" }}>
                      {isDrowsy ? "⚠ FATIGUE PATTERN DETECTED" : "● NORMAL"}
                    </span>
                  </div>
                </div>

                {/* Map */}
                <div style={{ height:360, marginTop:2, borderRadius:16, overflow:"hidden", border:"1px solid rgba(0,255,136,0.12)", boxShadow:"0 0 28px rgba(0,255,136,0.08)" }}>
                  <MapContainer center={position} zoom={13} style={{ height:"100%", width:"100%" }}>
                    <TileLayer
                      attribution='&copy; CARTO'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      className="map-tiles-dark"
                    />
                    {blink && (
                      <Marker position={position} icon={ambulanceIcon}>
                        <Popup>🚑 Ambulance Moving</Popup>
                      </Marker>
                    )}
                    <Polyline positions={[position, destination]} color="red" />
                    <Marker position={destination}>
                      <Popup>🚨 Accident Location</Popup>
                    </Marker>
                  </MapContainer>
                </div>

                {/* Stats row */}
                <div style={S.grid3}>
                  {[
                    { label:"Confidence",    value:active?`${aiData.confidence}%`:"—", color:"#00ff88" },
                    { label:"ETA Ambulance", value:eta||"—",                           color:"#00dd77" },
                    { label:"Alert Radius",  value:active?"200m":"—",                  color:"#ffcc00" },
                  ].map((s) => (
                    <div key={s.label} style={{ ...S.card(null), textAlign:"center", padding:"16px 12px" }}>
                      <div style={{ ...S.stat, fontSize:26, color:s.color }}>{s.value}</div>
                      <div style={S.statLabel}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div style={{ ...S.card(null), flex:1, overflow:"hidden" }}>
                  <div style={S.cardTitle}><span>⏱</span> Response Timeline</div>
                  <div style={{ maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column", gap:2 }}>
                    {logs.length===0 && <div style={{ color:"var(--color-text-dim)", fontSize:12, textAlign:"center", padding:20, fontFamily:"var(--font-mono)" }}>Awaiting event...</div>}
                    {logs.map((l,i) => (
                      <div key={i} style={S.logEntry}>
                        <span style={{ color:"rgba(0,255,136,0.4)", flexShrink:0 }}>{l.t}</span>
                        <span>{l.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Golden Hour Advisory — shown after resolution */}
                {phase === "resolved" && <GoldenHourMessage />}

              </div>

              {/* COL 3 — AI Panel + Dispatch */}
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

                {/* AI Analysis */}
                <div style={S.card("#4488ff")}>
                  <div style={S.cardTitle}><span>🤖</span> AI Analysis Engine</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <div>
                      <div style={S.statLabel}>Confidence Score</div>
                      <div style={{ ...S.stat, color:aiData.confidence>80?"#ff4444":aiData.confidence>50?"#ffcc00":"#00ff88" }}>{aiData.confidence}%</div>
                      <div style={S.progress}><div style={S.progressFill(aiData.confidence, aiData.confidence>80?"#ff4444":"#ffcc00")} /></div>
                    </div>
                    {[["Severity Prediction",aiData.severity],["False Alert",aiData.falseAlert],["Injury Risk",aiData.injury]].map(([k,v]) => (
                      <div key={k}>
                        <div style={{ fontSize:9, color:"var(--color-text-dim)", letterSpacing:1.5, textTransform:"uppercase", fontFamily:"var(--font-mono)" }}>{k}</div>
                        <div style={{ fontSize:13, color:"var(--color-text-main)", fontWeight:600, marginTop:1, fontFamily:"var(--font-primary)" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dispatch Status */}
                <div style={S.card(null)}>
                  <div style={S.cardTitle}><span>📡</span> Dispatch Status</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      { label:"🏥 Hospital", active:phase==="confirmed"||phase==="responding"||phase==="resolved", color:"#ff4444" },
                      { label:"🚑 Ambulance", active:ambulanceDispatched, color:"#00ff88" },
                      { label:"🚔 Police",    active:policeDispatched,    color:"#4488ff" },
                      { label:"📢 Community", active:communityAlert,      color:"#ffcc00" },
                    ].map((item) => (
                      <div key={item.label} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontFamily:"var(--font-primary)" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:item.active?item.color:"rgba(0,0,0,0.4)", border:`1px solid ${item.active?item.color:"rgba(255,255,255,0.06)"}`, boxShadow:item.active?`0 0 10px ${item.color}`:"none", transition:"all 0.5s", flexShrink:0 }} />
                        <span style={{ color:item.active?"var(--color-text-main)":"var(--color-text-dim)" }}>{item.label}</span>
                        <span style={{ marginLeft:"auto", fontSize:9, fontFamily:"var(--font-mono)", letterSpacing:1.5, color:item.active?item.color:"rgba(255,255,255,0.1)" }}>{item.active?"ACTIVE":"IDLE"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ambulance progress */}
                {ambulanceDispatched && (
                  <div style={S.card("#00ff88")}>
                    <div style={S.cardTitle}><span>🚑</span> Ambulance Route</div>
                    <div style={{ fontSize:11, color:"#c8e6c9", marginBottom:6, fontFamily:"var(--font-primary)" }}>Unit 7 — Progress</div>
                    <div style={S.progress}><div style={S.progressFill(ambulanceProgress,"#00ff88")} /></div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:9, fontFamily:"var(--font-mono)", color:"var(--color-text-dim)" }}>
                      <span>Hospital</span>
                      <span style={{ color:"#00ff88" }}>{ambulanceProgress}%</span>
                      <span>Scene</span>
                    </div>
                  </div>
                )}

                {/* Community Alert */}
                {communityAlert && (
                  <div style={{ ...S.card("#ffcc00"), animation:"pulse 1.5s ease infinite" }}>
                    <div style={S.cardTitle}><span>📢</span> Nearby Assistance</div>
                    <div style={{ fontSize:12, color:"#ffe066", lineHeight:1.6, fontFamily:"var(--font-primary)" }}>
                      ⚠️ Accident detected 200 meters ahead.<br />
                      First aid assistance requested.<br />
                      Please clear the road.
                    </div>
                    <div style={{ marginTop:8, fontSize:9, fontFamily:"var(--font-mono)", color:"var(--color-text-dim)" }}>Broadcast to 47 nearby devices</div>
                  </div>
                )}

                {/* Road Safety Tips */}
                <RoadSafetyPanel />

                {/* Sustainable Smart City label + Impact */}
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 14px", background:"rgba(0,255,136,0.05)", borderRadius:10, border:"1px solid rgba(0,255,136,0.1)" }}>
                  <span style={{ fontSize:14 }}>🌱</span>
                  <span style={{ fontSize:10, fontFamily:"var(--font-display)", letterSpacing:2, color:"var(--color-green)", textTransform:"uppercase" }}>Sustainable Smart City Solution</span>
                </div>
                <SustainabilityImpactPanel />

              </div>
            </div>
          )}

          {/* ── EMERGENCY SCREEN ── */}
          {screen === "emergency" && (
            <div style={{ ...S.body, gridTemplateColumns:"1fr 1fr" }}>

              {/* Incoming Alert */}
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ ...S.card("#ff3333"), animation:(phase==="confirmed"||phase==="responding")?"blink 1.5s ease infinite":"none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <SirenIcon active={phase==="confirmed"||phase==="responding"} />
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:active?"#ff4444":"var(--color-text-dim)", textTransform:"uppercase", letterSpacing:2.5, fontFamily:"var(--font-display)" }}>
                        {active ? "⚠ INCOMING EMERGENCY" : "NO ACTIVE ALERTS"}
                      </div>
                      <div style={{ fontSize:10, color:"var(--color-text-dim)", fontFamily:"var(--font-mono)", letterSpacing:1 }}>Emergency Control Center — Pune</div>
                    </div>
                  </div>

                  {active ? (
                    <>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      {[["Incident ID","#ACC-2024-0372"],["Vehicle","MH14-4587"],["Location","Pune-Blore Hwy"],["Severity",severity],["Time",logs[0]?.t||now()],["Status",phase.toUpperCase()],["Passengers",`${passengerCount} people`]].map(([k,v]) => (
                        <div key={k} style={{ background:"rgba(3,8,5,0.8)", borderRadius:8, padding:"8px 10px", border:"1px solid rgba(255,255,255,0.03)" }}>
                          <div style={{ fontSize:8, color:"rgba(0,255,136,0.3)", textTransform:"uppercase", letterSpacing:1.5, fontFamily:"var(--font-mono)" }}>{k}</div>
                          <div style={{ fontSize:12, color:k==="Severity"?(severity==="HIGH"?"#ff4444":severity==="MEDIUM"?"#ffcc00":"#00ff88"):k==="Passengers"?"#ffcc00":"var(--color-text-main)", fontWeight:600, marginTop:2, fontFamily:"var(--font-primary)" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Passenger Alert Info */}
                    <div style={{ marginTop:10, padding:"10px 14px", background:"rgba(255,204,0,0.06)", borderRadius:10, border:"1px solid rgba(255,204,0,0.15)", display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:20 }}>👥</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:"#ffcc00", fontFamily:"var(--font-display)", letterSpacing:1 }}>Passengers involved: {passengerCount} people</div>
                        <div style={{ fontSize:9, color:"rgba(255,204,0,0.5)", fontFamily:"var(--font-mono)", letterSpacing:1, marginTop:2 }}>This helps hospitals and ambulance teams prepare resources in advance</div>
                      </div>
                    </div>
                    </>
                  ) : (
                    <div style={{ textAlign:"center", padding:20, color:"var(--color-text-dim)", fontSize:12, fontFamily:"var(--font-mono)" }}>
                      Switch to Dashboard and simulate an accident to see emergency alerts here.
                    </div>
                  )}
                </div>

                {/* Dispatch controls */}
                <div style={S.card(null)}>
                  <div style={S.cardTitle}>Dispatch Controls</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <button onClick={() => { setAmbulanceDispatched(true); addLog("🚑 Manual ambulance dispatch"); addNotif("AMBULANCE DISPATCHED","Unit 7 on route","🚑","green"); }} style={{ ...S.btn("green"), justifyContent:"center", flexDirection:"column", padding:14 }}>
                      <span style={{ fontSize:20 }}>🚑</span>
                      <span>Dispatch Ambulance</span>
                      {ambulanceDispatched && <span style={{ fontSize:9, color:"#00ff88", fontFamily:"var(--font-mono)" }}>● DISPATCHED</span>}
                    </button>
                    <button onClick={() => { setPoliceDispatched(true); addLog("🚔 Manual police dispatch"); addNotif("POLICE DISPATCHED","Unit 3 on route","🚔","blue"); }} style={{ ...S.btn("blue"), justifyContent:"center", flexDirection:"column", padding:14 }}>
                      <span style={{ fontSize:20 }}>🚔</span>
                      <span>Notify Police</span>
                      {policeDispatched && <span style={{ fontSize:9, color:"#4488ff", fontFamily:"var(--font-mono)" }}>● DISPATCHED</span>}
                    </button>
                    <button onClick={() => setScreen("dashboard")} style={{ ...S.btn("gray"), justifyContent:"center", gridColumn:"span 2", padding:12 }}>
                      📋 View Full Dashboard
                    </button>
                  </div>
                </div>

                {/* Hospital Info */}
                <div style={S.card("#00ff88")}>
                  <div style={S.cardTitle}><span>🏥</span> Nearest Hospital</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[["Name","KEM Hospital, Pune"],["Distance","3.2 km"],["ETA Ambulance",eta||"—"],["ER Status","Available"],["Trauma Unit","Ready"],["Passengers",`${passengerCount} people`]].map(([k,v]) => (
                      <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12, borderBottom:"1px solid rgba(0,255,136,0.06)", paddingBottom:4, fontFamily:"var(--font-primary)" }}>
                        <span style={{ color:"var(--color-text-dim)" }}>{k}</span>
                        <span style={{ color:k==="ETA Ambulance"?"#00ff88":k==="Passengers"?"#ffcc00":"var(--color-text-main)", fontWeight:600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {/* Purpose text */}
                  <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(0,255,136,0.04)", borderRadius:8, border:"1px solid rgba(0,255,136,0.08)", fontSize:10, color:"rgba(0,255,136,0.6)", fontFamily:"var(--font-primary)", lineHeight:1.5, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:14, flexShrink:0 }}>ℹ️</span>
                    <span>This helps hospitals and ambulance teams prepare resources in advance</span>
                  </div>
                </div>
              </div>

              {/* Map + Logs */}
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ ...S.card("#00ff88"), height:300 }}>
                  <div style={S.cardTitle}><span>🗺</span> Incident Map</div>
                  <div style={{ height:"calc(100% - 28px)" }}>
                    <MapPanel active={active} ambulanceProgress={ambulanceProgress} />
                  </div>
                </div>

                <div style={{ ...S.card(null), flex:1 }}>
                  <div style={S.cardTitle}><span>📋</span> Notification Log</div>
                  <div style={{ maxHeight:280, overflowY:"auto" }}>
                    {logs.length===0 ? (
                      <div style={{ color:"var(--color-text-dim)", fontSize:12, textAlign:"center", padding:30, fontFamily:"var(--font-mono)" }}>No events recorded</div>
                    ) : (
                      logs.map((l,i) => (
                        <div key={i} style={{ ...S.logEntry, padding:"5px 0" }}>
                          <span style={{ color:"rgba(0,255,136,0.4)", flexShrink:0, fontSize:10 }}>{l.t}</span>
                          <span style={{ fontSize:12 }}>{l.msg}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ background:"rgba(2,8,4,0.9)", borderTop:"1px solid rgba(0,255,136,0.06)", padding:"10px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:9, fontFamily:"var(--font-mono)", color:"rgba(0,255,136,0.2)", flexWrap:"wrap", gap:8 }}>
            <span style={{ letterSpacing:2 }}>SAFEDRIVE-AI — SPPU PROTOTYPE</span>
            <span style={{ color:"rgba(0,255,136,0.22)", letterSpacing:1.2, fontStyle:"italic" }}>🌱 Educating drivers. Saving lives. Building sustainable cities.</span>
            <span style={{ color:"rgba(0,255,136,0.15)", letterSpacing:1 }}>{now()} IST ● PUNE TRAFFIC NETWORK</span>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR — Camera ── */}
        <div className="sidebar-panel" style={{ width:"22%", overflow:"auto" }}>
          <div className="sidebar-header">
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 8px #00ff88", animation:"blink 1.8s ease infinite" }} />
            LIVE CAMERA FEED
          </div>
          <Drowsiness setIsDrowsy={setIsDrowsy} isDrowsy={isDrowsy} />
        </div>
      </div>
    </>
  );
}
