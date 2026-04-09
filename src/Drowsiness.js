import React, { useEffect, useState, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const BEEP_COOLDOWN_MS      = 8000;   // min gap between audio alerts
const SUSTAINED_HIGH_FRAMES = 3;      // consecutive HIGH frames before beep
const SPEAK_COOLDOWN_MS     = 5000;   // min gap between voice alerts
const TICK_MS               = 1500;   // analysis tick rate

// Canvas sample region (relative to 160×120 thumbnail)
// Eye zone: horizontal centre, upper-third of face
const EYE_X = 45, EYE_Y = 28, EYE_W = 70, EYE_H = 26;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const DRW_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
.drw-root {
  font-family:'Share Tech Mono',monospace;
  background:linear-gradient(180deg,#010c06 0%,#000a04 100%);
  min-height:100vh; padding:14px 12px;
  display:flex; flex-direction:column; gap:10px;
  position:relative; overflow:hidden; color:#c8e6c9;
}
.drw-root::before {
  content:''; position:absolute; inset:0;
  background:
    repeating-linear-gradient(0deg,transparent,transparent 29px,rgba(0,255,136,0.022) 30px),
    repeating-linear-gradient(90deg,transparent,transparent 29px,rgba(0,255,136,0.022) 30px);
  pointer-events:none; z-index:0;
}
.drw-content { position:relative; z-index:1; display:flex; flex-direction:column; gap:10px; }

.drw-header { display:flex; align-items:center; gap:8px; padding-bottom:10px; border-bottom:1px solid rgba(0,255,136,0.1); }
.drw-title  { font-family:'Orbitron',monospace; font-size:9px; font-weight:900; letter-spacing:3px; color:#00ff88; text-transform:uppercase; text-shadow:0 0 16px rgba(0,255,136,0.65); flex:1; }
.drw-status-dot { width:6px; height:6px; border-radius:50%; background:#00ff88; box-shadow:0 0 8px #00ff88; animation:drwBlink 1.8s ease infinite; }
.drw-version { font-size:8px; color:rgba(0,255,136,0.3); letter-spacing:1px; }

/* Camera */
.drw-cam-wrap {
  position:relative; border-radius:10px; overflow:hidden; background:#000;
  border:1px solid rgba(0,255,136,0.22);
  box-shadow:0 0 28px rgba(0,255,136,0.07),inset 0 0 40px rgba(0,0,0,0.7);
  aspect-ratio:4/3; transition:border-color 0.4s ease, box-shadow 0.4s ease;
}
.drw-cam-wrap video {
  width:100% !important; height:100% !important; object-fit:cover; display:block;
  transform:scaleX(-1); filter:brightness(0.93) contrast(1.06) saturate(0.75);
}
.drw-cam-wrap.risk-high   { border-color:rgba(255,50,50,0.75);  box-shadow:0 0 36px rgba(255,0,0,0.4); }
.drw-cam-wrap.risk-medium { border-color:rgba(255,204,0,0.6);   box-shadow:0 0 22px rgba(255,204,0,0.25); }
.drw-no-cam {
  width:100%; height:100%; display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:8px; background:#010e05;
  font-size:10px; color:rgba(0,255,136,0.35); letter-spacing:2px; text-align:center;
}
.drw-scan {
  position:absolute; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent 0%,rgba(0,255,136,0.9) 50%,transparent 100%);
  box-shadow:0 0 12px rgba(0,255,136,0.7),0 0 30px rgba(0,255,136,0.2);
  animation:drwScan 2.5s linear infinite; pointer-events:none; z-index:8;
}
.drw-corner { position:absolute; width:14px; height:14px; border-color:rgba(0,255,136,0.85); border-style:solid; z-index:9; }
.drw-corner.tl { top:5px;    left:5px;  border-width:2px 0 0 2px; }
.drw-corner.tr { top:5px;   right:5px;  border-width:2px 2px 0 0; }
.drw-corner.bl { bottom:5px; left:5px;  border-width:0 0 2px 2px; }
.drw-corner.br { bottom:5px;right:5px;  border-width:0 2px 2px 0; }
.drw-facelock {
  position:absolute; top:50%; left:50%; transform:translate(-50%,-54%);
  width:72px; height:88px; border:1.5px solid rgba(0,255,136,0.55); border-radius:4px;
  box-shadow:0 0 14px rgba(0,255,136,0.18); animation:drwFacePulse 2s ease infinite;
  z-index:9; pointer-events:none;
}
.drw-facelock.alert { border-color:rgba(255,68,68,0.75); box-shadow:0 0 22px rgba(255,68,68,0.5); animation:drwFaceAlert 0.7s ease infinite; }
.drw-cam-overlay-vignette {
  position:absolute; inset:0;
  background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,0.55) 100%);
  pointer-events:none; z-index:7;
}
.drw-cam-grid {
  position:absolute; inset:0; z-index:6; pointer-events:none;
  background:
    repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(0,255,136,0.025) 20px),
    repeating-linear-gradient(90deg,transparent,transparent 19px,rgba(0,255,136,0.025) 20px);
}
.drw-cam-label { position:absolute; bottom:6px; left:8px;  font-size:8px; letter-spacing:2px; color:rgba(0,255,136,0.65); z-index:10; }
.drw-cam-rec   { position:absolute; top:7px;   right:9px;  display:flex; align-items:center; gap:4px; font-size:8px; color:#ff4444; letter-spacing:1.5px; z-index:10; }
.drw-rec-dot   { width:5px; height:5px; border-radius:50%; background:#ff4444; box-shadow:0 0 6px #ff4444; animation:drwBlink 1s ease infinite; }
.drw-hud-stats {
  position:absolute; bottom:22px; right:7px; z-index:10;
  font-size:7px; font-family:'Share Tech Mono',monospace; letter-spacing:1.2px;
  color:rgba(0,255,136,0.7); line-height:1.8;
  background:rgba(0,0,0,0.6); padding:4px 7px; border-radius:4px;
  border:1px solid rgba(0,255,136,0.12);
}

/* Trend indicator */
.drw-trend {
  display:flex; align-items:center; gap:6px;
  padding:4px 10px; border-radius:6px; font-size:9px; letter-spacing:1.5px;
  border:1px solid; transition:all 0.4s ease;
}
.drw-trend.up   { background:rgba(255,0,0,0.08);   border-color:rgba(255,68,68,0.35);  color:#ff6666; }
.drw-trend.down { background:rgba(0,255,136,0.05); border-color:rgba(0,255,136,0.2);   color:#00ff88; }
.drw-trend.flat { background:rgba(255,204,0,0.05); border-color:rgba(255,204,0,0.2);   color:#ffcc00; }

/* Fatigue bar */
.drw-fatigue-wrap { display:flex; flex-direction:column; gap:5px; }
.drw-fatigue-hdr  { display:flex; justify-content:space-between; font-size:8px; letter-spacing:2px; }
.drw-fatigue-track{ height:8px; background:rgba(255,255,255,0.04); border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.04); position:relative; }
.drw-fatigue-fill { height:100%; border-radius:4px; transition:width 0.8s ease, background 0.4s ease; }
.drw-fatigue-thresh {
  position:absolute; top:0; bottom:0; width:2px; background:rgba(255,255,255,0.2);
  z-index:2;
}

/* Live feed */
.drw-live-feed {
  background:rgba(0,0,0,0.3); border:1px solid rgba(0,255,136,0.07);
  border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:3px;
  max-height:90px; overflow-y:auto;
}
.drw-live-feed::-webkit-scrollbar { width:2px; }
.drw-live-feed::-webkit-scrollbar-thumb { background:rgba(0,255,136,0.15); }
.drw-feed-item {
  font-size:8px; letter-spacing:1px; line-height:1.6;
  display:flex; gap:6px; animation:drwFadeIn 0.3s ease;
  border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:2px;
}
.drw-feed-time { color:rgba(0,255,136,0.35); flex-shrink:0; }

/* Eyes */
.drw-eyes { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:6px; padding:4px 0; }
.drw-eye-box   { display:flex; flex-direction:column; align-items:center; gap:3px; }
.drw-eye-label { font-size:7px; letter-spacing:2px; color:rgba(0,255,136,0.4); text-transform:uppercase; }
.drw-eye-state { font-size:7px; letter-spacing:1.5px; transition:color 0.3s; }

/* Risk badge */
.drw-risk {
  border-radius:8px; padding:9px 12px; display:flex; align-items:center; gap:10px;
  font-family:'Orbitron',monospace; font-size:10px; font-weight:700; letter-spacing:2.5px;
  border:1px solid; transition:all 0.4s ease; position:relative; overflow:hidden;
}
.drw-risk::after {
  content:''; position:absolute; top:0; left:-100%; width:100%; height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);
  animation:drwShimmer 3s linear infinite;
}
.drw-risk.HIGH   { background:rgba(255,30,30,0.1);  border-color:rgba(255,50,50,0.65);  color:#ff4444; animation:drwDanger 0.9s ease infinite; }
.drw-risk.MEDIUM { background:rgba(255,204,0,0.08); border-color:rgba(255,204,0,0.5);   color:#ffcc00; animation:drwWarn 1.8s ease infinite; }
.drw-risk.LOW    { background:rgba(0,255,136,0.04); border-color:rgba(0,255,136,0.2);   color:#00ff88; }

/* Alert banner */
.drw-alert-banner {
  position:relative; overflow:hidden;
  background:rgba(255,0,0,0.13); border:1px solid rgba(255,50,50,0.75);
  border-radius:8px; padding:11px; text-align:center; color:#fff;
  font-family:'Orbitron',monospace; font-size:10px; font-weight:700; letter-spacing:1.5px;
  box-shadow:0 0 32px rgba(255,0,0,0.3); animation:drwDanger 0.8s ease infinite;
}
.drw-alert-banner::after {
  content:''; position:absolute; top:0; left:-100%; width:100%; height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,80,80,0.15),transparent);
  animation:drwShimmer 1.8s linear infinite;
}

/* Alert button */
.drw-alert-btn {
  background:rgba(0,255,136,0.08); border:1px solid rgba(0,255,136,0.3);
  color:#00ff88; border-radius:8px; padding:10px;
  font-family:'Orbitron',monospace; font-size:9px; letter-spacing:2px;
  cursor:pointer; width:100%; text-transform:uppercase; transition:all 0.3s ease;
}
.drw-alert-btn:hover { background:rgba(0,255,136,0.15); box-shadow:0 0 12px rgba(0,255,136,0.2); }

/* Bars */
.drw-bar-wrap  { display:flex; flex-direction:column; gap:4px; }
.drw-bar-header{ display:flex; justify-content:space-between; font-size:8px; color:rgba(255,255,255,0.22); letter-spacing:2px; }
.drw-bar-track { height:4px; background:rgba(255,255,255,0.04); border-radius:2px; overflow:hidden; border:1px solid rgba(255,255,255,0.03); }
.drw-bar-fill  { height:100%; border-radius:2px; transition:width 0.6s ease, background 0.4s ease; }

.drw-high-count {
  display:flex; align-items:center; justify-content:space-between;
  background:rgba(255,0,0,0.06); border:1px solid rgba(255,50,50,0.2);
  border-radius:6px; padding:5px 10px; font-size:8px; letter-spacing:1.5px; color:rgba(255,100,100,0.8);
}

/* Report */
.drw-report { background:rgba(0,255,136,0.02); border:1px solid rgba(0,255,136,0.07); border-radius:8px; padding:10px; }
.drw-report-hdr {
  font-size:8px; letter-spacing:3px; color:rgba(0,255,136,0.4); text-transform:uppercase;
  margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(0,255,136,0.07);
  display:flex; justify-content:space-between; align-items:center;
}
.drw-empty { color:rgba(255,255,255,0.1); font-size:9px; text-align:center; padding:8px 0; letter-spacing:2px; }
.drw-event { display:flex; gap:6px; align-items:baseline; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.025); animation:drwFadeIn 0.3s ease; font-size:9px; }
.drw-event-t { color:rgba(0,255,136,0.45); flex-shrink:0; }
.drw-event-s { color:#ffcc00; }
.drw-event-l { color:#ff5555; flex:1; text-align:right; }

.drw-emergency {
  background:rgba(160,0,0,0.22); border:1px solid rgba(200,0,0,0.65);
  border-radius:8px; padding:12px; text-align:center;
  font-family:'Orbitron',monospace; font-size:10px; font-weight:900; letter-spacing:2px; color:#fff;
  box-shadow:0 0 40px rgba(200,0,0,0.35); animation:drwEmergency 0.6s ease infinite;
}

/* Keyframes */
@keyframes drwBlink     { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes drwScan      { 0%{top:-3px} 100%{top:100%} }
@keyframes drwDanger    { 0%,100%{box-shadow:0 0 20px rgba(255,0,0,0.2)} 50%{box-shadow:0 0 38px rgba(255,0,0,0.52)} }
@keyframes drwWarn      { 0%,100%{box-shadow:0 0 15px rgba(255,204,0,0.15)} 50%{box-shadow:0 0 28px rgba(255,204,0,0.38)} }
@keyframes drwEmergency { 0%,100%{background:rgba(160,0,0,0.22)} 50%{background:rgba(200,0,0,0.38);box-shadow:0 0 60px rgba(255,0,0,0.6)} }
@keyframes drwShimmer   { 0%{left:-100%} 100%{left:100%} }
@keyframes drwFadeIn    { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }
@keyframes drwFacePulse { 0%,100%{opacity:0.55;border-color:rgba(0,255,136,0.55)} 50%{opacity:1;border-color:rgba(0,255,136,0.9)} }
@keyframes drwFaceAlert { 0%,100%{opacity:1;box-shadow:0 0 18px rgba(255,68,68,0.4)} 50%{opacity:0.7;box-shadow:0 0 36px rgba(255,68,68,0.8)} }
`;

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS ANALYSIS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function sampleBrightness(pixels, imgW, x, y, w, h) {
  let total = 0, count = 0;
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const idx = (py * imgW + px) * 4;
      total += (pixels[idx] * 0.299 + pixels[idx+1] * 0.587 + pixels[idx+2] * 0.114);
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

function frameDifference(curr, prev) {
  if (!prev || curr.length !== prev.length) return 0;
  let diff = 0;
  for (let i = 0; i < curr.length; i += 4) {
    diff += Math.abs(curr[i] - prev[i]);
  }
  return diff / (curr.length / 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function createBeep(ctx, freq, dur, vol) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.05);
}
function playAlertBeeps(ctx) {
  createBeep(ctx, 1200, 0.2, 0.45);
  setTimeout(() => createBeep(ctx, 900, 0.2, 0.45), 260);
  setTimeout(() => createBeep(ctx, 600, 0.3, 0.5),  520);
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE ALERTS
// ─────────────────────────────────────────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05; u.pitch = 1.0; u.volume = 0.9;
  window.speechSynthesis.speak(u);
}

// ─────────────────────────────────────────────────────────────────────────────
// EYE VISUALIZER
// ─────────────────────────────────────────────────────────────────────────────
function EyeViz({ closed, label }) {
  const c  = closed ? "#ff4444" : "#00ff88";
  const ry = closed ? 1.5 : 9;
  return (
    <div className="drw-eye-box">
      <div className="drw-eye-label">{label}</div>
      <svg width="54" height="30" viewBox="0 0 54 30">
        {!closed && [-9,-4,0,4,9].map((dx,i) => (
          <line key={i} x1={27+dx} y1={15-ry-1} x2={27+dx*0.7} y2={15-ry-5}
            stroke={c} strokeWidth="1" opacity="0.45" strokeLinecap="round" />
        ))}
        <ellipse cx="27" cy="15" rx="20" ry={ry}
          fill={`rgba(${closed?"255,50,50":"0,255,136"},0.06)`} stroke={c} strokeWidth="1.5"
          style={{ transition:"all 0.25s ease", filter:`drop-shadow(0 0 5px ${c})` }} />
        {!closed && (<>
          <circle cx="27" cy="15" r="5.5" fill={c} opacity="0.88" style={{ transition:"all 0.25s ease" }} />
          <circle cx="27" cy="15" r="2.5" fill="rgba(0,0,0,0.7)" />
          <circle cx="29" cy="13" r="1.8" fill="rgba(255,255,255,0.5)" />
        </>)}
        {closed && (
          <line x1="11" y1="15" x2="43" y2="15" stroke={c} strokeWidth="2" strokeLinecap="round"
            style={{ filter:"drop-shadow(0 0 6px #ff4444)" }} />
        )}
      </svg>
      <div className="drw-eye-state" style={{ color: closed ? "#ff4444" : "rgba(0,255,136,0.5)" }}>
        {closed ? "CLOSED" : "OPEN"}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK GAUGE
// ─────────────────────────────────────────────────────────────────────────────
function RiskGauge({ score, max = 8 }) {
  const pct   = Math.min(score / max, 1);
  const color = score >= 6 ? "#ff3333" : score >= 3 ? "#ffcc00" : "#00ff88";
  const arc   = 148, fill = pct * arc, angle = -90 + pct * 180;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
      <div style={{ fontSize:7, letterSpacing:2.5, color:"rgba(255,255,255,0.28)", fontFamily:"'Share Tech Mono',monospace", textTransform:"uppercase" }}>RISK SCORE</div>
      <svg width="110" height="68" viewBox="0 0 110 68">
        <defs><filter id="drwG4"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="9" strokeLinecap="round"/>
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke="rgba(0,255,136,0.12)"   strokeWidth="7" strokeLinecap="round" strokeDasharray="56 148"/>
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke="rgba(255,204,0,0.10)"   strokeWidth="7" strokeLinecap="round" strokeDasharray="56 92"  strokeDashoffset="-56"/>
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke="rgba(255,50,50,0.12)"   strokeWidth="7" strokeLinecap="round" strokeDasharray="37 111" strokeDashoffset="-111"/>
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke={color} strokeWidth="5"  strokeLinecap="round"
          strokeDasharray={`${fill} ${arc}`} filter="url(#drwG4)"
          style={{ transition:"stroke-dasharray 0.5s ease, stroke 0.4s ease" }}/>
        {[0,0.25,0.5,0.75,1].map((t,i)=>{
          const a=Math.PI-t*Math.PI;
          return <line key={i} x1={55+42*Math.cos(a)} y1={62+42*Math.sin(a)} x2={55+47*Math.cos(a)} y2={62+47*Math.sin(a)} stroke="rgba(255,255,255,0.18)" strokeWidth="1.2"/>;
        })}
        <g transform={`translate(55,62) rotate(${angle})`} style={{ transition:"transform 0.5s cubic-bezier(0.4,0,0.2,1)" }}>
          <line x1="0" y1="6" x2="0" y2="-40" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{ filter:`drop-shadow(0 0 4px ${color})` }}/>
          <polygon points="0,-40 -3,-30 3,-30" fill={color} opacity="0.85"/>
          <circle cx="0" cy="0" r="4.5" fill="#010c06" stroke={color} strokeWidth="1.8"/>
        </g>
        <text x="55" y="57" textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="18" fontWeight="900" fontFamily="'Orbitron',monospace"
          style={{ filter:`drop-shadow(0 0 8px ${color})`, transition:"fill 0.4s ease" }}>{score}</text>
        <text x="10" y="68" fill="rgba(0,255,136,0.3)" fontSize="7" fontFamily="'Share Tech Mono',monospace">LOW</text>
        <text x="84" y="68" fill="rgba(255,50,50,0.3)"  fontSize="7" fontFamily="'Share Tech Mono',monospace">HIGH</text>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Drowsiness({ setIsDrowsy, isDrowsy }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);   // hidden canvas for pixel analysis
  const audioCtx   = useRef(null);
  const prevPixels = useRef(null);   // previous frame pixels
  const baseEyeBrt = useRef(null);   // calibrated baseline eye brightness

  // Cooldown refs (not state — no re-render needed)
  const lastBeepTime  = useRef(0);
  const lastSpeakTime = useRef(0);
  const lastSpeakLvl  = useRef("LOW");
  const highStreakRef  = useRef(0);
  const emergencyRef   = useRef(false);

  // UI state
  const [camError,     setCamError]     = useState(false);
  const [fatigue,      setFatigue]      = useState(0);
  const [riskScore,    setRiskScore]    = useState(0);
  const [riskLevel,    setRiskLevel]    = useState("LOW");
  const [eyesClosed,   setEyesClosed]   = useState(false);
  const [motionVal,    setMotionVal]    = useState(0);
  const [eyeBrtVal,    setEyeBrtVal]    = useState(0);
  const [closedFrames, setClosedFrames] = useState(0);
  const [highStreak,   setHighStreak]   = useState(0);
  const [events,       setEvents]       = useState([]);
  const [highRiskCount,setHighRiskCount]= useState(0);
  const [frameCount,   setFrameCount]   = useState(0);
  const [trend,        setTrend]        = useState("flat");  // "up" | "down" | "flat"
  const [trendDelta,   setTrendDelta]   = useState(0);
  const [feedItems,    setFeedItems]    = useState([]);      // live status feed

  // ── Webcam ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream = null;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width:{ ideal:640 }, height:{ ideal:480 }, facingMode:"user" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () =>
            videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn("[Drowsiness] Camera denied:", err.message);
        setCamError(true);
      }
    }
    startCamera();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── Live feed helper ─────────────────────────────────────────────────────
  const addFeedItem = useCallback((icon, msg, color = "rgba(0,255,136,0.7)") => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12:false });
    setFeedItems(prev => [...prev.slice(-19), { icon, msg, color, time }]);
  }, []);

  // ── Speak helper (with cooldown + level dedup) ──────────────────────────
  const voiceAlert = useCallback((msg, level) => {
    const now = Date.now();
    if (now - lastSpeakTime.current < SPEAK_COOLDOWN_MS) return;
    if (level && level === lastSpeakLvl.current && level !== "HIGH") return; // don't repeat same level
    lastSpeakTime.current = now;
    lastSpeakLvl.current  = level || "LOW";
    speak(msg);
  }, []);

  // ── Beep helper ─────────────────────────────────────────────────────────
  const triggerBeep = useCallback(() => {
    const now = Date.now();
    if (now - lastBeepTime.current < BEEP_COOLDOWN_MS) return;
    lastBeepTime.current = now;
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.current.state === "suspended") audioCtx.current.resume().then(() => playAlertBeeps(audioCtx.current));
      else playAlertBeeps(audioCtx.current);
    } catch(e) {}
  }, []);

  // ── Canvas pixel analysis ────────────────────────────────────────────────
  const analyzeFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !video || video.readyState < 2) return null;

    const W = 160, H = 120;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Draw mirrored (to match CSS scaleX(-1))
    ctx.save();
    ctx.translate(W, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();

    const data = ctx.getImageData(0, 0, W, H);
    const px   = data.data;

    // Eye region brightness
    const eyeBrt = sampleBrightness(px, W, EYE_X, EYE_Y, EYE_W, EYE_H);

    // Inter-frame motion
    const motion = frameDifference(px, prevPixels.current);
    prevPixels.current = new Uint8ClampedArray(px);

    return { eyeBrt, motion };
  }, []);

  // ── Main detection loop ──────────────────────────────────────────────────
  useEffect(() => {
    let calibrationFrames = 0;
    let baseSum = 0;

    const interval = setInterval(() => {
      setFrameCount(f => f + 1);

      const result = analyzeFrame();

      setFatigue(prevFatigue => {
        let eyeClosed  = false;
        let headNod    = false;
        let motionNum  = 0;
        let eyeBrtNum  = 0;
        let reasons    = [];

        if (result) {
          const { eyeBrt, motion } = result;
          eyeBrtNum = eyeBrt;
          motionNum = motion;

          // Calibrate baseline eye brightness over first 5 frames
          if (calibrationFrames < 5) {
            baseSum += eyeBrt;
            calibrationFrames++;
            if (calibrationFrames === 5) {
              baseEyeBrt.current = baseSum / 5;
            }
          }

          const baseline = baseEyeBrt.current || eyeBrt;

          // Eye closure: brightness ABOVE baseline means skin (closed eye)
          // Threshold: 8% brighter than baseline
          const eyeDelta = eyeBrt - baseline;
          eyeClosed = eyeDelta > (baseline * 0.08);

          // Head nodding: motion above threshold but NOT too high (not just movement noise)
          headNod = motion > 4 && motion < 30;

          // Build reason strings
          if (eyeClosed)         reasons.push("eyes closing");
          if (headNod)           reasons.push("head movement");
          if (motion > 30)       reasons.push("sudden movement");
          if (prevFatigue > 60)  reasons.push("sustained fatigue");

          setEyeBrtVal(Math.round(eyeBrt));
          setMotionVal(Math.round(motion));
        } else {
          // Camera not ready — gentle simulated increment
          const gentle = Math.random() < 0.15;
          eyeClosed = gentle;
          if (gentle) reasons.push("no camera signal");
        }

        setEyesClosed(eyeClosed);

        // ── Fatigue model ──────────────────────────────────────────────
        let next = prevFatigue;
        let delta = 0;

        // Base time-based fatigue buildup (very slow)
        delta += 0.8;

        // Eye closure adds fatigue
        if (eyeClosed) {
          delta += 5;
        } else {
          // Open eyes bleed off fatigue
          delta -= 3.5;
        }

        // Head nod adds fatigue
        if (headNod) delta += 3;

        // Very high motion (sudden jerk) is alerting — reduce fatigue slightly
        if (motionNum > 30) delta -= 2;

        next = Math.max(0, Math.min(100, next + delta));

        // ── Trend ─────────────────────────────────────────────────────
        const roundDelta = Math.round(delta * 10) / 10;
        setTrendDelta(roundDelta);
        const newTrend = Math.abs(delta) < 1.5 ? "flat" : delta > 0 ? "up" : "down";
        setTrend(newTrend);

        // ── Risk score from fatigue ────────────────────────────────────
        const score = Math.min(8, Math.round((next / 100) * 8));
        setRiskScore(score);
        const level = score >= 6 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW";
        setRiskLevel(level);
        const drowsy = score >= 5;
        setIsDrowsy(drowsy);

        setClosedFrames(prev => eyeClosed ? prev + 1 : 0);

        // ── Voice + feed logic ─────────────────────────────────────────
        // Announce meter going UP
        if (delta >= 4 && reasons.length > 0) {
          const reason = reasons[0];
          addFeedItem("↑", `Risk rising — ${reason} (${roundDelta > 0 ? "+" : ""}${roundDelta.toFixed(1)})`, "#ff8888");
          if (level === "MEDIUM" && lastSpeakLvl.current !== "MEDIUM") {
            voiceAlert("Caution. Drowsiness meter rising. Medium risk detected.", "MEDIUM");
          }
        } else if (delta < -2) {
          addFeedItem("↓", `Fatigue easing — eyes open detected`, "#00ff88");
        }

        // Level-change voice announcements
        if (level === "HIGH" && lastSpeakLvl.current !== "HIGH") {
          voiceAlert("Warning! High risk detected. Driver fatigue is critical. Please take a break.", "HIGH");
          addFeedItem("🔴", "HIGH RISK threshold crossed — beep armed", "#ff4444");
        }
        if (level === "LOW" && lastSpeakLvl.current !== "LOW" && lastSpeakLvl.current !== null) {
          voiceAlert("Risk level normal. Stay alert.", "LOW");
          addFeedItem("✅", "Risk returned to LOW — good", "#00ff88");
        }

        // ── Beep on sustained HIGH streak ─────────────────────────────
        if (level === "HIGH") {
          highStreakRef.current++;
          setHighStreak(highStreakRef.current);
          if (highStreakRef.current >= SUSTAINED_HIGH_FRAMES) {
            triggerBeep();
            voiceAlert("Alert! Sustained high drowsiness. Please take a break immediately.", "HIGH");
            addFeedItem("🔔", `BEEP fired — ${highStreakRef.current} consecutive HIGH frames`, "#ff4444");
            setHighRiskCount(hrc => {
              const nxt = hrc + 1;
              if (nxt >= 3 && !emergencyRef.current) emergencyRef.current = true;
              return nxt;
            });
            setEvents(ev => [...ev, { time: new Date().toLocaleTimeString(), score, level:"HIGH" }]);
            highStreakRef.current = 0; // reset after beep so it doesn't fire every tick
          }
        } else {
          highStreakRef.current = 0;
          setHighStreak(0);
        }

        return next;
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzeFrame, addFeedItem, voiceAlert, triggerBeep]);

  // ── Manual reset ─────────────────────────────────────────────────────────
  const handleReset = () => {
    setFatigue(0); setHighStreak(0); setEyesClosed(false);
    setClosedFrames(0); setRiskScore(0); setRiskLevel("LOW");
    setIsDrowsy(false); setTrend("flat"); setTrendDelta(0);
    highStreakRef.current = 0; emergencyRef.current = false;
    lastSpeakLvl.current = "LOW"; baseEyeBrt.current = null;
    addFeedItem("✅", "Driver confirmed alert — fatigue reset to 0", "#00ff88");
    speak("Driver confirmed alert. Monitoring resumed.");
  };

  const fatigueColor = fatigue > 66 ? "#ff4444" : fatigue > 33 ? "#ffcc00" : "#00ff88";
  const camClass     = `drw-cam-wrap${riskLevel==="HIGH"?" risk-high":riskLevel==="MEDIUM"?" risk-medium":""}`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden canvas for pixel analysis */}
      <canvas ref={canvasRef} style={{ display:"none" }} />
      <style>{DRW_CSS}</style>

      <div className="drw-root">
        <div className="drw-content">

          {/* Header */}
          <div className="drw-header">
            <div className="drw-status-dot" />
            <div className="drw-title">DRIVER MONITORING</div>
            <div className="drw-version">v4.0</div>
          </div>

          {/* Camera */}
          <div className={camClass}>
            <video ref={videoRef} autoPlay muted playsInline style={{ display:camError?"none":"block" }} />
            {camError && (
              <div className="drw-no-cam">
                <span style={{ fontSize:28 }}>📷</span>
                <span>Camera access denied</span>
                <span style={{ fontSize:8, opacity:0.5 }}>Allow camera in browser settings</span>
              </div>
            )}
            <div className="drw-cam-grid" />
            <div className="drw-cam-overlay-vignette" />
            <div className="drw-scan" />
            <div className={`drw-facelock ${isDrowsy?"alert":""}`} />
            <div className="drw-corner tl" /><div className="drw-corner tr" />
            <div className="drw-corner bl" /><div className="drw-corner br" />
            <div className="drw-cam-label">CAM‑01 ● LIVE</div>
            <div className="drw-cam-rec"><div className="drw-rec-dot" />REC</div>
            <div className="drw-hud-stats">
              <div>EYE BRT: {eyeBrtVal}</div>
              <div>MOTION: {motionVal}</div>
              <div>FTGUE: {fatigue.toFixed(0)}%</div>
              <div style={{ color: isDrowsy?"#ff4444":"rgba(0,255,136,0.7)" }}>
                {isDrowsy?"⚠ DROWSY":"● ALERT"}
              </div>
            </div>
          </div>

          {/* Trend indicator */}
          <div className={`drw-trend ${trend}`}>
            <span style={{ fontSize:14 }}>
              {trend==="up" ? "↑" : trend==="down" ? "↓" : "→"}
            </span>
            <span>
              {trend==="up"
                ? `Risk RISING  (+${Math.abs(trendDelta).toFixed(1)} pts)`
                : trend==="down"
                ? `Risk FALLING (−${Math.abs(trendDelta).toFixed(1)} pts)`
                : "Risk STABLE"}
            </span>
            <span style={{ marginLeft:"auto", fontSize:7, opacity:0.6 }}>
              {trend==="up" ? "FATIGUE BUILDING" : trend==="down" ? "RECOVERING" : "STEADY"}
            </span>
          </div>

          {/* Fatigue bar */}
          <div className="drw-fatigue-wrap">
            <div className="drw-fatigue-hdr">
              <span style={{ color:"rgba(255,255,255,0.22)", letterSpacing:2 }}>DRIVER FATIGUE</span>
              <span style={{ color:fatigueColor }}>{fatigue.toFixed(0)}%</span>
            </div>
            <div className="drw-fatigue-track">
              <div className="drw-fatigue-fill" style={{
                width:`${fatigue}%`,
                background:`linear-gradient(90deg,#00ff88,${fatigueColor})`,
                boxShadow:`0 0 8px ${fatigueColor}88`,
              }} />
              {/* Threshold markers */}
              <div className="drw-fatigue-thresh" style={{ left:"37.5%" }} title="MEDIUM threshold" />
              <div className="drw-fatigue-thresh" style={{ left:"75%" }}   title="HIGH threshold" />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:7, color:"rgba(255,255,255,0.18)", letterSpacing:1 }}>
              <span>0%</span>
              <span style={{ marginLeft:"35%" }}>⬆ MED</span>
              <span>⬆ HIGH</span>
              <span>100%</span>
            </div>
          </div>

          {/* Eye visualiser + Risk gauge */}
          <div className="drw-eyes">
            <EyeViz closed={eyesClosed} label="LEFT EYE" />
            <RiskGauge score={riskScore} />
            <EyeViz closed={eyesClosed} label="RIGHT EYE" />
          </div>

          {/* Risk level badge */}
          <div className={`drw-risk ${riskLevel}`}>
            <span style={{ fontSize:14 }}>{riskLevel==="HIGH"?"⚠":riskLevel==="MEDIUM"?"◈":"●"}</span>
            <span>{riskLevel} RISK</span>
            {riskLevel==="HIGH" && highStreak > 0 && (
              <span style={{ marginLeft:8, fontSize:8, padding:"1px 6px", background:"rgba(255,0,0,0.2)", border:"1px solid #ff4444", borderRadius:3 }}>
                STREAK {highStreak}/{SUSTAINED_HIGH_FRAMES}
              </span>
            )}
            <span style={{ marginLeft:"auto", fontSize:7, opacity:0.55 }}>
              SCORE {riskScore}/8
            </span>
          </div>

          {/* Eye closure bar */}
          <div className="drw-bar-wrap">
            <div className="drw-bar-header">
              <span>EYE CLOSURE FRAMES</span>
              <span>{closedFrames}</span>
            </div>
            <div className="drw-bar-track">
              <div className="drw-bar-fill" style={{
                width:`${Math.min(closedFrames*25,100)}%`,
                background:closedFrames>3?"linear-gradient(90deg,#ffcc00,#ff4444)":"linear-gradient(90deg,#00ff88,#00cc66)",
                boxShadow:`0 0 6px ${closedFrames>3?"#ff4444":"#00ff88"}`,
              }} />
            </div>
          </div>

          {/* Drowsiness alert banner */}
          {isDrowsy && (
            <div className="drw-alert-banner">
              ⚠&nbsp;&nbsp;DROWSINESS DETECTED — ALERT ACTIVE&nbsp;&nbsp;🚨
            </div>
          )}

          {/* Live status feed */}
          <div style={{ fontSize:8, color:"rgba(255,255,255,0.2)", letterSpacing:2, marginBottom:2 }}>LIVE STATUS FEED</div>
          <div className="drw-live-feed">
            {feedItems.length === 0 ? (
              <div style={{ color:"rgba(255,255,255,0.1)", fontSize:8, textAlign:"center", padding:"4px 0" }}>
                Calibrating — monitoring started...
              </div>
            ) : (
              [...feedItems].reverse().map((item, i) => (
                <div key={i} className="drw-feed-item">
                  <span className="drw-feed-time">{item.time}</span>
                  <span style={{ color:"rgba(255,255,255,0.5)", flexShrink:0 }}>{item.icon}</span>
                  <span style={{ color: item.color }}>{item.msg}</span>
                </div>
              ))
            )}
          </div>

          {/* I'm Alert button */}
          <button className="drw-alert-btn" onClick={handleReset}>
            ✅ I'M ALERT — RESET FATIGUE METER
          </button>

          {/* High risk counter */}
          {highRiskCount > 0 && (
            <div className="drw-high-count">
              <span>BEEP ALERTS FIRED</span>
              <span style={{ color:highRiskCount>=3?"#ff4444":"#ff8844" }}>{highRiskCount} / 3</span>
            </div>
          )}

          {/* Event log */}
          <div className="drw-report">
            <div className="drw-report-hdr">
              <span>BEEP EVENT LOG</span>
              <span style={{ color:"rgba(0,255,136,0.3)" }}>{events.length} EVENTS</span>
            </div>
            {events.length===0 ? (
              <div className="drw-empty">NO ALERTS YET — MONITORING</div>
            ) : (
              events.slice(-5).map((e,i) => (
                <div key={i} className="drw-event">
                  <span className="drw-event-t">{e.time}</span>
                  <span className="drw-event-s">S:{e.score}</span>
                  <span className="drw-event-l">{e.level}</span>
                </div>
              ))
            )}
          </div>

          {/* Emergency */}
          {highRiskCount >= 3 && (
            <div className="drw-emergency">
              🚑 EMERGENCY TRIGGERED
              <br/>
              <span style={{ fontSize:8, fontWeight:400, letterSpacing:1, opacity:0.7 }}>
                ASSISTANCE REQUIRED — UNIT DISPATCHED
              </span>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
