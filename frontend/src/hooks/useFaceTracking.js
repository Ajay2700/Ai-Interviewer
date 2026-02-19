import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import {
  FACEMESH_LEFT_IRIS,
  FACEMESH_RIGHT_IRIS,
  FACEMESH_TESSELATION,
  FaceMesh,
} from '@mediapipe/face_mesh';
import { drawConnectors } from '@mediapipe/drawing_utils';

// Landmark sets requested by the proctoring spec.
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const LEFT_IRIS = [468, 469, 470, 471];
const RIGHT_IRIS = [473, 474, 475, 476];
const NOSE_TIP = 1;

const EAR_THRESHOLD = 0.2;
const GAZE_AWAY_THRESHOLD_MS = 2000;
const EYE_AWAY_FRAME_THRESHOLD = 18;

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// EAR: vertical eye openness divided by horizontal eye width.
// Lower EAR generally indicates a blink.
export function computeEAR(landmarks, eyeIndices) {
  const [leftCornerIdx, upper1Idx, upper2Idx, rightCornerIdx, lower1Idx, lower2Idx] = eyeIndices;
  const leftCorner = landmarks[leftCornerIdx];
  const upper1 = landmarks[upper1Idx];
  const upper2 = landmarks[upper2Idx];
  const rightCorner = landmarks[rightCornerIdx];
  const lower1 = landmarks[lower1Idx];
  const lower2 = landmarks[lower2Idx];

  const verticalA = distance(upper1, lower1);
  const verticalB = distance(upper2, lower2);
  const horizontal = distance(leftCorner, rightCorner);
  if (!horizontal) return 0;

  return (verticalA + verticalB) / (2 * horizontal);
}

