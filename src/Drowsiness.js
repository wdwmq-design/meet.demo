import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL-ONLY STYLES — injected via <style> tag, zero logic
// ─────────────────────────────────────────────────────────────────────────────
const DRW_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

.drw-root {
  font-family: 'Share Tech Mono', monospace;
  background: linear-gradient(180deg, #010c06 0%, #000a04 100%);
  min-height: 100vh;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  overflow: hidden;
  color: #c8e6c9;
}
.drw-root::before {
  content: '';
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(0,255,136,0.022) 30px),
    repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(0,255,136,0.022) 30px);
  pointer-events: none; z-index: 0;
}
.drw-content { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; }

/* Header */
.drw-header {
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0,255,136,0.1);
}
.drw-title {
  font-family: 'Orbitron', monospace;
  font-size: 9px; font-weight: 900; letter-spacing: 3px;
  color: #00ff88; text-transform: uppercase;
  text-shadow: 0 0 16px rgba(0,255,136,0.65); flex: 1;
}
.drw-status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #00ff88; box-shadow: 0 0 8px #00ff88;
  animation: drwBlink 1.8s ease infinite;
}
.drw-version { font-size: 8px; color: rgba(0,255,136,0.3); letter-spacing: 1px; }

/* Camera */
.drw-cam-wrap {
  position: relative; border-radius: 10px;
  overflow: hidden; background: #000;
  border: 1px solid rgba(0,255,136,0.22);
  box-shadow: 0 0 28px rgba(0,255,136,0.07), inset 0 0 40px rgba(0,0,0,0.7);
  aspect-ratio: 4/3;
}
.drw-cam-wrap video {
  width: 100% !important; height: 100% !important;
  object-fit: cover; display: block;
  filter: brightness(0.9) contrast(1.08) saturate(0.65) hue-rotate(8deg);
}
.drw-scan {
  position: absolute; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent 0%, rgba(0,255,136,0.9) 50%, transparent 100%);
  box-shadow: 0 0 12px rgba(0,255,136,0.7), 0 0 30px rgba(0,255,136,0.2);
  animation: drwScan 2.5s linear infinite;
  pointer-events: none; z-index: 8;
}
.drw-corner { position: absolute; width: 14px; height: 14px; border-color: rgba(0,255,136,0.85); border-style: solid; z-index: 7; }
.drw-corner.tl { top: 5px; left: 5px; border-width: 2px 0 0 2px; }
.drw-corner.tr { top: 5px; right: 5px; border-width: 2px 2px 0 0; }
.drw-corner.bl { bottom: 5px; left: 5px; border-width: 0 0 2px 2px; }
.drw-corner.br { bottom: 5px; right: 5px; border-width: 0 2px 2px 0; }
.drw-reticle {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -55%);
  width: 72px; height: 72px;
  border: 1px solid rgba(0,255,136,0.22); border-radius: 50%;
  animation: drwReticle 2.5s ease infinite; z-index: 7;
}
.drw-reticle::before, .drw-reticle::after {
  content: ''; position: absolute;
  background: rgba(0,255,136,0.3);
}
.drw-reticle::before { top: 50%; left: -8px; width: 6px; height: 1px; margin-top: -0.5px; }
.drw-reticle::after  { top: -8px; left: 50%; width: 1px; height: 6px; margin-left: -0.5px; }
.drw-cam-label {
  position: absolute; bottom: 6px; left: 8px;
  font-size: 8px; letter-spacing: 2px; color: rgba(0,255,136,0.6); z-index: 9;
}
.drw-cam-rec {
  position: absolute; top: 7px; right: 9px;
  display: flex; align-items: center; gap: 4px;
  font-size: 8px; color: #ff4444; letter-spacing: 1.5px; z-index: 9;
}
.drw-rec-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #ff4444; box-shadow: 0 0 6px #ff4444;
  animation: drwBlink 1s ease infinite;
}
.drw-cam-overlay-vignette {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%);
  pointer-events: none; z-index: 6;
}

