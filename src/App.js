
import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { supabase } from "./supabase";
import Drowsiness from "./Drowsiness";

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

// ── tiny SVG map ──────────────────────────────────────────────────────────────
function MapPanel({ active, ambulanceProgress }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "transparent", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, rgba(0,255,136,0.1), transparent)", pointerEvents: "none" }} />
      {/* grid */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="g" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,255,136,0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />

        {/* radar pulse */}
        {active && (
          <circle cx="52%" cy="48%" r="100" fill="none" stroke="rgba(255,68,68,0.2)" strokeWidth="1">
            <animate attributeName="r" values="0;200" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* roads */}
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(20,40,25,0.7)" strokeWidth="18" />
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(20,40,25,0.7)" strokeWidth="14" />
        <line x1="20%" y1="0" x2="80%" y2="100%" stroke="rgba(15,30,20,0.6)" strokeWidth="10" />

        {/* road markings */}
        {[10, 25, 40, 55, 70, 85].map((x) => (
          <line key={x} x1={`${x}%`} y1="calc(50% - 2px)" x2={`${x + 5}%`} y2="calc(50% - 2px)" stroke="rgba(0,255,136,0.4)" strokeWidth="2" strokeDasharray="8,8" />
        ))}

        {/* Hospital marker */}
        <g transform="translate(78, 60)">
          <circle r="14" fill="rgba(0,50,20,0.8)" stroke="var(--color-green)" strokeWidth="2" style={{ filter: "drop-shadow(0 0 8px var(--color-green-glow))" }} />
          <text x="-5" y="5" fill="var(--color-green)" fontSize="14" fontWeight="bold">H</text>
        </g>

        {/* Accident marker */}
        {active && (
          <g transform="translate(52%, 48%)">
            <circle r="16" fill="rgba(255,0,0,0.2)" stroke="var(--color-red-bright)" strokeWidth="2" style={{ filter: "drop-shadow(0 0 10px rgba(255,0,0,0.5))" }}>
              <animate attributeName="r" values="14;24;14" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <text x="-8" y="6" fill="#fff" fontSize="18">⚠</text>
          </g>
        )}

        {/* Ambulance route */}
        {active && ambulanceProgress > 0 && (
          <>
            <line x1="78" y1="60" x2="52%" y2="48%" stroke="var(--color-green)" strokeWidth="2" strokeDasharray="6,4" opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
            </line>
            <circle
              cx={`calc(78px + (52% - 78px) * ${ambulanceProgress / 100})`}
              cy={`calc(60px + (48% - 60px) * ${ambulanceProgress / 100})`}
              r="8" fill="var(--color-green)"
              style={{ filter: "drop-shadow(0 0 10px var(--color-green))" }}
            >
              <animate attributeName="opacity" values="1;0.6;1" dur="0.3s" repeatCount="indefinite" />
            </circle>
            <text
              x={`calc(78px + (52% - 78px) * ${ambulanceProgress / 100} - 6px)`}
              y={`calc(60px + (48% - 60px) * ${ambulanceProgress / 100} + 5px)`}
              fontSize="12" fill="#001a08"
            >🚑</text>
          </>
        )}

        {/* Police route */}
        {active && ambulanceProgress > 20 && (
          <line x1="10%" y1="90%" x2="52%" y2="48%" stroke="var(--color-blue)" strokeWidth="2" strokeDasharray="6,4" opacity="0.6">
            <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
          </line>
        )}

        {/* labels */}
        <text x="68" y="90" fill="var(--color-green)" fontSize="10" fontFamily="'JetBrains Mono', monospace" style={{ filter: "drop-shadow(0 0 4px var(--color-green-glow))" }}>CITY HOSPITAL</text>
        <text x="8%" y="95%" fill="var(--color-blue)" fontSize="10" fontFamily="'JetBrains Mono', monospace">POLICE HQ</text>
        {active && <text x="54%" y="46%" fill="var(--color-red-bright)" fontSize="10" fontFamily="'JetBrains Mono', monospace" style={{ filter: "drop-shadow(0 0 4px rgba(255,0,0,0.5))" }}>ACCIDENT</text>}
        <text x="2%" y="4%" fill="var(--color-text-dim)" fontSize="9" fontFamily="'JetBrains Mono', monospace">PUNE - BANGALORE HWY</text>
      </svg>

      {/* compass */}
      <div style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(0,255,136,0.3)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,255,136,0.05)", color: "var(--color-green)", fontSize: 11, fontFamily: "monospace", backdropFilter: "blur(4px)" }}>N</div>
    </div>
  );
}

