
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
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0d1a0f", borderRadius: 8, overflow: "hidden" }}>
      {/* grid */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="g" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a3020" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />

        {/* roads */}
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#1e3a22" strokeWidth="18" />
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#1e3a22" strokeWidth="14" />
        <line x1="20%" y1="0" x2="80%" y2="100%" stroke="#1a2e1c" strokeWidth="10" />

        {/* road markings */}
        {[10, 25, 40, 55, 70, 85].map((x) => (
          <line key={x} x1={`${x}%`} y1="calc(50% - 2px)" x2={`${x + 5}%`} y2="calc(50% - 2px)" stroke="#2a4a2d" strokeWidth="2" strokeDasharray="8,8" />
        ))}

        {/* Hospital marker */}
        <g transform="translate(78, 60)">
          <circle r="14" fill="#0a4a2a" stroke="#00ff88" strokeWidth="2" />
          <text x="-5" y="5" fill="#00ff88" fontSize="14" fontWeight="bold">H</text>
        </g>

        {/* Accident marker */}
        {active && (
          <g transform="translate(52%, 48%)">
            <circle r="16" fill="#ff000033" stroke="#ff0000" strokeWidth="2">
              <animate attributeName="r" values="14;22;14" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
            </circle>
            <text x="-8" y="6" fill="#ff4444" fontSize="18">⚠</text>
          </g>
        )}

        {/* Ambulance route */}
        {active && ambulanceProgress > 0 && (
          <>
            <line x1="78" y1="60" x2="52%" y2="48%" stroke="#00ff88" strokeWidth="2" strokeDasharray="6,4" opacity="0.6" />
            <circle
              cx={`calc(78px + (52% - 78px) * ${ambulanceProgress / 100})`}
              cy={`calc(60px + (48% - 60px) * ${ambulanceProgress / 100})`}
              r="8" fill="#00ff88"
            >
              <animate attributeName="opacity" values="1;0.6;1" dur="0.5s" repeatCount="indefinite" />
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
          <line x1="10%" y1="90%" x2="52%" y2="48%" stroke="#4488ff" strokeWidth="2" strokeDasharray="6,4" opacity="0.6" />
        )}

        {/* labels */}
        <text x="68" y="90" fill="#00ff88" fontSize="10" fontFamily="monospace">CITY HOSPITAL</text>
        <text x="8%" y="95%" fill="#4488ff" fontSize="10" fontFamily="monospace">POLICE HQ</text>
        {active && <text x="54%" y="46%" fill="#ff4444" fontSize="10" fontFamily="monospace">ACCIDENT</text>}
        <text x="2%" y="4%" fill="#2a5a35" fontSize="9" fontFamily="monospace">PUNE - BANGALORE HWY</text>
      </svg>

      {/* compass */}
      <div style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", border: "1px solid #2a4a35", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1a0e", color: "#2a6a40", fontSize: 11, fontFamily: "monospace" }}>N</div>
    </div>
  );
}

