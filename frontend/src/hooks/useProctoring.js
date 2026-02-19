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
  const [events, setEvents] = useState([]);

  const appendEvent = useCallback((type, message, counted = false, metadata = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message: message || 'Proctoring event',
      counted,
      metadata,
    };
    setEvents((prev) => [...prev, entry].slice(-500));
  }, []);

  const onWarning = useCallback((message) => {
    setWarning(message || 'Suspicious activity detected');
    appendEvent('warning', message || 'Suspicious activity detected', false);
  }, [appendEvent]);

  const onViolation = useCallback((message, options = {}) => {
    const { count = true } = options;
    setWarning(message || 'Suspicious activity detected');
    appendEvent('violation', message || 'Suspicious activity detected', count);
    if (!count) return;
    setViolations((prev) => prev + 1);
  }, [appendEvent]);

  const captureClientSignals = useCallback(() => {
    const metadata = {
      userAgent: navigator.userAgent || '',
      platform: navigator.platform || '',
      language: navigator.language || '',
      webdriver: !!navigator.webdriver,
      pluginsCount: navigator.plugins?.length || 0,
      isExtendedScreen: !!window.screen?.isExtended,
      extensionEnumerationSupported: false,
      note: 'Browser sandbox does not allow full installed extension/tool enumeration.',
    };
    appendEvent('client_signals', 'Captured detectable browser signals.', false, metadata);
  }, [appendEvent]);

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!active) return;
    captureClientSignals();

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
  }, [active, captureClientSignals, onViolation]);

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
    events,
    appendEvent,
    clearEvents,
    captureClientSignals,
  };
}

