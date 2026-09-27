import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AudioLines,
  CalendarCheck2,
  Check,
  Clock3,
  LoaderCircle,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Square,
  Volume2,
  Zap,
} from 'lucide-react';
import { scenarios } from '../data.js';

const actionIcons = [Zap, CalendarCheck2, Check, Radio];
const LiveAgentControls = lazy(() => import('./LiveAgentControls.jsx'));

function estimatedDelay(text) {
  return Math.max(1800, Math.min(4600, text.length * 34));
}

function speakLocally(text, role = 'assistant') {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      window.setTimeout(resolve, estimatedDelay(text));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const spanishVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith('es'));
    const preferredVoice = role === 'caller'
      ? spanishVoices[1] ?? spanishVoices[0]
      : spanishVoices[0];
    let settled = false;
    const timeout = window.setTimeout(() => finish(), estimatedDelay(text) + 1200);

    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    }

    utterance.lang = 'es-ES';
    utterance.rate = role === 'caller' ? 1.02 : 0.96;
    utterance.pitch = role === 'caller' ? 0.92 : 1.02;
    utterance.onend = finish;
    utterance.onerror = finish;
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  });
}

async function apiErrorCode(response) {
  try {
    const payload = await response.json();
    return payload?.error?.code || 'VOICE_ERROR';
  } catch {
    return 'VOICE_ERROR';
  }
}

function friendlyVoiceError(code) {
  if (code === 'DEMO_RATE_LIMIT' || code === 'ELEVENLABS_RATE_LIMIT' || code === 'DEMO_BUSY') {
    return 'La demo está temporalmente ocupada. Vuelve a intentarlo en unos minutos.';
  }
  if (code === 'ELEVENLABS_TIMEOUT' || code === 'ELEVENLABS_UNAVAILABLE') {
    return 'La voz está tardando más de lo esperado. Usaremos la vista previa local.';
  }
  return 'No hemos podido preparar esta muestra. Usaremos la vista previa local.';
}

function stopHtmlAudio(audioRef) {
  const audio = audioRef.current;
  if (!audio) return;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  audioRef.current = null;
}

function voiceMetadata(voice) {
  return [voice.accent, voice.gender, voice.useCase]
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
}