/* Eye row */
.drw-eyes { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 6px; padding: 4px 0; }
.drw-eye-box { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.drw-eye-label { font-size: 7px; letter-spacing: 2px; color: rgba(0,255,136,0.4); text-transform: uppercase; }
.drw-eye-state { font-size: 7px; letter-spacing: 1.5px; transition: color 0.3s; }

/* Risk badge */
.drw-risk {
  border-radius: 8px; padding: 9px 12px;
  display: flex; align-items: center; gap: 10px;
  font-family: 'Orbitron', monospace; font-size: 10px; font-weight: 700; letter-spacing: 2.5px;
  border: 1px solid; transition: all 0.4s ease; position: relative; overflow: hidden;
}
.drw-risk::after {
  content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
  animation: drwShimmer 3s linear infinite;
}
.drw-risk.HIGH {
  background: rgba(255,30,30,0.1); border-color: rgba(255,50,50,0.65);
  color: #ff4444; box-shadow: 0 0 22px rgba(255,0,0,0.2);
  animation: drwDanger 0.9s ease infinite;
}
.drw-risk.MEDIUM {
  background: rgba(255,204,0,0.08); border-color: rgba(255,204,0,0.5);
  color: #ffcc00; box-shadow: 0 0 15px rgba(255,204,0,0.15);
  animation: drwWarn 1.8s ease infinite;
}
.drw-risk.LOW {
  background: rgba(0,255,136,0.04); border-color: rgba(0,255,136,0.2);
  color: #00ff88;
}

/* Alert banner */
.drw-alert-banner {
  position: relative; overflow: hidden;
  background: rgba(255,0,0,0.13); border: 1px solid rgba(255,50,50,0.75);
  border-radius: 8px; padding: 11px;
  text-align: center; color: #fff;
  font-family: 'Orbitron', monospace; font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
  box-shadow: 0 0 32px rgba(255,0,0,0.3);
  animation: drwDanger 0.8s ease infinite;
}
.drw-alert-banner::after {
  content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,80,80,0.15), transparent);
  animation: drwShimmer 1.8s linear infinite;
}

/* Bars */
.drw-bar-wrap { display: flex; flex-direction: column; gap: 4px; }
.drw-bar-header { display: flex; justify-content: space-between; font-size: 8px; color: rgba(255,255,255,0.22); letter-spacing: 2px; }
.drw-bar-track { height: 4px; background: rgba(255,255,255,0.04); border-radius: 2px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03); }
.drw-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease, background 0.4s ease; }

/* High risk count */
.drw-high-count {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255,0,0,0.06); border: 1px solid rgba(255,50,50,0.2);
  border-radius: 6px; padding: 5px 10px;
  font-size: 8px; letter-spacing: 1.5px; color: rgba(255,100,100,0.8);
}