// ── notification popup ────────────────────────────────────────────────────────
function NotifPopup({ notifs, onDismiss }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 300 }}>
      {notifs.map((n) => (
        <div key={n.id} style={{
          background: n.color === "red" ? "#1a0000" : n.color === "green" ? "#001a0a" : "#0a0a1a",
          border: `1px solid ${n.color === "red" ? "#ff3333" : n.color === "green" ? "#00ff88" : "#4488ff"}`,
          borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 13,
          boxShadow: `0 0 20px ${n.color === "red" ? "#ff000044" : n.color === "green" ? "#00ff8844" : "#4488ff44"}`,
          animation: "slideIn 0.3s ease",
          display: "flex", gap: 10, alignItems: "flex-start"
        }}>
          <span style={{ fontSize: 20 }}>{n.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: n.color === "red" ? "#ff4444" : n.color === "green" ? "#00ff88" : "#4488ff", marginBottom: 3 }}>{n.title}</div>
            <div style={{ color: "#ccc", fontSize: 12 }}>{n.msg}</div>
          </div>
          <button onClick={() => onDismiss(n.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── siren icon ────────────────────────────────────────────────────────────────
function SirenIcon({ active }) {
  return (
    <div style={{ position: "relative", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {active && (
        <>
          <div style={{ position: "absolute", width: 40, height: 40, borderRadius: "50%", background: "#ff000033", animation: "ping 1s ease infinite" }} />
          <div style={{ position: "absolute", width: 30, height: 30, borderRadius: "50%", background: "#ff000055", animation: "ping 1s ease infinite 0.3s" }} />
        </>
      )}
      <span style={{ fontSize: 24, zIndex: 1, animation: active ? "flash 0.5s ease infinite" : "none" }}>🚨</span>
    </div>
  );
}

// ── status badge ──────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  const colors = { red: ["#ff3333", "#1a0000"], green: ["#00ff88", "#001a0a"], yellow: ["#ffcc00", "#1a1400"], blue: ["#4488ff", "#00081a"], gray: ["#888", "#111"] };
  const [fg, bg] = colors[color] || colors.gray;
  return (
    <span style={{ background: bg, color: fg, border: `1px solid ${fg}`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
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
    app: { minHeight: "100vh", background: "#080d09", color: "#c8e6c9", fontFamily: "'Courier New', monospace", display: "flex", flexDirection: "column" },
    header: { background: "#0a1a0e", borderBottom: "1px solid #1a4a22", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
    title: { fontSize: 18, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", flex: 1 },
    nav: { display: "flex", gap: 4 },
    navBtn: (s) => ({ background: screen === s ? "#0d3320" : "transparent", border: `1px solid ${screen === s ? "#00ff88" : "#2a4a35"}`, color: screen === s ? "#00ff88" : "#4a7a55", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", transition: "all 0.2s" }),
    body: { flex: 1, padding: 16, display: "grid", gap: 12 },
    card: (glowColor) => ({ background: "#0a1a0e", border: `1px solid ${active && glowColor ? glowColor : "#1a3a20"}`, borderRadius: 10, padding: 16, boxShadow: active && glowColor ? `0 0 20px ${glowColor}22` : "none", transition: "all 0.5s" }),
    cardTitle: { fontSize: 10, letterSpacing: 2, color: "#4a7a55", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 },
    stat: { fontSize: 24, fontWeight: 700, color: "#00ff88", lineHeight: 1 },
    statLabel: { fontSize: 10, color: "#4a7a55", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
    btn: (color) => ({ background: color === "red" ? (active ? "#3a0000" : "#1a0000") : color === "green" ? "#001a0a" : color === "blue" ? "#00081a" : "#111", border: `1px solid ${color === "red" ? "#ff3333" : color === "green" ? "#00ff88" : color === "blue" ? "#4488ff" : "#333"}`, color: color === "red" ? "#ff4444" : color === "green" ? "#00ff88" : color === "blue" ? "#88aaff" : "#888", borderRadius: 7, padding: "10px 18px", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }),
    logEntry: { fontSize: 11, color: "#a0c8a8", padding: "3px 0", borderBottom: "1px solid #0f2015", display: "flex", gap: 8 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
    progress: { height: 6, background: "#0f2015", borderRadius: 3, overflow: "hidden", marginTop: 6 },
    progressFill: (pct, color) => ({ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s" }),
  };

  return (
     <>
<div style={{ padding: 10, background: "black" }}>
  <input
    placeholder="Enter Name"
    value={user.name}
    onChange={(e) => {
      setUser({
        ...user,
        name: e.target.value
      });
    }}
    style={{ marginRight: 10, padding: 5 }}
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
    style={{ padding: 5 }}
  />
</div>
    <div style={{ ...S.app, flexDirection: "row" }}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(120%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes ping { 0%,100% { transform: scale(1); opacity:1 } 50% { transform: scale(1.8); opacity:0 } }
        @keyframes flash { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        @keyframes blink { 0%,100% { box-shadow: 0 0 20px #ff000066 } 50% { box-shadow: 0 0 40px #ff0000cc } }
        * { box-sizing: border-box; margin: 0; padding: 0 }
        ::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-track { background: #060d08 } ::-webkit-scrollbar-thumb { background: #1a4a22 }
      `}</style>

      {/* NOTIFICATIONS */}
      <NotifPopup notifs={notifs} onDismiss={dismissNotif} />

      <div style={{ display: "flex", width: "100%", minHeight: "100vh", flexDirection: "column" }}>
        {/* HEADER */}
        <div style={S.header}>
        <SirenIcon active={phase === "confirmed" || phase === "responding"} />
        <div>
          <div style={S.title}>AI Smart Accident Detection & Emergency Response</div>
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
      attribution='&copy; OpenStreetMap contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
        <span>AI SMART ACCIDENT DETECTION SYSTEM — SPPU PROTOTYPE</span>
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