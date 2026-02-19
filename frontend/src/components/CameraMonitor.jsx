import { useEffect, useMemo, useRef } from 'react';
import useFaceTracking from '../hooks/useFaceTracking.js';

function CameraMonitor({ active, onStatusChange, onViolation, onTerminate }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const {
    isFaceDetected,
    faceCount,
    isLookingAway,
    gazeDirection,
    blinkCount,
    violations,
    warnings,
    lightingGood,
    cameraReady,
  } = useFaceTracking({
    active,
    videoRef,
    canvasRef,
    onViolation,
    onTerminate,
  });

  useEffect(() => {
    onStatusChange?.({
      faceCount,
      lookingAway: isLookingAway,
      lightingGood,
      cameraReady,
    });
  }, [cameraReady, faceCount, isLookingAway, lightingGood, onStatusChange]);

  const statusLabel = useMemo(() => {
    if (!cameraReady) return 'Camera offline';
    if (!isFaceDetected) return 'Face not detected';
    if (faceCount > 1) return 'Multiple faces detected';
    if (isLookingAway) return 'Please look at the screen';
    if (!lightingGood) return 'Lighting is low';
    return 'Monitoring active';
  }, [cameraReady, isFaceDetected, faceCount, isLookingAway, lightingGood]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-black/90 shadow-sm dark:border-slate-700/50">
      <div className="relative aspect-video w-full overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full -scale-x-100 transform object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 transform"
        />
      </div>

      <div className="space-y-1 px-3 py-2 text-[11px] text-slate-200">
        <p className="font-medium">{statusLabel}</p>
        <div className="grid grid-cols-2 gap-1 text-slate-300/90">
          <span>Faces: {faceCount}</span>
          <span>Blinks: {blinkCount}</span>
          <span>Gaze: {gazeDirection}</span>
          <span>Violations: {violations}</span>
        </div>
        {warnings.length > 0 && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-1.5 text-[10px] text-red-200">
            {warnings[warnings.length - 1]}
          </div>
        )}
      </div>
    </div>
  );
}

export default CameraMonitor;

