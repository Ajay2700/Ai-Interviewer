import { useEffect, useRef, useState } from 'react';

const MIME_TYPE = 'audio/webm';

function Recorder({ onRecorded, isDisabled, maxSeconds = 120, onTick }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.MediaRecorder) {
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (onTick) onTick(next);
        if (next >= maxSeconds) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const resetTimer = () => {
    setElapsed(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!isSupported || isDisabled || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: MIME_TYPE });
        if (onRecorded) {
          onRecorded(blob);
        }
        resetTimer();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      // likely permission error
      console.error('Microphone error', err);
      alert('Unable to access microphone. Please check browser permissions.');
      setIsRecording(false);
      resetTimer();
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (!isSupported) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Your browser does not support audio recording. Please use a modern browser like Chrome or Edge.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleRecording}
          disabled={isDisabled}
          className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            isRecording
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-white" />
          {isRecording ? 'Stop recording' : 'Start recording'}
        </button>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {elapsed}s / {maxSeconds}s
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        We only record locally in your browser and send the audio securely to the backend for transcription & evaluation.
      </p>
    </div>
  );
}

export default Recorder;

