import { useCallback, useEffect, useState } from 'react';

export default function useFullscreen({ active, onViolation }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const requestFullscreen = useCallback(async () => {
    const root = document.documentElement;
    if (document.fullscreenElement) return true;
    try {
      if (root.requestFullscreen) {
        await root.requestFullscreen();
      }
      setIsFullscreen(!!document.fullscreenElement);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);
      if (active && !inFullscreen) {
        onViolation?.('Fullscreen mode exited.');
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [active, onViolation]);

  return {
    isFullscreen,
    requestFullscreen,
  };
}