function averagePoint(points) {
  const sum = points.reduce(
    (acc, p) => {
      acc.x += p.x;
      acc.y += p.y;
      return acc;
    },
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function eyeCenter(landmarks, eyeIndices) {
  return averagePoint(eyeIndices.map((idx) => landmarks[idx]));
}

function irisCenter(landmarks, irisIndices) {
  return averagePoint(irisIndices.map((idx) => landmarks[idx]));
}

function getGazeDirection(landmarks) {
  const leftIrisCenter = irisCenter(landmarks, LEFT_IRIS);
  const rightIrisCenter = irisCenter(landmarks, RIGHT_IRIS);
  const leftEyeCenter = eyeCenter(landmarks, LEFT_EYE);
  const rightEyeCenter = eyeCenter(landmarks, RIGHT_EYE);

  // Compare iris center against eye center; positive x => right, negative x => left.
  const xOffset = (leftIrisCenter.x - leftEyeCenter.x + (rightIrisCenter.x - rightEyeCenter.x)) / 2;
  const yOffset = (leftIrisCenter.y - leftEyeCenter.y + (rightIrisCenter.y - rightEyeCenter.y)) / 2;

  if (xOffset < -0.012) return 'left';
  if (xOffset > 0.012) return 'right';
  if (yOffset < -0.012) return 'up';
  if (yOffset > 0.012) return 'down';
  return 'center';
}

function detectHeadTurn(landmarks) {
  const nose = landmarks[NOSE_TIP];
  const leftFace = landmarks[33];
  const rightFace = landmarks[263];
  const faceCenterX = (leftFace.x + rightFace.x) / 2;
  return Math.abs(nose.x - faceCenterX) > 0.08;
}

function brightnessFromFrame(video, canvas) {
  if (!video || !canvas) return false;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  const width = 80;
  const height = 60;
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);
  const frame = ctx.getImageData(0, 0, width, height).data;
  let total = 0;
  for (let i = 0; i < frame.length; i += 4) {
    total += (frame[i] + frame[i + 1] + frame[i + 2]) / 3;
  }
  const avg = total / (frame.length / 4);
  return avg > 45;
}

export default function useFaceTracking({
  active,
  videoRef,
  canvasRef,
  onViolation,
  onTerminate,
  maxViolations = 10,
}) {
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [isLookingAway, setIsLookingAway] = useState(false);
  const [gazeDirection, setGazeDirection] = useState('center');
  const [blinkCount, setBlinkCount] = useState(0);
  const [violations, setViolations] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [lightingGood, setLightingGood] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const lastBlinkRef = useRef(false);
  const gazeAwaySinceRef = useRef(null);
  const warningCooldownRef = useRef({});
  const violationRef = useRef(0);
  const blinkTimestampsRef = useRef([]);
  const analysisCanvasRef = useRef(null);
  const eyeAwayFramesRef = useRef(0);

  const pushWarning = useCallback(
    (message, key = message, cooldownMs = 1500) => {
      const now = Date.now();
      const last = warningCooldownRef.current[key] || 0;
      if (now - last < cooldownMs) return;
      warningCooldownRef.current[key] = now;

      setWarnings((prev) => [...prev, message].slice(-4));
      setViolations((prev) => {
        const next = prev + 1;
        violationRef.current = next;
        onViolation?.(message);
        if (next > maxViolations) {
          onTerminate?.(message);
        }
        return next;
      });
    },
    [maxViolations, onTerminate, onViolation],
  );

  const processLandmarks = useCallback(
    (landmarks, now) => {
      const leftEAR = computeEAR(landmarks, LEFT_EYE);
      const rightEAR = computeEAR(landmarks, RIGHT_EYE);
      const ear = (leftEAR + rightEAR) / 2;

      const isBlink = ear < EAR_THRESHOLD;
      if (isBlink && !lastBlinkRef.current) {
        setBlinkCount((prev) => prev + 1);
        blinkTimestampsRef.current.push(now);
      }
      lastBlinkRef.current = isBlink;

      // If blink frequency spikes too high, flag suspicious behavior.
      blinkTimestampsRef.current = blinkTimestampsRef.current.filter((t) => now - t < 60000);
      if (blinkTimestampsRef.current.length > 30) {
        pushWarning('Unusually frequent blinking detected.', 'high-blink-rate', 8000);
      }

      const gaze = getGazeDirection(landmarks);
      setGazeDirection(gaze);

      const headTurned = detectHeadTurn(landmarks);
      const away = gaze !== 'center' || headTurned;
      setIsLookingAway(away);

      if (gaze !== 'center') {
        eyeAwayFramesRef.current += 1;
      } else {
        eyeAwayFramesRef.current = 0;
      }
      if (eyeAwayFramesRef.current >= EYE_AWAY_FRAME_THRESHOLD) {
        pushWarning('Eyes looking away from screen detected.', 'eye-away', 2000);
      }

      if (away) {
        if (!gazeAwaySinceRef.current) gazeAwaySinceRef.current = now;
        if (now - gazeAwaySinceRef.current >= GAZE_AWAY_THRESHOLD_MS) {
          pushWarning('Please look at the screen.', 'look-away', 2500);
        }
      } else {
        gazeAwaySinceRef.current = null;
      }
    },
    [pushWarning],
  );

  useEffect(() => {
    if (!active) return undefined;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;

    let cancelled = false;
    analysisCanvasRef.current = document.createElement('canvas');

    const setup = async () => {
      const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      // FaceMesh predicts 468+ landmarks on detected faces each frame.
      faceMesh.setOptions({
        maxNumFaces: 2,
        refineLandmarks: true, // Enables iris landmarks for gaze tracking.
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results) => {
        if (cancelled) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const faces = results.multiFaceLandmarks || [];
        setFaceCount(faces.length);
        setIsFaceDetected(faces.length > 0);
        setCameraReady(true);

        const bright = brightnessFromFrame(video, analysisCanvasRef.current);
        setLightingGood(bright);

        if (faces.length === 0) {
          pushWarning('Face not detected', 'no-face', 2000);
          return;
        }
        if (faces.length > 1) {
          pushWarning('Multiple faces detected', 'multi-face', 2000);
        }

        faces.forEach((landmarks) => {
          drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
            color: 'rgba(34,197,94,0.18)',
            lineWidth: 1,
          });
          drawConnectors(ctx, landmarks, FACEMESH_LEFT_IRIS, { color: '#38bdf8', lineWidth: 2 });
          drawConnectors(ctx, landmarks, FACEMESH_RIGHT_IRIS, { color: '#38bdf8', lineWidth: 2 });
        });

        // Use the first face for behavioral analysis when multiple faces appear.
        processLandmarks(faces[0], performance.now());
      });

      faceMeshRef.current = faceMesh;

      const camera = new Camera(video, {
        width: 640,
        height: 480,
        onFrame: async () => {
          if (!cancelled && faceMeshRef.current) {
            await faceMeshRef.current.send({ image: video });
          }
        },
      });

      cameraRef.current = camera;
      await camera.start();
    };

    setup().catch(() => {
      setCameraReady(false);
      pushWarning('Camera initialization failed', 'camera-init', 4000);
    });

    return () => {
      cancelled = true;
      try {
        cameraRef.current?.stop();
      } catch {
        // no-op
      }
      if (video.srcObject) {
        const stream = video.srcObject;
        if (stream.getTracks) {
          stream.getTracks().forEach((track) => track.stop());
        }
        video.srcObject = null;
      }
      faceMeshRef.current?.close();
      faceMeshRef.current = null;
      cameraRef.current = null;
    };
  }, [active, videoRef, canvasRef, processLandmarks, pushWarning]);

  return useMemo(
    () => ({
      isFaceDetected,
      faceCount,
      isLookingAway,
      gazeDirection,
      blinkCount,
      violations,
      warnings,
      lightingGood,
      cameraReady,
    }),
    [
      isFaceDetected,
      faceCount,
      isLookingAway,
      gazeDirection,
      blinkCount,
      violations,
      warnings,
      lightingGood,
      cameraReady,
    ],
  );
}

