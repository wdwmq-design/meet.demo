




import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { supabase } from "./supabase";


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

          // take top and bottom nose points
          const noseTop = nose[0];
          const noseBottom = nose[3];

          // calculate vertical difference
          const headTilt = Math.abs(noseTop.y - noseBottom.y);

          // debug
          console.log("Head tilt:", headTilt);
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();

          const leftEyeHeight = leftEye[1].y - leftEye[5].y;
          const rightEyeHeight = rightEye[1].y - rightEye[5].y;

          let score = 0;

          // 👀 Eye closure
          if (leftEyeHeight < 5 && rightEyeHeight < 5) {
            setClosedFrames(prev => prev + 1);
            score += 3;
          } else {
            setClosedFrames(0);
          }

          // ⏱️ Duration factor
          if (closedFrames > 3) {
            score += 3;
          }

          // 🤯 Head tilt detection
          if (headTilt < 20) {
            score += 2;
          }

          // 🔥 Set risk score
          setRiskScore(score);

          console.log("Risk Score:", score);

          if (score >= 6) {
            setRiskLevel("HIGH");
          } else if (score >= 3) {
            setRiskLevel("MEDIUM");
          } else {
            setRiskLevel("LOW");
          }

          // 🚨 Trigger alert
          if (score >= 5) {
            setIsDrowsy(true);

            // 🚑 SMART EMERGENCY TRIGGER COUNTER
            setHighRiskCount(prev => {
              const nextCount = prev + 1;

              if (nextCount >= 3 && !emergencyTriggeredRef.current) {
                emergencyTriggeredRef.current = true;
                console.log("🚑 EMERGENCY TRIGGERED");

                // optional: send to supabase
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

            // 🔥 STORE EVENT
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

  return (
    <div>
      <h3>Driver Monitoring</h3>
      <video ref={videoRef} autoPlay muted width="300" />
      <div style={{
        marginTop: "10px",
        color: "yellow",
        fontWeight: "bold"
      }}>
        Risk Score: {riskScore}
      </div>
      <div style={{
        marginTop: "5px",
        fontWeight: "bold",
        color:
          riskLevel === "HIGH"
            ? "red"
            : riskLevel === "MEDIUM"
            ? "orange"
            : "green"
      }}>
        Risk Level: {riskLevel}
      </div>
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />
      {isDrowsy && (
        <div style={{
          background: "red",
          color: "white",
          padding: "10px",
          marginTop: "10px",
          textAlign: "center",
          fontWeight: "bold"
        }}>
          ⚠️ DRIVER DROWSY ALERT 🚨
        </div>
      )}

      <div style={{ marginTop: "15px" }}>
        <h4>Driver Report</h4>

        {events.slice(-5).map((e, i) => (
          <div key={i} style={{
            fontSize: "12px",
            marginBottom: "5px",
            color: "#ccc"
          }}>
            {e.time} — Score: {e.score} — {e.level}
          </div>
        ))}

        {highRiskCount >= 3 && (
          <div style={{
            marginTop: "10px",
            background: "darkred",
            color: "white",
            padding: "10px",
            textAlign: "center",
            fontWeight: "bold"
          }}>
            🚑 Emergency Triggered — Assistance Required
          </div>
        )}
      </div>
    </div>
  );
}