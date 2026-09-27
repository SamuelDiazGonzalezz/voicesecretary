import { useEffect, useState } from 'react';
import { CircleStop, Mic2 } from 'lucide-react';
import { useConversationControls, useConversationStatus } from '@elevenlabs/react';

export default function LiveAgentControls({ onLiveState }) {
  const { startSession, endSession } = useConversationControls();
  const { status, message } = useConversationStatus();
  const [permissionError, setPermissionError] = useState('');
  const isLive = status === 'connected' || status === 'connecting';

  useEffect(() => {
    onLiveState(isLive);
    return () => onLiveState(false);
  }, [isLive, onLiveState]);

  const handleLiveSession = async () => {
    setPermissionError('');
    if (isLive) {
      endSession();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      startSession({
        onError: (error) => setPermissionError(String(error)),
      });
    } catch {
      setPermissionError('Activa el micrófono para iniciar la conversación.');
    }
  };

  return (
    <div className="live-agent">
      <button
        className="button button--live"
        type="button"
        onClick={handleLiveSession}
        aria-pressed={isLive}
      >
        {isLive ? <CircleStop size={18} /> : <Mic2 size={18} />}
        {status === 'connecting'
          ? 'Conectando…'
          : status === 'connected'
            ? 'Terminar conversación'
            : 'Hablar con NORA'}
      </button>
      {(permissionError || (status === 'error' && message)) && (
        <p className="live-agent__error" role="alert">
          {permissionError || message}
        </p>
      )}
    </div>
  );
}