export default function VoiceDemo({ hasLiveAgent, onActivityChange, playRequest = 0 }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [lineIndex, setLineIndex] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voiceState, setVoiceState] = useState('loading');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [voiceRetry, setVoiceRetry] = useState(0);
  const [audioState, setAudioState] = useState('idle');
  const [sampleState, setSampleState] = useState('idle');
  const sectionRef = useRef(null);
  const mainAudioRef = useRef(null);
  const sampleAudioRef = useRef(null);
  const sampleAbortRef = useRef(null);

  const scenario = useMemo(
    () => scenarios.find((item) => item.id === scenarioId) ?? scenarios[0],
    [scenarioId],
  );
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) ?? null,
    [selectedVoiceId, voices],
  );
  const callerVoice = useMemo(() => {
    const alternatives = voices.filter((voice) => voice.id !== selectedVoiceId);
    return alternatives.find((voice) => (
      voice.spanishVerified
      && voice.gender
      && voice.gender !== selectedVoice?.gender
    )) ?? alternatives.find((voice) => voice.spanishVerified) ?? alternatives[0] ?? selectedVoice;
  }, [selectedVoice, selectedVoiceId, voices]);
  const elevenLabsReady = voiceState === 'ready' && Boolean(selectedVoice);

  const stopSample = useCallback(() => {
    sampleAbortRef.current?.abort();
    sampleAbortRef.current = null;
    stopHtmlAudio(sampleAudioRef);
    window.speechSynthesis?.cancel();
    setSampleState('idle');
  }, []);

  const stopMainAudio = useCallback(() => {
    stopHtmlAudio(mainAudioRef);
    window.speechSynthesis?.cancel();
    setAudioState('idle');
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadVoices() {
      setVoiceState('loading');
      setVoiceNotice('');
      try {
        const statusResponse = await fetch('/api/elevenlabs/status', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!statusResponse.ok) throw new Error('status');
        const status = await statusResponse.json();
        if (!status.configured) {
          setVoices([]);
          setSelectedVoiceId('');
          setVoiceState('unconfigured');
          return;
        }

        const voicesResponse = await fetch('/api/elevenlabs/voices', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!voicesResponse.ok) {
          const error = new Error('voices');
          error.code = await apiErrorCode(voicesResponse);
          throw error;
        }
        const payload = await voicesResponse.json();
        const nextVoices = Array.isArray(payload.voices) ? payload.voices : [];
        if (!nextVoices.length) {
          setVoices([]);
          setSelectedVoiceId('');
          setVoiceState('empty');
          return;
        }

        setVoices(nextVoices);
        setSelectedVoiceId((current) => (
          nextVoices.some((voice) => voice.id === current) ? current : nextVoices[0].id
        ));
        setVoiceState('ready');
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setVoiceState('error');
        setVoiceNotice(
          error?.code === 'ELEVENLABS_AUTH_ERROR'
            ? 'La voz de demostración no está disponible ahora.'
            : 'No hemos podido cargar las voces. La demo local sigue disponible.',
        );
      }
    }

    loadVoices();
    return () => controller.abort();
  }, [voiceRetry]);

  useEffect(() => {
    onActivityChange(isPlaying || liveActive || sampleState === 'playing');
  }, [isPlaying, liveActive, onActivityChange, sampleState]);

  useEffect(() => {
    if (playRequest <= 0) return;
    stopSample();
    stopMainAudio();
    setLineIndex(0);
    setPlaying(true);
  }, [playRequest, stopMainAudio, stopSample]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const controller = new AbortController();
    let cancelled = false;
    let objectUrl = '';

    async function playCurrentLine() {
      const activeLine = scenario.lines[lineIndex];

      if (elevenLabsReady) {
        const activeVoiceId = activeLine.role === 'assistant'
          ? selectedVoiceId
          : callerVoice?.id ?? selectedVoiceId;
        setAudioState('loading');
        try {
          const response = await fetch('/api/elevenlabs/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              voiceId: activeVoiceId,
              scenarioId: scenario.id,
              lineIndex,
            }),
            signal: controller.signal,
          });
          if (!response.ok) {
            const error = new Error('speech');
            error.code = await apiErrorCode(response);
            throw error;
          }

          const audioBlob = await response.blob();
          objectUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(objectUrl);
          audio.preload = 'auto';
          mainAudioRef.current = audio;
          setAudioState('playing');
          await new Promise((resolve, reject) => {
            audio.onended = resolve;
            audio.onerror = () => reject(new Error('audio'));
            audio.play().catch(reject);
          });
        } catch (error) {
          if (error?.name === 'AbortError' || cancelled) return;
          setVoiceNotice(friendlyVoiceError(error?.code));
          await speakLocally(activeLine.text, activeLine.role);
        } finally {
          stopHtmlAudio(mainAudioRef);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = '';
        }
      } else {
        setAudioState('playing');
        await speakLocally(activeLine.text, activeLine.role);
      }

      if (cancelled) return;
      setAudioState('idle');
      if (lineIndex >= scenario.lines.length - 1) {
        setPlaying(false);
        setLineIndex(0);
        return;
      }
      setLineIndex((current) => current + 1);
    }

    playCurrentLine();
    return () => {
      cancelled = true;
      controller.abort();
      stopHtmlAudio(mainAudioRef);
      window.speechSynthesis?.cancel();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callerVoice, elevenLabsReady, isPlaying, lineIndex, scenario, selectedVoiceId]);

  useEffect(
    () => () => {
      sampleAbortRef.current?.abort();
      stopHtmlAudio(mainAudioRef);
      stopHtmlAudio(sampleAudioRef);
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const selectScenario = (id) => {
    stopSample();
    stopMainAudio();
    setScenarioId(id);
    setLineIndex(0);
    setPlaying(false);
    setVoiceNotice('');
  };

  const selectVoice = (id) => {
    stopSample();
    stopMainAudio();
    setSelectedVoiceId(id);
    setLineIndex(0);
    setPlaying(false);
    setVoiceNotice('');
  };

  const togglePlayback = () => {
    stopSample();
    stopMainAudio();
    if (!isPlaying && lineIndex >= scenario.lines.length - 1) setLineIndex(0);
    setPlaying((current) => !current);
  };

  const toggleSample = async () => {
    if (sampleState === 'loading' || sampleState === 'playing') {
      stopSample();
      return;
    }

    stopMainAudio();
    setPlaying(false);
    setLineIndex(0);
    setVoiceNotice('');
    setSampleState('loading');

    if (!elevenLabsReady) {
      setSampleState('playing');
      await speakLocally(scenario.lines[0].text, 'assistant');
      setSampleState('idle');
      return;
    }

    const controller = new AbortController();
    sampleAbortRef.current = controller;
    let objectUrl = '';
    try {
      let source = selectedVoice.previewUrl;
      if (!source) {
        const response = await fetch('/api/elevenlabs/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId: selectedVoiceId,
            scenarioId: scenario.id,
            lineIndex: 0,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = new Error('sample');
          error.code = await apiErrorCode(response);
          throw error;
        }
        objectUrl = URL.createObjectURL(await response.blob());
        source = objectUrl;
      }

      const audio = new Audio(source);
      audio.preload = 'auto';
      sampleAudioRef.current = audio;
      setSampleState('playing');
      await new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = () => reject(new Error('audio'));
        audio.play().catch(reject);
      });
    } catch (error) {
      if (error?.name !== 'AbortError') setVoiceNotice(friendlyVoiceError(error?.code));
    } finally {
      stopHtmlAudio(sampleAudioRef);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (sampleAbortRef.current === controller) sampleAbortRef.current = null;
      setSampleState('idle');
    }
  };

  const handleTabKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + scenarios.length) % scenarios.length;
    selectScenario(scenarios[nextIndex].id);
    document.getElementById(`demo-tab-${scenarios[nextIndex].id}`)?.focus();
  };

  const activeAction = Math.min(
    scenario.actions.length - 1,
    Math.floor((lineIndex / Math.max(1, scenario.lines.length - 1)) * scenario.actions.length),
  );
  const progress = isPlaying || lineIndex > 0 ? ((lineIndex + 1) / scenario.lines.length) * 100 : 0;
  const voiceStatusText = {
    loading: 'Cargando voces de ElevenLabs…',
    ready: `Diálogo completo · ElevenLabs${selectedVoice?.spanishVerified ? ' · Español' : ''}`,
    unconfigured: 'Vista previa local',
    empty: 'No hay voces disponibles para esta demo',
    error: 'Catálogo de voces no disponible',
  }[voiceState];
  const sampleButtonText = sampleState === 'loading'
    ? 'Preparando…'
    : sampleState === 'playing'
      ? 'Detener muestra'
      : 'Escuchar muestra';

  return (
    <div className="demo-shell" ref={sectionRef} data-voice-state={voiceState}>
      <div className="demo-tabs" role="tablist" aria-label="Sector de la llamada">
        {scenarios.map((item, index) => (
          <button
            id={`demo-tab-${item.id}`}
            key={item.id}
            type="button"
            role="tab"
            aria-controls="demo-panel"
            aria-selected={scenarioId === item.id}
            tabIndex={scenarioId === item.id ? 0 : -1}
            className={scenarioId === item.id ? 'demo-tab is-active' : 'demo-tab'}
            onClick={() => selectScenario(item.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="demo-voicebar">
        <div className="demo-voicebar__identity">
          <span className="demo-voicebar__icon"><AudioLines size={19} /></span>
          <div>
            <label htmlFor="demo-voice-select">Voz de NORA</label>
            <span className={`voice-status voice-status--${voiceState}`} aria-live="polite">
              <i aria-hidden="true" /> {voiceStatusText}
            </span>
          </div>
        </div>

        <div className="demo-voicebar__field">
          {voiceState === 'ready' ? (
            <select
              id="demo-voice-select"
              value={selectedVoiceId}
              onChange={(event) => selectVoice(event.target.value)}
              aria-label="Seleccionar voz de NORA"
            >
              {voices.map((voice) => (
                <option value={voice.id} key={voice.id}>
                  {voice.name}{voiceMetadata(voice) ? ` — ${voiceMetadata(voice)}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <select id="demo-voice-select" disabled aria-label="Voz de NORA no disponible">
              <option>{voiceState === 'loading' ? 'Consultando catálogo…' : 'NORA · Voz local'}</option>
            </select>
          )}
        </div>

        {voiceState === 'error' || voiceState === 'empty' ? (
          <button className="voice-sample-button" type="button" onClick={() => setVoiceRetry((value) => value + 1)}>
            <RefreshCw size={17} /> <span>Reintentar</span>
          </button>
        ) : (
          <button
            className="voice-sample-button"
            type="button"
            onClick={toggleSample}
            disabled={voiceState === 'loading'}
            aria-pressed={sampleState === 'playing'}
            aria-busy={sampleState === 'loading'}
            aria-label={`${sampleButtonText}${selectedVoice ? ` de ${selectedVoice.name}` : ''}`}
          >
            {sampleState === 'loading' ? (
              <LoaderCircle className="is-spinning" size={17} />
            ) : sampleState === 'playing' ? (
              <Square size={15} fill="currentColor" />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
            <span>{sampleButtonText}</span>
          </button>
        )}

        <p className="demo-voicebar__notice" role={voiceNotice ? 'status' : undefined}>
          {voiceNotice || '\u00a0'}
        </p>
      </div>

      <div
        className="demo-console"
        id="demo-panel"
        role="tabpanel"
        aria-labelledby={`demo-tab-${scenario.id}`}
      >
        <div className="demo-call">
          <div className="demo-call__header">
            <div>
              <span className="eyebrow eyebrow--status">
                <i aria-hidden="true" /> {isPlaying ? 'Llamada en curso' : 'Simulación de flujo'}
              </span>
              <h3>{scenario.context}</h3>
            </div>
            <div className="demo-call__meta" aria-label={`Duración ${scenario.duration}`}>
              <Clock3 size={16} />
              <span>{scenario.duration}</span>
            </div>
          </div>

          <div className="waveform" aria-hidden="true" data-active={isPlaying || sampleState === 'playing'}>
            {Array.from({ length: 34 }, (_, index) => (
              <span
                key={index}
                style={{ '--bar-height': `${22 + ((index * 37) % 71)}%`, '--bar-delay': `${index * -0.04}s` }}
              />
            ))}
          </div>

          <div className="transcript" aria-live="polite">
            {scenario.lines.map((line, index) => (
              <div
                className={`transcript__line transcript__line--${line.role} ${
                  index === lineIndex && (isPlaying || lineIndex > 0 || index === 0) ? 'is-current' : ''
                } ${index < lineIndex ? 'is-past' : ''}`}
                key={`${scenario.id}-${index}`}
              >
                <span>{line.role === 'assistant' ? 'NORA' : scenario.caller}</span>
                <p>{line.text}</p>
              </div>
            ))}
          </div>

          <div className="demo-controls">
            <button
              className="demo-play"
              type="button"
              onClick={togglePlayback}
              aria-label={`${isPlaying ? 'Pausar' : 'Reproducir'} llamada con voces ElevenLabs`}
            >
              {isPlaying && audioState === 'loading' ? (
                <LoaderCircle className="is-spinning" size={19} />
              ) : isPlaying ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
              <span>
                {isPlaying && audioState === 'loading'
                  ? 'Preparando voz…'
                  : isPlaying
                    ? 'Pausar'
                    : lineIndex > 0
                      ? 'Continuar'
                      : 'Reproducir llamada'}
              </span>
            </button>
            <div className="demo-progress" aria-label={`Progreso ${Math.round(progress)} %`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <Volume2 className="demo-volume" size={18} aria-label="Audio activado" />
          </div>
        </div>

        <aside className="demo-actions" aria-label="Acciones realizadas">
          <div className="demo-actions__heading">
            <span>Acciones en tiempo real</span>
            <b>{String(Math.min(activeAction + 1, scenario.actions.length)).padStart(2, '0')}</b>
          </div>
          <div className="demo-action-list">
            {scenario.actions.map(([title, value], index) => {
              const Icon = actionIcons[index];
              const isComplete = index < activeAction || (!isPlaying && lineIndex === 0 && index === 0);
              const isCurrent = index === activeAction && (isPlaying || lineIndex > 0);
              return (
                <div
                  className={`demo-action ${isComplete ? 'is-complete' : ''} ${isCurrent ? 'is-current' : ''}`}
                  key={title}
                >
                  <span className="demo-action__icon"><Icon size={17} /></span>
                  <div>
                    <p>{title}</p>
                    <span>{value}</span>
                  </div>
                  {isComplete && <Check size={16} className="demo-action__check" />}
                </div>
              );
            })}
          </div>

          <div className="demo-result">
            <span>Resultado</span>
            <strong>{scenario.actions.at(-2)[1]}</strong>
            <p>Resumen y siguiente acción registrados.</p>
          </div>

          {hasLiveAgent && (
            <Suspense fallback={<div className="live-agent live-agent--loading">Preparando voz en directo…</div>}>
              <LiveAgentControls onLiveState={setLiveActive} />
            </Suspense>
          )}
        </aside>
      </div>
    </div>
  );
}
