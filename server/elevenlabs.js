import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { scenarios } from '../src/data.js';

const API_BASE = 'https://api.elevenlabs.io';
const VOICE_CACHE_TTL = 5 * 60 * 1000;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const CACHE_DIR = path.resolve('.cache', 'elevenlabs');
const pendingAudio = new Map();

let voiceCache = {
  expiresAt: 0,
  keyFingerprint: '',
  voices: [],
};
let activeGenerations = 0;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function envFlag(name, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes';
}

function getConfig(isProduction) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? '';
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_v3';
  const configuredLimit = Number.parseInt(process.env.ELEVENLABS_VOICE_LIMIT ?? '8', 10);
  const voiceLimit = Number.isFinite(configuredLimit)
    ? Math.max(1, Math.min(20, configuredLimit))
    : 8;
  const voiceIds = new Set(
    (process.env.ELEVENLABS_VOICE_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const enabled = Boolean(apiKey) && (!isProduction || envFlag('ELEVENLABS_DEMO_API_ENABLED'));

  return { apiKey, enabled, modelId, voiceIds, voiceLimit };
}

function keyFingerprint(apiKey) {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
}

function spanishDetails(voice) {
  const verified = Array.isArray(voice.verified_languages)
    ? voice.verified_languages
    : [];
  return verified.find((language) => language.locale === 'es-ES')
    ?? verified.find((language) => language.language === 'es')
    ?? null;
}

function publicVoice(voice) {
  const spanish = spanishDetails(voice);
  const labels = voice.labels && typeof voice.labels === 'object' ? voice.labels : {};
  const spanishLabel = String(labels.language || '').toLowerCase().startsWith('es');

  return {
    id: voice.voice_id,
    name: voice.name || 'Voz sin nombre',
    category: voice.category || 'custom',
    description: voice.description || '',
    accent: spanish?.accent || labels.accent || '',
    gender: labels.gender || '',
    useCase: labels.use_case || labels.usecase || '',
    locale: spanish?.locale || (spanishLabel ? 'es' : ''),
    spanishVerified: Boolean(spanish || spanishLabel),
    previewUrl: spanish?.preview_url || voice.preview_url || '',
  };
}

function rankVoices(voices) {
  return [...voices].sort((left, right) => {
    const spanishDifference = Number(right.spanishVerified) - Number(left.spanishVerified);
    if (spanishDifference) return spanishDifference;
    const categoryScore = (voice) => ({ cloned: 2, professional: 1 }[voice.category] ?? 0);
    const categoryDifference = categoryScore(right) - categoryScore(left);
    if (categoryDifference) return categoryDifference;
    const conversational = (voice) => voice.useCase === 'conversational' ? 1 : 0;
    const conversationalDifference = conversational(right) - conversational(left);
    if (conversationalDifference) return conversationalDifference;
    return left.name.localeCompare(right.name, 'es');
  });
}

async function upstreamJson(url, apiKey, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw new ApiError(504, 'ELEVENLABS_TIMEOUT', 'ElevenLabs no respondió a tiempo.');
    }
    throw new ApiError(502, 'ELEVENLABS_UNAVAILABLE', 'No se pudo conectar con ElevenLabs.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(503, 'ELEVENLABS_AUTH_ERROR', 'La configuración de ElevenLabs no es válida.');
  }
  if (response.status === 429) {
    throw new ApiError(429, 'ELEVENLABS_RATE_LIMIT', 'ElevenLabs ha limitado temporalmente la cuenta.');
  }
  if (!response.ok) {
    throw new ApiError(502, 'ELEVENLABS_UPSTREAM_ERROR', 'ElevenLabs no pudo completar la solicitud.');
  }

  return response.json();
}

async function loadVoices(config, fetchImpl, { force = false } = {}) {
  const fingerprint = keyFingerprint(config.apiKey);
  if (
    !force
    && voiceCache.keyFingerprint === fingerprint
    && voiceCache.expiresAt > Date.now()
  ) {
    return voiceCache.voices;
  }

  const url = new URL('/v2/voices', API_BASE);
  url.searchParams.set('page_size', '100');
  url.searchParams.set('include_total_count', 'false');
  const payload = await upstreamJson(url, config.apiKey, fetchImpl);
  const available = Array.isArray(payload.voices)
    ? rankVoices(payload.voices.map(publicVoice).filter((voice) => voice.id))
    : [];
  const allowed = config.voiceIds.size
    ? available.filter((voice) => config.voiceIds.has(voice.id))
    : available;
  const voices = allowed.slice(0, config.voiceLimit);

  voiceCache = {
    expiresAt: Date.now() + VOICE_CACHE_TTL,
    keyFingerprint: fingerprint,
    voices,
  };
  return voices;
}

function resolveExample(scenarioId, lineIndex) {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  const index = Number(lineIndex);
  const line = scenario?.lines[index];
  if (!scenario || !Number.isInteger(index) || !line) {
    throw new ApiError(400, 'INVALID_EXAMPLE', 'El ejemplo solicitado no existe.');
  }
  return {
    nextText: scenario.lines[index + 1]?.text || '',
    previousText: scenario.lines[index - 1]?.text || '',
    role: line.role,
    text: line.text,
  };
}

function audioCachePath({ voiceId, modelId, role, text }) {
  const hash = createHash('sha256')
    .update(JSON.stringify({ voiceId, modelId, role, text }))
    .digest('hex');
  return path.join(CACHE_DIR, `${hash}.mp3`);
}