/* Report */
.drw-report { background: rgba(0,255,136,0.02); border: 1px solid rgba(0,255,136,0.07); border-radius: 8px; padding: 10px; }
.drw-report-hdr {
  font-size: 8px; letter-spacing: 3px; color: rgba(0,255,136,0.4); text-transform: uppercase;
  margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(0,255,136,0.07);
  display: flex; justify-content: space-between; align-items: center;
}
.drw-empty { color: rgba(255,255,255,0.1); font-size: 9px; text-align: center; padding: 8px 0; letter-spacing: 2px; }
.drw-event { display: flex; gap: 6px; align-items: baseline; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.025); animation: drwFadeIn 0.3s ease; font-size: 9px; }
.drw-event-t { color: rgba(0,255,136,0.45); flex-shrink: 0; }
.drw-event-s { color: #ffcc00; }
.drw-event-l { color: #ff5555; flex: 1; text-align: right; }

/* Emergency */
.drw-emergency {
  background: rgba(160,0,0,0.22); border: 1px solid rgba(200,0,0,0.65);
  border-radius: 8px; padding: 12px; text-align: center;
  font-family: 'Orbitron', monospace; font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #fff;
  box-shadow: 0 0 40px rgba(200,0,0,0.35);
  animation: drwEmergency 0.6s ease infinite;
}

/* Keyframes */
@keyframes drwBlink    { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes drwScan     { 0%{top:-3px} 100%{top:100%} }
@keyframes drwReticle  { 0%,100%{opacity:0.3;transform:translate(-50%,-55%) scale(1)} 50%{opacity:0.75;transform:translate(-50%,-55%) scale(1.12)} }
@keyframes drwDanger   { 0%,100%{box-shadow:0 0 20px rgba(255,0,0,0.2)} 50%{box-shadow:0 0 38px rgba(255,0,0,0.52)} }
@keyframes drwWarn     { 0%,100%{box-shadow:0 0 15px rgba(255,204,0,0.15)} 50%{box-shadow:0 0 28px rgba(255,204,0,0.38)} }
@keyframes drwEmergency{ 0%,100%{background:rgba(160,0,0,0.22);box-shadow:0 0 40px rgba(200,0,0,0.35)} 50%{background:rgba(200,0,0,0.38);box-shadow:0 0 60px rgba(255,0,0,0.6)} }
@keyframes drwShimmer  { 0%{left:-100%} 100%{left:100%} }
@keyframes drwFadeIn   { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }
`;

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL-ONLY SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function EyeViz({ closed, label }) {
  const c   = closed ? "#ff4444" : "#00ff88";
  const ry  = closed ? 1.5 : 9;

  return (
    <div className="drw-eye-box">
      <div className="drw-eye-label">{label}</div>
      <svg width="54" height="30" viewBox="0 0 54 30">
        {/* top lashes */}
        {!closed && [-9,-4,0,4,9].map((dx,i) => (
          <line key={i}
            x1={27+dx} y1={15-ry-1} x2={27+dx*0.7} y2={15-ry-5}
            stroke={c} strokeWidth="1" opacity="0.45" strokeLinecap="round"
          />
        ))}
        {/* eyeball */}
        <ellipse cx="27" cy="15" rx="20" ry={ry}
          fill={`rgba(${closed?"255,50,50":"0,255,136"},0.06)`}
          stroke={c} strokeWidth="1.5"
          style={{ transition:"all 0.25s ease", filter:`drop-shadow(0 0 5px ${c})` }}
        />
        {!closed && (
          <>
            {/* iris */}
            <circle cx="27" cy="15" r="5.5" fill={c} opacity="0.88"
              style={{ transition:"all 0.25s ease" }}
            />
            {/* pupil */}
            <circle cx="27" cy="15" r="2.5" fill="rgba(0,0,0,0.7)" />
            {/* specular */}
            <circle cx="29" cy="13" r="1.8" fill="rgba(255,255,255,0.5)" />
            {/* iris lines */}
            {[0,60,120,180,240,300].map((a,i)=>{
              const rad = a*Math.PI/180;
              return(
                <line key={i}
                  x1={27+3*Math.cos(rad)} y1={15+3*Math.sin(rad)}
                  x2={27+5*Math.cos(rad)} y2={15+5*Math.sin(rad)}
                  stroke="rgba(0,0,0,0.25)" strokeWidth="0.5"
                />
              );
            })}
          </>
        )}
        {closed && (
          <line x1="11" y1="15" x2="43" y2="15"
            stroke={c} strokeWidth="2" strokeLinecap="round"
            style={{ filter:"drop-shadow(0 0 6px #ff4444)" }}
          />
        )}
      </svg>
      <div className="drw-eye-state" style={{ color: closed ? "#ff4444" : "rgba(0,255,136,0.5)" }}>
        {closed ? "CLOSED" : "OPEN"}
      </div>
    </div>
  );
}

function RiskGauge({ score, max = 8 }) {
  const pct   = Math.min(score / max, 1);
  const color = score >= 6 ? "#ff3333" : score >= 3 ? "#ffcc00" : "#00ff88";
  // Semicircle: centre(55,62), r=47 → M 8 62 A 47 47 0 0 1 102 62
  // Arc length = π*47 ≈ 148
  const arcLen  = 148;
  const fillLen = pct * arcLen;
  // Needle: –90° (left) → +90° (right)
  const needleAngle = -90 + pct * 180;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
      <div style={{ fontSize:7, letterSpacing:2.5, color:"rgba(255,255,255,0.28)", fontFamily:"'Share Tech Mono',monospace", textTransform:"uppercase" }}>
        RISK SCORE
      </div>
      <svg width="110" height="68" viewBox="0 0 110 68">
        <defs>
          <filter id="drwGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Zone background arcs */}
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="9" strokeLinecap="round"/>
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke="rgba(0,255,136,0.12)"   strokeWidth="7" strokeLinecap="round" strokeDasharray="56 148"/>
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke="rgba(255,204,0,0.10)"   strokeWidth="7" strokeLinecap="round" strokeDasharray="56 92" strokeDashoffset="-56"/>
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke="rgba(255,50,50,0.12)"   strokeWidth="7" strokeLinecap="round" strokeDasharray="37 111" strokeDashoffset="-111"/>

        {/* Active fill */}
        <path d="M 8 62 A 47 47 0 0 1 102 62" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${fillLen} ${arcLen}`}
          filter="url(#drwGlow)"
          style={{ transition:"stroke-dasharray 0.5s ease, stroke 0.4s ease" }}
        />

        {/* Tick marks */}
        {[0,0.25,0.5,0.75,1].map((t,i)=>{
          const a = (-90 + (-90 + t*180)) * Math.PI/180; // mapping to semicircle
          // Actually tick marks along the arc: angle from -90 to +90 → in SVG coords +90 to -90 around centre(55,62)
          const svgA = (Math.PI) - t * Math.PI; // 180° to 0° = left to right
          const r1=42, r2=47;
          const tx1 = 55 + r1*Math.cos(svgA), ty1 = 62 + r1*Math.sin(svgA);
          const tx2 = 55 + r2*Math.cos(svgA), ty2 = 62 + r2*Math.sin(svgA);
          return <line key={i} x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="rgba(255,255,255,0.18)" strokeWidth="1.2"/>;
        })}

        {/* Needle */}
        <g transform={`translate(55,62) rotate(${needleAngle})`}
          style={{ transition:"transform 0.5s cubic-bezier(0.4,0,0.2,1)" }}>
          <line x1="0" y1="6" x2="0" y2="-40"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"
            style={{ filter:`drop-shadow(0 0 4px ${color})` }}
          />
          <polygon points="0,-40 -3,-30 3,-30" fill={color} opacity="0.85"/>
          <circle cx="0" cy="0" r="4.5" fill="#010c06" stroke={color} strokeWidth="1.8"/>
        </g>

        {/* Score */}
        <text x="55" y="57" textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="18" fontWeight="900" fontFamily="'Orbitron',monospace"
          style={{ filter:`drop-shadow(0 0 8px ${color})`, transition:"fill 0.4s ease" }}
        >{score}</text>

        {/* Labels */}
        <text x="10" y="68" fill="rgba(0,255,136,0.3)" fontSize="7" fontFamily="'Share Tech Mono',monospace">LOW</text>
        <text x="84" y="68" fill="rgba(255,50,50,0.3)"  fontSize="7" fontFamily="'Share Tech Mono',monospace">HIGH</text>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT — ALL ORIGINAL LOGIC PRESERVED EXACTLY
// ─────────────────────────────────────────────────────────────────────────────
export default function Drowsiness({ setIsDrowsy, isDrowsy }) {
  const videoRef = useRef();
  const audioRef = useRef(null);
  const alarmTimeoutRef = useRef(null);
  const isAlarmPlaying = useRef(false);
  const emergencyTriggeredRef = useRef(false);
  const [closedFrames, setClosedFrames] = useState(0);

  const [riskScore, setRiskScore] = useState(0);

  const [riskLevel, setRiskLevel] = useState("LOW");

  const [events, setEvents] = useState([]);

  const [highRiskCount, setHighRiskCount] = useState(0);

  useEffect(() => {
    console.log("[Drowsiness] useEffect mount");
    startCamera();
    loadModels().then(() => {
      console.log("[Drowsiness] Models loaded");
      startDetection();
    }).catch((err) => {
      console.error("[Drowsiness] Model load failed", err);
    });
  }, []);

  const startCamera = () => {
    console.log("[Drowsiness] startCamera called");
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log("[Drowsiness] Camera stream assigned");
          videoRef.current.onloadedmetadata = () => {
            console.log("[Drowsiness] video readyState", videoRef.current.readyState);
            videoRef.current.play().catch((err) => console.error("[Drowsiness] video play error", err));
          };
        } else {
          console.warn("[Drowsiness] videoRef.current missing");
        }
      })
      .catch((err) => {
        console.error("[Drowsiness] camera permission or error", err);
      });
  };

  const loadModels = async () => {
    console.log("[Drowsiness] loadModels called");
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  };

  const startDetection = () => {
    console.log("[Drowsiness] startDetection started");
    setInterval(async () => {
      if (!(videoRef.current && videoRef.current.readyState >= 2)) {
        console.log("[Drowsiness] video not ready", videoRef.current?.readyState);
        return;
      }

      try {
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks();

        console.log("[Drowsiness] detections", detections.length);

        if (detections.length > 0) {
          const landmarks = detections[0].landmarks;
          const nose = landmarks.getNose();

          const noseTop = nose[0];
          const noseBottom = nose[3];

          const headTilt = Math.abs(noseTop.y - noseBottom.y);

          console.log("Head tilt:", headTilt);
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();

          const leftEyeHeight = leftEye[1].y - leftEye[5].y;
          const rightEyeHeight = rightEye[1].y - rightEye[5].y;

          let score = 0;

          if (leftEyeHeight < 5 && rightEyeHeight < 5) {
            setClosedFrames(prev => prev + 1);
            score += 3;
          } else {
            setClosedFrames(0);
          }

          if (closedFrames > 3) {
            score += 3;
          }

          if (headTilt < 20) {
            score += 2;
          }

          setRiskScore(score);

          console.log("Risk Score:", score);

          if (score >= 6) {
            setRiskLevel("HIGH");
          } else if (score >= 3) {
            setRiskLevel("MEDIUM");
          } else {
            setRiskLevel("LOW");
          }

          if (score >= 5) {
            setIsDrowsy(true);

            setHighRiskCount(prev => {
              const nextCount = prev + 1;

              if (nextCount >= 3 && !emergencyTriggeredRef.current) {
                emergencyTriggeredRef.current = true;
                console.log("🚑 EMERGENCY TRIGGERED");

                (async () => {
                  try {
                    await supabase.from("messages").insert([
                      {
                        text: "🚑 Emergency: Driver in critical condition"
                      }
                    ]);
                  } catch (err) {
                    console.error("[Drowsiness] emergency insert failed", err);
                  }
                })();
              }

              return nextCount;
            });

            setEvents(prev => [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                score: score,
                level: "HIGH"
              }
            ]);

            if (audioRef.current) {
              audioRef.current.play();
            }
          } else {
            setIsDrowsy(false);

            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
          }
        }
      } catch (err) {
        console.error("[Drowsiness] detection error", err);
      }
    }, 1000);
  };

  // ─── VISUAL RETURN ────────────────────────────────────────────────────────
  return (
    <>
      <style>{DRW_CSS}</style>
      <div className="drw-root">
        <div className="drw-content">

          {/* ── Header ── */}
          <div className="drw-header">
            <div className="drw-status-dot" />
            <div className="drw-title">DRIVER MONITORING</div>
            <div className="drw-version">v2.4</div>
          </div>

          {/* ── Camera feed with overlays ── */}
          <div className="drw-cam-wrap">
            <video ref={videoRef} autoPlay muted />
            <div className="drw-cam-overlay-vignette" />
            <div className="drw-scan" />
            <div className="drw-corner tl" />
            <div className="drw-corner tr" />
            <div className="drw-corner bl" />
            <div className="drw-corner br" />
            <div className="drw-reticle" />
            <div className="drw-cam-label">CAM‑01 ● ACTIVE</div>
            <div className="drw-cam-rec">
              <div className="drw-rec-dot" />
              REC
            </div>
          </div>

          {/* ── Eye visualiser + Risk gauge ── */}
          <div className="drw-eyes">
            <EyeViz closed={closedFrames > 0} label="LEFT EYE" />
            <RiskGauge score={riskScore} />
            <EyeViz closed={closedFrames > 0} label="RIGHT EYE" />
          </div>

          {/* ── Risk level badge ── */}
          <div className={`drw-risk ${riskLevel}`}>
            <span style={{ fontSize: 14 }}>
              {riskLevel === "HIGH" ? "⚠" : riskLevel === "MEDIUM" ? "◈" : "●"}
            </span>
            <span>{riskLevel} RISK</span>
            {riskLevel !== "LOW" && (
              <span style={{ marginLeft:"auto", fontSize:7, opacity:0.6 }}>
                {riskLevel === "HIGH" ? "CRITICAL" : "CAUTION"}
              </span>
            )}
          </div>

          {/* ── Eye closure duration bar ── */}
          <div className="drw-bar-wrap">
            <div className="drw-bar-header">
              <span>EYE CLOSURE DURATION</span>
              <span>{closedFrames} FRAMES</span>
            </div>
            <div className="drw-bar-track">
              <div className="drw-bar-fill" style={{
                width: `${Math.min(closedFrames * 25, 100)}%`,
                background: closedFrames > 3
                  ? "linear-gradient(90deg, #ffcc00, #ff4444)"
                  : "linear-gradient(90deg, #00ff88, #00cc66)",
                boxShadow: `0 0 6px ${closedFrames > 3 ? "#ff4444" : "#00ff88"}`,
              }} />
            </div>
          </div>

          {/* ── High risk trigger counter ── */}
          {highRiskCount > 0 && (
            <div className="drw-high-count">
              <span>HIGH RISK TRIGGERS</span>
              <span style={{ color: highRiskCount >= 3 ? "#ff4444" : "#ff8844" }}>
                {highRiskCount} / 3
              </span>
            </div>
          )}

          {/* ── Drowsiness alert banner ── */}
          {isDrowsy && (
            <div className="drw-alert-banner">
              ⚠&nbsp;&nbsp;DROWSINESS DETECTED — ALERT ACTIVE&nbsp;&nbsp;🚨
            </div>
          )}

          {/* ── Driver event log ── */}
          <div className="drw-report">
            <div className="drw-report-hdr">
              <span>EVENT LOG</span>
              <span style={{ color:"rgba(0,255,136,0.3)" }}>{events.length} EVENTS</span>
            </div>
            {events.length === 0 ? (
              <div className="drw-empty">MONITORING — NO EVENTS YET</div>
            ) : (
              events.slice(-5).map((e, i) => (
                <div key={i} className="drw-event">
                  <span className="drw-event-t">{e.time}</span>
                  <span className="drw-event-s">S:{e.score}</span>
                  <span className="drw-event-l">{e.level}</span>
                </div>
              ))
            )}
          </div>

          {/* ── Emergency triggered panel ── */}
          {highRiskCount >= 3 && (
            <div className="drw-emergency">
              🚑 EMERGENCY TRIGGERED
              <br />
              <span style={{ fontSize:8, fontWeight:400, letterSpacing:1, opacity:0.7 }}>
                ASSISTANCE REQUIRED — UNIT DISPATCHED
              </span>
            </div>
          )}

        </div>

        {/* audio must stay in DOM */}
        <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />
      </div>
    </>
  );
}
