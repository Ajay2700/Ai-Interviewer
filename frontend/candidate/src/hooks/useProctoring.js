import { useCallback, useEffect, useMemo, useState } from 'react';

const TERMINATION_THRESHOLD = 10;

export default function useProctoring({ active }) {
  const [violations, setViolations] = useState(0);
  const [warning, setWarning] = useState('');
  const [faceStatus, setFaceStatus] = useState({
    faceCount: 0,
    lookingAway: false,
    lightingGood: false,
    cameraReady: false,
  });
  const [micReady, setMicReady] = useState(false);

  const onWarning = useCallback((message) => {
    setWarning(message || 'Suspicious activity detected');
  }, []);

  const onViolation = useCallback((message, options = {}) => {
    const { count = true } = options;
    setWarning(message || 'Suspicious activity detected');
    if (!count) return;
    setViolations((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!active) return;

    const onVisibility = () => {
      if (document.hidden) onViolation('Tab switching detected.');
    };
    const onBlur = () => onViolation('Window focus lost.');
    const onContextMenu = (event) => {
      event.preventDefault();
      onViolation('Right-click is disabled during interview.');
    };
    const onCopyPasteCut = (event) => {
      event.preventDefault();
      onViolation('Copy/paste actions are blocked.');
    };
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const blocked =
        key === 'f12' ||
        (ctrlOrMeta && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
        (ctrlOrMeta && (key === 'c' || key === 'v' || key === 'x' || key === 'u'));
      if (blocked) {
        event.preventDefault();
        onViolation('Restricted keyboard shortcut detected.');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopyPasteCut);
    document.addEventListener('paste', onCopyPasteCut);
    document.addEventListener('cut', onCopyPasteCut);
    window.addEventListener('keydown', onKeyDown);

    // Best effort only: browsers cannot reliably enforce multi-screen detection.
    const screenCheck = window.setInterval(() => {
      if (window.screen?.isExtended) {
        onViolation('Multiple display setup detected.');
      }
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopyPasteCut);
      document.removeEventListener('paste', onCopyPasteCut);
      document.removeEventListener('cut', onCopyPasteCut);
      window.removeEventListener('keydown', onKeyDown);
      window.clearInterval(screenCheck);
    };
  }, [active, onViolation]);

  const runMicCheck = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicReady(true);
      return true;
    } catch {
      setMicReady(false);
      return false;
    }
  }, []);

  const clearWarning = useCallback(() => setWarning(''), []);

  const terminated = violations >= TERMINATION_THRESHOLD;
  const environmentReady = useMemo(() => {
    return micReady && faceStatus.cameraReady && faceStatus.faceCount === 1 && faceStatus.lightingGood;
  }, [faceStatus, micReady]);

  return {
    violations,
    warning,
    clearWarning,
    onWarning,
    onViolation,
    faceStatus,
    setFaceStatus,
    micReady,
    runMicCheck,
    terminated,
    environmentReady,
    terminationThreshold: TERMINATION_THRESHOLD,
  };
}

