import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { supabase } from "./supabase";


export default function Drowsiness({ setIsDrowsy, isDrowsy }) {
  const videoRef = useRef();
  const audioRef = useRef(null);
  const alarmTimeoutRef = useRef(null);
  const isAlarmPlaying = useRef(false);
  const closedFrames = useRef(0);

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
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();

          const leftEyeHeight = leftEye[1].y - leftEye[5].y;
          const rightEyeHeight = rightEye[1].y - rightEye[5].y;

          if (leftEyeHeight < 5 && rightEyeHeight < 5) {
            closedFrames.current += 1;
          } else {
            closedFrames.current = 0;
            setIsDrowsy(false);
            
            if (alarmTimeoutRef.current) {
              clearTimeout(alarmTimeoutRef.current);
              alarmTimeoutRef.current = null;
            }
            
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
          }

          // if eyes closed for some time
          if (closedFrames.current > 5) {
            if (!isDrowsy) {
              setIsDrowsy(true);

              try {
                const { error } = await supabase.from("messages").insert([
                  { text: "🚨 Driver Drowsy Detected!" }
                ]);

                if (error) {
                  console.error("[Drowsiness] Supabase insert failed", error);
                } else {
                  console.log("[Drowsiness] Supabase alert inserted");
                }
              } catch (err) {
                console.error("[Drowsiness] Supabase insert exception", err);
              }
            }

            if (!isAlarmPlaying.current && audioRef.current) {
              isAlarmPlaying.current = true;
              audioRef.current.currentTime = 0;
              audioRef.current.play();

              alarmTimeoutRef.current = setTimeout(() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                }
                isAlarmPlaying.current = false;
                alarmTimeoutRef.current = null;
              }, 3000);
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
    </div>
  );
}