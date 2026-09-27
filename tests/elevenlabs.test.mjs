import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import express from 'express';
import { scenarios } from '../src/data.js';
import { createElevenLabsRouter } from '../server/elevenlabs.js';

const originalEnv = {
  key: process.env.ELEVENLABS_API_KEY,
  model: process.env.ELEVENLABS_MODEL_ID,
  ids: process.env.ELEVENLABS_VOICE_IDS,
  limit: process.env.ELEVENLABS_VOICE_LIMIT,
};

let server;
let origin;
let mockFetch;
let upstreamKey;
let generatedBody;
let generationCalls = 0;

function localRequest(pathname, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const request = http.request(`${origin}${pathname}`, {
      method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) }
        : undefined,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = response.headers['content-type'] ?? '';
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: buffer,
          json: contentType.includes('application/json') ? JSON.parse(buffer.toString('utf8')) : null,
        });
      });
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/elevenlabs', createElevenLabsRouter({
    isProduction: false,
    fetchImpl: (...args) => mockFetch(...args),
  }));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const [name, value] of [
    ['ELEVENLABS_API_KEY', originalEnv.key],
    ['ELEVENLABS_MODEL_ID', originalEnv.model],
    ['ELEVENLABS_VOICE_IDS', originalEnv.ids],
    ['ELEVENLABS_VOICE_LIMIT', originalEnv.limit],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('reports an unconfigured server without contacting ElevenLabs', async () => {
  delete process.env.ELEVENLABS_API_KEY;
  mockFetch = () => {
    throw new Error('The upstream API must not be called.');
  };

  const status = await localRequest('/api/elevenlabs/status');
  const voices = await localRequest('/api/elevenlabs/voices');

  assert.equal(status.status, 200);
  assert.deepEqual(status.json, { configured: false, model: null });
  assert.equal(voices.status, 503);
  assert.equal(voices.json.error.code, 'ELEVENLABS_NOT_CONFIGURED');
});

test('returns a projected, limited voice catalogue without exposing the key', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-server-key';
  process.env.ELEVENLABS_MODEL_ID = `test-model-${process.pid}-${Date.now()}`;
  process.env.ELEVENLABS_VOICE_LIMIT = '1';
  upstreamKey = '';
  mockFetch = async (url, options) => {
    upstreamKey = options.headers['xi-api-key'];
    assert.match(String(url), /\/v2\/voices/);
    return new Response(JSON.stringify({
      voices: [
        {
          voice_id: 'voiceSpanishDemo01',
          name: 'Mónica',
          category: 'premade',
          labels: { gender: 'female', use_case: 'conversational' },
          fine_tuning: { private: true },
          verified_languages: [{ language: 'es', locale: 'es-ES', accent: 'castellano', preview_url: 'https://example.test/monica.mp3' }],
        },
        {
          voice_id: 'voiceEnglishDemo02',
          name: 'Alex',
          category: 'premade',
          labels: { gender: 'male' },
          verified_languages: [{ language: 'en', locale: 'en-US' }],
        },
      ],
      has_more: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await localRequest('/api/elevenlabs/voices');
  const serialized = JSON.stringify(response.json);

  assert.equal(response.status, 200);
  assert.equal(upstreamKey, 'test-server-key');
  assert.equal(response.json.voices.length, 1);
  assert.equal(response.json.voices[0].name, 'Mónica');
  assert.equal(response.json.voices[0].spanishVerified, true);
  assert.equal('fine_tuning' in response.json.voices[0], false);
  assert.equal(serialized.includes('test-server-key'), false);
});

test('generates both sides of an allowlisted conversation and caches the resulting audio', async () => {
  generationCalls = 0;
  generatedBody = null;
  mockFetch = async (url, options) => {
    if (String(url).includes('/v2/voices')) {
      return new Response(JSON.stringify({
        voices: [{
          voice_id: 'voiceSpanishDemo01',
          name: 'Mónica',
          category: 'premade',
          labels: {},
          verified_languages: [{ language: 'es', locale: 'es-ES' }],
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    generationCalls += 1;
    generatedBody = JSON.parse(options.body);
    return new Response(Buffer.from('ID3-test-audio'), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  };

  const requestBody = {
    voiceId: 'voiceSpanishDemo01',
    scenarioId: 'clinica',
    lineIndex: 0,
    text: 'Este texto controlado por el cliente debe ignorarse.',
  };
  const first = await localRequest('/api/elevenlabs/speech', { method: 'POST', body: requestBody });
  const second = await localRequest('/api/elevenlabs/speech', { method: 'POST', body: requestBody });

  assert.equal(first.status, 200);
  assert.equal(first.headers['content-type'], 'audio/mpeg');
  assert.equal(second.status, 200);
  assert.equal(generationCalls, 1);
  assert.equal(generatedBody.text, scenarios[0].lines[0].text);
  assert.notEqual(generatedBody.text, requestBody.text);
  assert.equal(first.headers['x-voice-cache'], 'MISS');
  assert.equal(second.headers['x-voice-cache'], 'HIT');

  const caller = await localRequest('/api/elevenlabs/speech', {
    method: 'POST',
    body: {
      voiceId: 'voiceSpanishDemo01',
      scenarioId: 'clinica',
      lineIndex: 1,
    },
  });

  assert.equal(caller.status, 200);
  assert.equal(generationCalls, 2);
  assert.equal(generatedBody.text, scenarios[0].lines[1].text);
  assert.equal(generatedBody.previous_text, scenarios[0].lines[0].text);
  assert.equal(generatedBody.next_text, scenarios[0].lines[2].text);
});

test('rejects unknown examples before generating audio', async () => {
  const beforeCalls = generationCalls;
  const response = await localRequest('/api/elevenlabs/speech', {
    method: 'POST',
    body: {
      voiceId: 'voiceSpanishDemo01',
      scenarioId: 'inventado',
      lineIndex: 0,
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.json.error.code, 'INVALID_EXAMPLE');
  assert.equal(generationCalls, beforeCalls);
});