async function generateAudio(config, voiceId, example, fetchImpl) {
  if (activeGenerations >= 2) {
    throw new ApiError(429, 'DEMO_BUSY', 'La demo está preparando otras voces.');
  }
  activeGenerations += 1;

  try {
    const url = new URL(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, API_BASE);
    url.searchParams.set('output_format', 'mp3_44100_128');
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': config.apiKey,
        },
        body: JSON.stringify({
          text: example.text,
          model_id: config.modelId,
          ...(config.modelId === 'eleven_v3' ? { language_code: 'es' } : {}),
          ...(config.modelId !== 'eleven_v3' ? {
            previous_text: example.previousText || undefined,
            next_text: example.nextText || undefined,
          } : {}),
          voice_settings: {
            stability: example.role === 'assistant' ? 0.42 : 0.36,
            similarity_boost: 0.82,
            style: example.role === 'assistant' ? 0.18 : 0.28,
            use_speaker_boost: true,
            speed: example.role === 'assistant' ? 0.98 : 1.02,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError') {
        throw new ApiError(504, 'ELEVENLABS_TIMEOUT', 'La voz tardó demasiado en generarse.');
      }
      throw new ApiError(502, 'ELEVENLABS_UNAVAILABLE', 'No se pudo conectar con ElevenLabs.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new ApiError(503, 'ELEVENLABS_AUTH_ERROR', 'La configuración de ElevenLabs no es válida.');
    }
    if (response.status === 429) {
      throw new ApiError(429, 'ELEVENLABS_RATE_LIMIT', 'ElevenLabs ha limitado temporalmente la cuenta.');
    }
    if (!response.ok) {
      throw new ApiError(502, 'ELEVENLABS_UPSTREAM_ERROR', 'ElevenLabs no pudo generar esta voz.');
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length || audio.length > MAX_AUDIO_BYTES) {
      throw new ApiError(502, 'INVALID_AUDIO', 'ElevenLabs devolvió un audio no válido.');
    }
    return audio;
  } finally {
    activeGenerations -= 1;
  }
}

async function getAudio(config, voiceId, example, fetchImpl) {
  const cachePath = audioCachePath({
    voiceId,
    modelId: config.modelId,
    role: example.role,
    text: example.text,
  });
  try {
    return { audio: await readFile(cachePath), cache: 'HIT' };
  } catch {
    // A missing cache entry is generated below.
  }

  if (pendingAudio.has(cachePath)) return pendingAudio.get(cachePath);

  const generation = (async () => {
    const audio = await generateAudio(config, voiceId, example, fetchImpl);
    await mkdir(CACHE_DIR, { recursive: true });
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, audio);
    await rename(temporaryPath, cachePath);
    return { audio, cache: 'MISS' };
  })();

  pendingAudio.set(cachePath, generation);
  try {
    return await generation;
  } finally {
    pendingAudio.delete(cachePath);
  }
}

function sendError(error, response) {
  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof ApiError
    ? error.message
    : 'No se pudo completar la solicitud.';
  response.status(status).json({ error: { code, message } });
}

export function createElevenLabsRouter({ isProduction, fetchImpl = globalThis.fetch }) {
  const router = Router();
  const listLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const speechLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 24,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: 'DEMO_RATE_LIMIT',
          message: 'La demo está temporalmente ocupada.',
        },
      });
    },
  });

  router.get('/status', (_request, response) => {
    const config = getConfig(isProduction);
    response.set('Cache-Control', 'no-store').json({
      configured: config.enabled,
      model: config.enabled ? config.modelId : null,
    });
  });

  router.get('/voices', listLimiter, async (_request, response) => {
    const config = getConfig(isProduction);
    if (!config.enabled) {
      response.status(503).json({
        error: {
          code: 'ELEVENLABS_NOT_CONFIGURED',
          message: 'La demo de voz no está configurada.',
        },
      });
      return;
    }

    try {
      const voices = await loadVoices(config, fetchImpl);
      response.set('Cache-Control', 'private, max-age=60').json({ voices });
    } catch (error) {
      sendError(error, response);
    }
  });

  router.post('/speech', speechLimiter, async (request, response) => {
    const config = getConfig(isProduction);
    if (!config.enabled) {
      response.status(503).json({
        error: {
          code: 'ELEVENLABS_NOT_CONFIGURED',
          message: 'La demo de voz no está configurada.',
        },
      });
      return;
    }

    try {
      const { voiceId, scenarioId, lineIndex } = request.body ?? {};
      if (typeof voiceId !== 'string' || !/^[\w-]{5,100}$/.test(voiceId)) {
        throw new ApiError(400, 'INVALID_VOICE', 'La voz solicitada no es válida.');
      }
      const example = resolveExample(scenarioId, lineIndex);
      const voices = await loadVoices(config, fetchImpl);
      if (!voices.some((voice) => voice.id === voiceId)) {
        throw new ApiError(403, 'VOICE_NOT_ALLOWED', 'La voz solicitada no está disponible en esta demo.');
      }

      const result = await getAudio(config, voiceId, example, fetchImpl);
      response
        .set({
          'Cache-Control': 'private, max-age=86400',
          'Content-Length': String(result.audio.length),
          'Content-Type': 'audio/mpeg',
          'X-Content-Type-Options': 'nosniff',
          'X-Voice-Cache': result.cache,
        })
        .send(result.audio);
    } catch (error) {
      sendError(error, response);
    }
  });

  return router;
}