// ── notification popup ────────────────────────────────────────────────────────
function NotifPopup({ notifs, onDismiss }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
      {notifs.map((n) => (
        <div key={n.id} className="glass-panel" style={{
          background: n.color === "red" ? "rgba(40,0,0,0.85)" : n.color === "green" ? "rgba(0,30,10,0.85)" : "rgba(0,10,40,0.85)",
          border: `1px solid ${n.color === "red" ? "var(--color-red-bright)" : n.color === "green" ? "var(--color-green)" : "var(--color-blue)"}`,
          padding: "16px 20px", color: "#fff", fontSize: 14,
          boxShadow: `0 8px 32px ${n.color === "red" ? "rgba(255,0,0,0.3)" : n.color === "green" ? "rgba(0,255,136,0.2)" : "rgba(68,136,255,0.2)"}`,
          animation: "slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          display: "flex", gap: 14, alignItems: "flex-start",
          position: "relative", overflow: "hidden"
        }}>
          {/* Animated glow background */}
          <div style={{ position: "absolute", top: 0, left: "-50%", width: "200%", height: "100%", background: `linear-gradient(90deg, transparent, ${n.color === "red" ? "rgba(255,51,51,0.2)" : "rgba(0,255,136,0.1)"}, transparent)`, animation: "radarSweep 3s linear infinite" }} />
          
          <span style={{ fontSize: 24, zIndex: 1 }}>{n.icon}</span>
          <div style={{ zIndex: 1, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, color: n.color === "red" ? "var(--color-red-bright)" : n.color === "green" ? "var(--color-green)" : "var(--color-blue)", marginBottom: 4 }}>{n.title}</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 1.4 }}>{n.msg}</div>
          </div>
          <button onClick={() => onDismiss(n.id)} style={{ zIndex: 1, marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 20, lineHeight: 1, transition: "color 0.2s" }} onMouseOver={e => e.target.style.color = "#fff"} onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.6)"}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── siren icon ────────────────────────────────────────────────────────────────
function SirenIcon({ active }) {
  return (
    <div style={{ position: "relative", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "rgba(255,0,0,0.1)" : "rgba(255,255,255,0.05)", borderRadius: "50%", border: `1px solid ${active ? "rgba(255,0,0,0.3)" : "transparent"}`, boxShadow: active ? "0 0 20px rgba(255,0,0,0.4)" : "none" }}>
      {active && (
        <>
          <div style={{ position: "absolute", width: 48, height: 48, borderRadius: "50%", background: "rgba(255,0,0,0.15)", animation: "radarPing 1.5s ease infinite" }} />
          <div style={{ position: "absolute", width: 36, height: 36, borderRadius: "50%", background: "rgba(255,0,0,0.25)", animation: "radarPing 1.5s ease infinite 0.4s" }} />
        </>
      )}
      <span style={{ fontSize: 26, zIndex: 1, animation: active ? "flashNeon 0.8s ease infinite" : "none", filter: active ? "drop-shadow(0 0 8px red)" : "none" }}>🚨</span>
    </div>
  );
}

// ── status badge ──────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  const colors = { 
    red: ["var(--color-red-bright)", "rgba(50,0,0,0.5)", "rgba(255,68,68,0.3)"], 
    green: ["var(--color-green)", "rgba(0,30,10,0.5)", "rgba(0,255,136,0.3)"], 
    yellow: ["var(--color-yellow)", "rgba(40,30,0,0.5)", "rgba(255,204,0,0.3)"], 
    blue: ["var(--color-blue)", "rgba(0,10,40,0.5)", "rgba(68,136,255,0.3)"], 
    gray: ["#888", "rgba(30,30,30,0.5)", "rgba(100,100,100,0.3)"] 
  };
  const [fg, bg, border] = colors[color] || colors.gray;
  return (
    <span style={{ background: bg, color: fg, border: `1px solid ${border}`, borderRadius: "20px", padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", backdropFilter: "blur(4px)", boxShadow: `0 0 10px ${border}` }}>
      {label}
    </span>
  );
}

// ── main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("dashboard"); // dashboard | emergency
  const [phase, setPhase] = useState("idle"); // idle | detecting | confirmed | responding | resolved
  const [severity, setSeverity] = useState("HIGH");
  const [logs, setLogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [ambulanceProgress, setAmbulanceProgress] = useState(0);
  const [policeDispatched, setPoliceDispatched] = useState(false);
  const [ambulanceDispatched, setAmbulanceDispatched] = useState(false);
  const [aiData, setAiData] = useState({ confidence: 0, severity: "Analyzing...", falseAlert: "N/A", injury: "N/A" });
  const [eta, setEta] = useState(null);
  const [position, setPosition] = useState([18.5204, 73.8567]);
  const [blink, setBlink] = useState(true);
  const [isDrowsy, setIsDrowsy] = useState(false);
  useEffect(() => {
  const channel = supabase
    .channel('realtime messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        console.log("New message:", payload);
        setMessages((prev) => [...prev, payload.new]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

useEffect(() => {
  const interval = setInterval(() => {
    setBlink((prev) => !prev);
  }, 500);

  return () => clearInterval(interval);
}, []);

useEffect(() => {
  const moveInterval = setInterval(() => {
    setPosition((prev) => {
      const lat = prev[0];
      const lng = prev[1];

      const newLat = lat + (destination[0] - lat) * 0.05;
      const newLng = lng + (destination[1] - lng) * 0.05;

      return [newLat, newLng];
    });
  }, 500);

  return () => clearInterval(moveInterval);
}, []);



  const ambulanceIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2967/2967350.png",
 iconSize: [60, 60],
iconAnchor: [30, 60],
popupAnchor: [0, -60],
});
  const [user, setUser] = useState({
  name: "",
  phone: ""
});

  const speak = (msg) => {
  const speech = new SpeechSynthesisUtterance(msg);
  speech.rate = 1;
  speech.pitch = 1;
  window.speechSynthesis.speak(speech);
};
  const [demoRunning, setDemoRunning] = useState(false);
  const [communityAlert, setCommunityAlert] = useState(false);
  const audioCtx = useRef(null);
  const notifId = useRef(0);

  const addLog = useCallback((msg) => setLogs((l) => [...l, { t: now(), msg }]), []);

  const addNotif = useCallback((title, msg, icon, color) => {
    const id = ++notifId.current;
    setNotifs((n) => [...n, { id, title, msg, icon, color }]);
    setTimeout(() => setNotifs((n) => n.filter((x) => x.id !== id)), 5000);
    return id;
  }, []);

  const dismissNotif = (id) => setNotifs((n) => n.filter((x) => x.id !== id));

  const playBeep = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) setTimeout(() => beep(audioCtx.current), i * 500);
  };

  const runSimulation = useCallback((sev = severity) => {
    if (phase !== "idle") return;
    setPhase("detecting");
    setLogs([]);
    setAmbulanceProgress(0);
    setPoliceDispatched(false);
    setAmbulanceDispatched(false);
    setEta(null);
    setCommunityAlert(false);
    setAiData({ confidence: 0, severity: "Analyzing...", falseAlert: "Checking...", injury: "Assessing..." });

    addLog("Impact sensors triggered");
    playBeep();

    setTimeout(() => {
      addLog("Accelerometer data anomaly detected");
      setAiData((a) => ({ ...a, confidence: 47 }));
    }, 800);

    setTimeout(() => {
      addLog("AI model processing sensor data...");
      setAiData((a) => ({ ...a, confidence: 71, falseAlert: "Unlikely" }));
    }, 1600);

    setTimeout(() => {
      setPhase("confirmed");
      addLog("✅ Accident CONFIRMED by AI system");
      const conf = sev === "HIGH" ? 94 : sev === "MEDIUM" ? 82 : 67;
      const inj = sev === "HIGH" ? "High Injury Risk" : sev === "MEDIUM" ? "Moderate Risk" : "Minor Risk";
      setAiData({ confidence: conf, severity: `${sev} IMPACT`, falseAlert: "Negative", injury: inj });
      addNotif("ACCIDENT DETECTED", `Vehicle MH14-4587 — ${sev} severity`, "⚠️", "red");
      playBeep();
      addLog("GPS coordinates locked: 18.5204°N, 73.8567°E");
    }, 2800);

    setTimeout(() => {
      addLog("🏥 Alert sent to City Hospital");
      addNotif("HOSPITAL ALERTED", "Incoming trauma patient — prepare ER", "🏥", "red");
    }, 3600);

    setTimeout(() => {
      addLog("🚔 Police Station notified");
      addNotif("POLICE NOTIFIED", "Accident on Pune-Bangalore Hwy", "🚔", "blue");
    }, 4400);

    setTimeout(() => {
      addLog("📡 Emergency Control Center alerted");
      setCommunityAlert(true);
      addLog("📢 Community alert broadcast: 200m radius");
    }, 5200);

    setTimeout(() => {
      setPhase("responding");
      setAmbulanceDispatched(true);
      setEta("6 min");
      addLog("🚑 Ambulance dispatched — ETA 6 min");
      addNotif("AMBULANCE DISPATCHED", "Unit 7 en route — ETA 6 min", "🚑", "green");
      let prog = 0;
      const interval = setInterval(() => {
        prog += 2;
        setAmbulanceProgress(prog);
        if (prog >= 100) clearInterval(interval);
      }, 180);
    }, 6200);

    setTimeout(() => {
      setPoliceDispatched(true);
      addLog("🚔 Police Unit 3 on route");
    }, 7000);

    setTimeout(() => {
      setEta("3 min");
      addLog("🚑 Ambulance approaching — ETA 3 min");
    }, 10000);

    setTimeout(() => {
      setPhase("resolved");
      setEta("Arrived");
      addLog("✅ Ambulance arrived at scene");
      addLog("✅ Police secured perimeter");
      addNotif("SCENE SECURED", "All units on-site — situation under control", "✅", "green");
    }, 16000);
  }, [phase, severity, addLog, addNotif]);

const runDemo = useCallback(() => {
  if (!user.name || !user.phone) {
    alert("Please enter name and phone number");
    return;
  }

  if (demoRunning || phase !== "idle") return;

  setDemoRunning(true);
  setPhase("detecting");
  addLog("🚨 Sudden impact detected!");

  addLog("⚙️ AI analyzing sensor data...");
  setAiData({ confidence: 10, severity: "Analyzing...", falseAlert: "Checking...", injury: "Assessing..." });

  setTimeout(() => {
    addLog("🧠 Validating crash pattern...");
    setAiData({ confidence: 40, severity: "Validating...", falseAlert: "Checking...", injury: "Assessing..." });

    setTimeout(() => {
      addLog("📊 Calculating severity...");
      setAiData({ confidence: 70, severity: "Processing...", falseAlert: "Checking...", injury: "Assessing..." });

      setTimeout(() => {
        const confidence = Math.floor(Math.random() * 20) + 80;

        let severityLevel;
        if (confidence > 90) severityLevel = "HIGH";
        else if (confidence > 85) severityLevel = "MEDIUM";
        else severityLevel = "LOW";

        setAiData({
          confidence,
          severity: severityLevel,
          falseAlert: "Negative",
          injury: severityLevel === "HIGH" ? "High Risk" : severityLevel === "MEDIUM" ? "Moderate Risk" : "Low Risk"
        });
        setSeverity(severityLevel);
        setPhase("confirmed");

        addLog(`✅ Accident confirmed (${severityLevel})`);
        addNotif("Accident Detected", `Severity: ${severityLevel}`, "🚨", "red");
        addLog(`📡 SOS sent for ${user.name} (${user.phone})`);
        speak("Accident detected. Emergency services have been notified.");

        addLog("📡 Sending SOS to emergency services...");
        addNotif("SOS Sent", "Location shared with ambulance & police", "📡", "blue");
        addLog("📞 Calling ambulance...");

        let progress = 0;
        const progressInterval = setInterval(() => {
          progress = Math.min(progress + 20, 100);
          setAmbulanceProgress(progress);
          setPosition((prev) => [prev[0] + 0.001, prev[1] + 0.001]);

          if (progress >= 100) {
            clearInterval(progressInterval);
            setAmbulanceDispatched(true);
            addLog("🚑 Ambulance dispatched successfully");
            setEta("6 min");

            let etaRemaining = 6;
            const etaInterval = setInterval(() => {
              etaRemaining = Math.max(etaRemaining - 1, 0);
              setEta(etaRemaining > 0 ? `${etaRemaining} min` : "Arrived");

              if (etaRemaining <= 0) {
                clearInterval(etaInterval);
                addLog("🚑 Ambulance reached location");
              }
            }, 2000);
          }
        }, 600);

        setTimeout(() => {
          setPoliceDispatched(true);
          addLog("🚓 Police notified and dispatched");
        }, 2000);

        setTimeout(() => {
          addLog("🏥 Hospital emergency team alerted");
          setCommunityAlert(true);
        }, 2500);

        setTimeout(() => {
          setDemoRunning(false);
        }, 3200);
      }, 1200);
    }, 1200);
  }, 1200);
}, [demoRunning, phase, addLog, addNotif, user]);

  const reset = () => {
    setPhase("idle");
    setLogs([]);
    setNotifs([]);
    setAmbulanceProgress(0);
    setPoliceDispatched(false);
    setAmbulanceDispatched(false);
    setEta(null);
    setCommunityAlert(false);
    setAiData({ confidence: 0, severity: "Analyzing...", falseAlert: "N/A", injury: "N/A" });
  };

  const active = phase !== "idle";
  const sevColor = severity === "HIGH" ? "red" : severity === "MEDIUM" ? "yellow" : "green";

  // ── styles ──────────────────────────────────────────────────────────────────
  const S = {
    app: { minHeight: "100vh", display: "flex", flexDirection: "column" },
    header: { background: "rgba(6, 12, 8, 0.8)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 32px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 100 },
    title: { fontSize: 24, fontWeight: 800, color: "var(--color-green)", letterSpacing: 3, textTransform: "uppercase", flex: 1, textShadow: "0 0 20px var(--color-green-glow)" },
    nav: { display: "flex", gap: 12 },
    navBtn: (s) => ({ background: screen === s ? "rgba(0, 255, 136, 0.15)" : "transparent", border: `1px solid ${screen === s ? "var(--color-green)" : "rgba(255,255,255,0.1)"}`, color: screen === s ? "var(--color-green)" : "var(--color-text-dim)", borderRadius: "20px", padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: screen === s ? "0 0 15px rgba(0,255,136,0.2)" : "none" }),
    body: { flex: 1, padding: 24, display: "grid", gap: 24, animation: "fadeIn 0.6s ease" },
    card: (glowColor) => ({ background: "var(--bg-panel)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${active && glowColor ? glowColor : "rgba(255,255,255,0.04)"}`, borderRadius: 20, padding: 24, boxShadow: active && glowColor ? `0 0 30px ${glowColor}33` : "0 8px 32px rgba(0,0,0,0.4)", transition: "all 0.4s ease", position: "relative", overflow: "hidden" }),
    cardTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: "var(--color-text-dim)", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 },
    stat: { fontSize: 32, fontWeight: 800, lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.5)" },
    statLabel: { fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 6, fontWeight: 600 },
    btn: (color) => ({ className: "cyber-btn", background: color === "red" ? (active ? "rgba(80,0,0,0.8)" : "rgba(40,0,0,0.6)") : color === "green" ? "rgba(0,40,20,0.6)" : color === "blue" ? "rgba(0,10,40,0.6)" : "var(--bg-panel)", border: `1px solid ${color === "red" ? "var(--color-red-bright)" : color === "green" ? "var(--color-green)" : color === "blue" ? "var(--color-blue)" : "rgba(255,255,255,0.1)"}`, color: color === "red" ? "var(--color-red-bright)" : color === "green" ? "var(--color-green)" : color === "blue" ? "var(--color-blue)" : "var(--color-text-main)", borderRadius: 12, padding: "14px 24px", cursor: "pointer", fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", transition: "all 0.3s ease", display: "flex", alignItems: "center", gap: 10, boxShadow: `0 4px 15px rgba(0,0,0,0.2)` }),
    logEntry: { fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "var(--color-text-main)", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", gap: 12 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
    progress: { height: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, overflow: "hidden", marginTop: 8, border: "1px solid rgba(255,255,255,0.05)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" },
    progressFill: (pct, color) => ({ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, transparent, ${color})`, borderRadius: 4, transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: `0 0 10px ${color}` }),
  };

  return (
     <>
<div className="glass-panel" style={{ margin: "16px 24px", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, background: "rgba(10,26,14,0.6)", borderRadius: 12, border: "1px solid rgba(0,255,136,0.1)" }}>
  <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--color-green)", textTransform: "uppercase", letterSpacing: 2 }}><span style={{marginRight: 8}}>👤</span> User Setup</div>
  <input
    placeholder="Enter Name"
    value={user.name}
    onChange={(e) => {
      setUser({
        ...user,
        name: e.target.value
      });
    }}
    style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.4)", color: "#fff", outline: "none", fontSize: 14, minWidth: 200, fontFamily: "var(--font-primary)" }}
  />
  <input
    placeholder="Enter Phone Number"
    value={user.phone}
    onChange={(e) => {
      setUser({
        ...user,
        phone: e.target.value
      });
    }}
    style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.4)", color: "#fff", outline: "none", fontSize: 14, minWidth: 200, fontFamily: "var(--font-primary)" }}
  />
</div>
    <div style={{ ...S.app, flexDirection: "row" }}>
      {/* CSS is now in index.css */}

      {/* NOTIFICATIONS */}
      <NotifPopup notifs={notifs} onDismiss={dismissNotif} />

      <div style={{ display: "flex", width: "100%", minHeight: "100vh", flexDirection: "column" }}>
        {/* HEADER */}
        <div style={S.header}>
        <SirenIcon active={phase === "confirmed" || phase === "responding"} />
        <div>
          <div style={S.title}>SAFEDRIVE-AI</div>
          <div style={{ fontSize: 10, color: "#2a6a40", letterSpacing: 1 }}>SYSTEM v2.4.1 — PUNE TRAFFIC CONTROL NETWORK</div>
        </div>

        {/* phase status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {phase === "idle" && <Badge label="STANDBY" color="gray" />}
          {phase === "detecting" && <Badge label="DETECTING..." color="yellow" />}
          {phase === "confirmed" && <Badge label="ACCIDENT CONFIRMED" color="red" />}
          {phase === "responding" && <Badge label="RESPONDING" color="green" />}
          {phase === "resolved" && <Badge label="RESOLVED" color="green" />}
        </div>

        {/* nav */}
        <div style={S.nav}>
          <button style={S.navBtn("dashboard")} onClick={() => setScreen("dashboard")}>Dashboard</button>
          <button style={S.navBtn("emergency")} onClick={() => setScreen("emergency")}>Emergency Room</button>
        </div>
      </div>

      {/* ── DASHBOARD SCREEN ────────────────────────────────────────────────── */}
      {screen === "dashboard" && (
        <div style={{ ...S.body, gridTemplateColumns: "300px 1fr 280px" }}>

          {/* COL 1 — Vehicle + Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Vehicle Info */}
            <div style={{ ...S.card("#ff3333"), animation: active ? "blink 1.5s ease infinite" : "none" }}>
              <div style={S.cardTitle}><span>🚗</span> Vehicle Info</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Vehicle ID", "MH14-4587"], ["Location", "Pune-Blore Hwy, KM 42"], ["Speed", "0 km/h"], ["GPS", "18.5204°N, 73.8567°E"]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: "#4a7a55", textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
                    <div style={{ fontSize: 13, color: "#c8e6c9", fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
                <h3 style={{ marginTop: 15 }}>📢 Live Alerts</h3>

{messages.map((msg, i) => (
  <p key={i} style={{ fontSize: "12px", color: "#00ff88" }}>
    {msg.text}
  </p>
))}
                <div>
                  <div style={{ fontSize: 10, color: "#4a7a55", textTransform: "uppercase", letterSpacing: 1 }}>Impact Severity</div>
                  <Badge label={active ? severity : "NONE"} color={active ? sevColor : "gray"} />
                </div>
              </div>
            </div>

            {/* Severity Selector */}
            <div style={S.card(null)}>
              <div style={S.cardTitle}>Severity Level</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {["LOW", "MEDIUM", "HIGH"].map((s) => (
                  <button key={s} disabled={active} onClick={() => setSeverity(s)} style={{ ...S.btn(s === "HIGH" ? "red" : s === "MEDIUM" ? "yellow" : "green"), background: severity === s ? (s === "HIGH" ? "#2a0000" : s === "MEDIUM" ? "#1a1400" : "#001a0a") : "transparent", opacity: active ? 0.5 : 1 }}>
                    {s === "HIGH" ? "🔴" : s === "MEDIUM" ? "🟡" : "🟢"} {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulate / Demo */}
            <button disabled={active} onClick={() => runSimulation()} style={{ ...S.btn("red"), justifyContent: "center", padding: 16, fontSize: 13, opacity: active ? 0.4 : 1, animation: !active ? "pulse 2s ease infinite" : "none" }}>
              🚨 TRIGGER AI CRASH DETECTION
            </button>
            <button disabled={active || demoRunning} onClick={runDemo} style={{ ...S.btn("blue"), justifyContent: "center", padding: 12, opacity: active ? 0.4 : 1 }}>
              ▶ AI LIVE SIMULATION
            </button>
            {phase === "resolved" && (
              <button onClick={reset} style={{ ...S.btn("green"), justifyContent: "center", padding: 12 }}>
                ↺ RESET SYSTEM
              </button>
            )}
          </div>

          {/* COL 2 — Map + Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Map */}
            <div style={{ height: 300, marginTop: 10 }}>
  <MapContainer
   center={position}
    zoom={13}
    style={{ height: "100%", width: "100%" }}
  >
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
                { label: "Confidence", value: active ? `${aiData.confidence}%` : "—", color: "#00ff88" },
                { label: "ETA Ambulance", value: eta || "—", color: "#00dd77" },
                { label: "Alert Radius", value: active ? "200m" : "—", color: "#ffcc00" },
              ].map((s) => (
                <div key={s.label} style={{ ...S.card(null), textAlign: "center" }}>
                  <div style={{ ...S.stat, color: s.color }}>{s.value}</div>
                  <div style={S.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ ...S.card(null), flex: 1, overflow: "hidden" }}>
              <div style={S.cardTitle}><span>⏱</span> Response Timeline</div>
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {logs.length === 0 && <div style={{ color: "#2a4a35", fontSize: 12, textAlign: "center", padding: 20 }}>Awaiting event...</div>}
                {logs.map((l, i) => (
                  <div key={i} style={S.logEntry}>
                    <span style={{ color: "#2a6a40", flexShrink: 0 }}>{l.t}</span>
                    <span>{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COL 3 — AI Panel + Community */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* AI Analysis */}
            <div style={S.card("#4488ff")}>
              <div style={S.cardTitle}><span>🤖</span> AI Analysis Engine</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={S.statLabel}>Confidence Score</div>
                  <div style={{ ...S.stat, color: aiData.confidence > 80 ? "#ff4444" : aiData.confidence > 50 ? "#ffcc00" : "#00ff88" }}>{aiData.confidence}%</div>
                  <div style={S.progress}><div style={S.progressFill(aiData.confidence, aiData.confidence > 80 ? "#ff4444" : "#ffcc00")} /></div>
                </div>
                {[["Severity Prediction", aiData.severity], ["False Alert", aiData.falseAlert], ["Injury Risk", aiData.injury]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: "#4a7a55", letterSpacing: 1, textTransform: "uppercase" }}>{k}</div>
                    <div style={{ fontSize: 12, color: "#c8e6c9", fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Status */}
            <div style={S.card(null)}>
              <div style={S.cardTitle}><span>📡</span> Dispatch Status</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "🏥 Hospital", active: phase === "confirmed" || phase === "responding" || phase === "resolved", color: "#ff4444" },
                  { label: "🚑 Ambulance", active: ambulanceDispatched, color: "#00ff88" },
                  { label: "🚔 Police", active: policeDispatched, color: "#4488ff" },
                  { label: "📢 Community", active: communityAlert, color: "#ffcc00" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.active ? item.color : "#1a3a20", boxShadow: item.active ? `0 0 8px ${item.color}` : "none", transition: "all 0.5s", flexShrink: 0 }} />
                    <span style={{ color: item.active ? "#c8e6c9" : "#2a4a35" }}>{item.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: item.active ? item.color : "#1a3a20" }}>{item.active ? "ACTIVE" : "IDLE"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ambulance progress */}
            {ambulanceDispatched && (
              <div style={S.card("#00ff88")}>
                <div style={S.cardTitle}><span>🚑</span> Ambulance Route</div>
                <div style={{ fontSize: 12, color: "#c8e6c9", marginBottom: 6 }}>Unit 7 — Progress</div>
                <div style={S.progress}><div style={S.progressFill(ambulanceProgress, "#00ff88")} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#4a7a55" }}>
                  <span>Hospital</span>
                  <span style={{ color: "#00ff88" }}>{ambulanceProgress}%</span>
                  <span>Scene</span>
                </div>
              </div>
            )}

            {/* Community Alert */}
            {communityAlert && (
              <div style={{ ...S.card("#ffcc00"), animation: "pulse 1.5s ease infinite" }}>
                <div style={S.cardTitle}><span>📢</span> Nearby Assistance</div>
                <div style={{ fontSize: 11, color: "#ffe066", lineHeight: 1.5 }}>
                  ⚠️ Accident detected 200 meters ahead.<br />
                  First aid assistance requested.<br />
                  Please clear the road.
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: "#4a7a55" }}>Broadcast to 47 nearby devices</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EMERGENCY ROOM SCREEN ───────────────────────────────────────────── */}
      {screen === "emergency" && (
        <div style={{ ...S.body, gridTemplateColumns: "1fr 1fr" }}>

          {/* Incoming Alert Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...S.card("#ff3333"), animation: (phase === "confirmed" || phase === "responding") ? "blink 1.5s ease infinite" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <SirenIcon active={phase === "confirmed" || phase === "responding"} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: active ? "#ff4444" : "#4a7a55", textTransform: "uppercase", letterSpacing: 2 }}>
                    {active ? "⚠ INCOMING EMERGENCY" : "NO ACTIVE ALERTS"}
                  </div>
                  <div style={{ fontSize: 11, color: "#4a7a55" }}>Emergency Control Center — Pune</div>
                </div>
              </div>

              {active ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[["Incident ID", "#ACC-2024-0372"], ["Vehicle", "MH14-4587"], ["Location", "Pune-Blore Hwy"], ["Severity", severity], ["Time", logs[0]?.t || now()], ["Status", phase.toUpperCase()]].map(([k, v]) => (
                    <div key={k} style={{ background: "#060d08", borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: "#2a6a40", textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
                      <div style={{ fontSize: 12, color: k === "Severity" ? (severity === "HIGH" ? "#ff4444" : severity === "MEDIUM" ? "#ffcc00" : "#00ff88") : "#c8e6c9", fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 20, color: "#1a4a22", fontSize: 12 }}>
                  Switch to Dashboard and simulate an accident to see emergency alerts here.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={S.card(null)}>
              <div style={S.cardTitle}>Dispatch Controls</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button onClick={() => { setAmbulanceDispatched(true); addLog("🚑 Manual ambulance dispatch"); addNotif("AMBULANCE DISPATCHED", "Unit 7 on route", "🚑", "green"); }} style={{ ...S.btn("green"), justifyContent: "center", flexDirection: "column", padding: 14 }}>
                  <span style={{ fontSize: 20 }}>🚑</span>
                  <span>Dispatch Ambulance</span>
                  {ambulanceDispatched && <span style={{ fontSize: 9, color: "#00ff88" }}>● DISPATCHED</span>}
                </button>
                <button onClick={() => { setPoliceDispatched(true); addLog("🚔 Manual police dispatch"); addNotif("POLICE DISPATCHED", "Unit 3 on route", "🚔", "blue"); }} style={{ ...S.btn("blue"), justifyContent: "center", flexDirection: "column", padding: 14 }}>
                  <span style={{ fontSize: 20 }}>🚔</span>
                  <span>Notify Police</span>
                  {policeDispatched && <span style={{ fontSize: 9, color: "#4488ff" }}>● DISPATCHED</span>}
                </button>
                <button onClick={() => setScreen("dashboard")} style={{ ...S.btn("gray"), justifyContent: "center", gridColumn: "span 2", padding: 12 }}>
                  📋 View Full Dashboard
                </button>
              </div>
            </div>

            {/* Hospital Info */}
            <div style={S.card("#00ff88")}>
              <div style={S.cardTitle}><span>🏥</span> Nearest Hospital</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["Name", "KEM Hospital, Pune"], ["Distance", "3.2 km"], ["ETA Ambulance", eta || "—"], ["ER Status", "Available"], ["Trauma Unit", "Ready"]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #0f2015", paddingBottom: 4 }}>
                    <span style={{ color: "#4a7a55" }}>{k}</span>
                    <span style={{ color: k === "ETA Ambulance" ? "#00ff88" : "#c8e6c9", fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map + Logs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...S.card("#00ff88"), height: 300 }}>
              <div style={S.cardTitle}><span>🗺</span> Incident Map</div>
              <div style={{ height: "calc(100% - 28px)" }}>
                <MapPanel active={active} ambulanceProgress={ambulanceProgress} />
              </div>
            </div>

            {/* Notification Log */}
            <div style={{ ...S.card(null), flex: 1 }}>
              <div style={S.cardTitle}><span>📋</span> Notification Log</div>
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {logs.length === 0 ? (
                  <div style={{ color: "#1a4a22", fontSize: 12, textAlign: "center", padding: 30 }}>No events recorded</div>
                ) : (
                  logs.map((l, i) => (
                    <div key={i} style={{ ...S.logEntry, padding: "5px 0" }}>
                      <span style={{ color: "#2a6a40", flexShrink: 0, fontSize: 10 }}>{l.t}</span>
                      <span style={{ fontSize: 12 }}>{l.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* footer */}
      <div style={{ background: "#060d08", borderTop: "1px solid #0f2015", padding: "6px 24px", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#1a4a22" }}>
        <span>SAFEDRIVE-AI — SPPU PROTOTYPE</span>
        <span style={{ color: "#00ff8844" }}>{now()} IST ● PUNE TRAFFIC NETWORK</span>
      </div>
      </div>

      {/* RIGHT SIDEBAR - CAMERA */}
      <div style={{ width: "20%", background: "#111", color: "white", padding: "10px", borderLeft: "1px solid #1a3a20", overflow: "auto" }}>
        <Drowsiness setIsDrowsy={setIsDrowsy} isDrowsy={isDrowsy} />
      </div>
    </div>
    </>
  );

}