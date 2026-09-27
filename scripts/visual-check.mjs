import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = new URL('../artifacts/visual-check/', import.meta.url);
const artifactPath = (name) => fileURLToPath(new URL(name, outputDir));

function silentWav(durationMs = 500) {
  const sampleRate = 8000;
  const samples = Math.round((sampleRate * durationMs) / 1000);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

const viewports = [
  { name: 'wide', width: 1920, height: 1080 },
  { name: 'desktop', width: 1440, height: 1000, fullPage: true },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844, fullPage: true },
  { name: 'mobile-small', width: 360, height: 800 },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const report = {
  url: baseUrl,
  generatedAt: new Date().toISOString(),
  viewports: [],
  interactions: {},
  fallbacks: {},
};

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText;
    const isViteRefresh = errorText === 'net::ERR_ABORTED' && request.url().includes('/node_modules/.vite/deps/');
    const isEffectCleanup = errorText === 'net::ERR_ABORTED' && request.url().includes('/api/elevenlabs/');
    if (!isViteRefresh && !isEffectCleanup) failedRequests.push(`${request.method()} ${request.url()} :: ${errorText}`);
  });

  const response = await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero h1');
  await page.waitForSelector('.voice-machine canvas');
  await page.waitForTimeout(1200);

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { x: box.x, y: box.y, width: box.width, height: box.height, top: box.top, right: box.right, bottom: box.bottom, left: box.left } : null;
    };
    const overflowingButtons = [...document.querySelectorAll('button')]
      .filter((button) => button.scrollWidth > button.clientWidth + 2 || button.scrollHeight > button.clientHeight + 2)
      .map((button) => button.textContent.trim().slice(0, 50));
    const hero = rect('.hero');
    const header = rect('.site-header');
    const heading = rect('.hero h1');
    const primary = rect('.hero__actions .button--primary');
    const canvas = document.querySelector('.voice-machine canvas');
    const canvasRect = canvas?.getBoundingClientRect();

    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      heroHint: hero ? innerHeight - hero.bottom : null,
      headerOverlapsHeading: Boolean(header && heading && header.bottom > heading.top),
      headingInsideViewport: Boolean(heading && heading.left >= -1 && heading.right <= innerWidth + 1),
      primaryInsideViewport: Boolean(primary && primary.left >= -1 && primary.right <= innerWidth + 1),
      overflowingButtons,
      canvas: canvas && canvasRect
        ? {
            cssWidth: Math.round(canvasRect.width),
            cssHeight: Math.round(canvasRect.height),
            width: canvas.width,
            height: canvas.height,
          }
        : null,
    };
  });

  await page.evaluate(() => {
    window.__sampleVoiceCanvas = () => {
      const canvas = document.querySelector('.voice-machine canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      if (!gl) return { available: false };
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const buckets = new Set();
      let visible = 0;
      let yellow = 0;
      let minLuma = 255;
      let maxLuma = 0;
      let hash = 2166136261;
      const stride = Math.max(1, Math.floor((width * height) / 52000));
      for (let pixel = 0; pixel < width * height; pixel += stride) {
        const index = pixel * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const alpha = pixels[index + 3];
        if (alpha > 4 && red + green + blue > 12) visible += 1;
        if (red > 155 && green > 115 && blue < 100 && alpha > 20) yellow += 1;
        const luma = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
        buckets.add(`${red >> 5}-${green >> 5}-${blue >> 5}-${alpha >> 6}`);
        hash ^= red + green * 3 + blue * 7 + alpha * 11;
        hash = Math.imul(hash, 16777619) >>> 0;
      }
      return {
        available: true,
        width,
        height,
        sampled: Math.ceil((width * height) / stride),
        visible,
        yellow,
        buckets: buckets.size,
        lumaRange: maxLuma - minLuma,
        hash,
      };
    };
  });

  const pixelsBefore = await page.evaluate(() => window.__sampleVoiceCanvas());
  await page.mouse.move(Math.round(viewport.width * 0.76), Math.round(viewport.height * 0.45));
  await page.waitForTimeout(750);
  const pixelsAfter = await page.evaluate(() => window.__sampleVoiceCanvas());

  const hero = page.locator('.hero');
  await hero.screenshot({ path: artifactPath(`${viewport.name}-hero.png`) });
  if (viewport.fullPage) {
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let offset = 0; offset < pageHeight; offset += Math.round(viewport.height * 0.72)) {
      await page.evaluate((top) => window.scrollTo(0, top), offset);
      await page.waitForTimeout(90);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: artifactPath(`${viewport.name}-full.png`), fullPage: true });

    for (const [label, selector] of [['demo', '.demo-shell'], ['dashboard', '.dashboard-preview'], ['contact', '.contact-layout']]) {
      const section = page.locator(selector);
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await section.screenshot({ path: artifactPath(`${viewport.name}-${label}.png`) });
    }
  }

  report.viewports.push({
    name: viewport.name,
    status: response?.status(),
    layout,
    canvas: {
      before: pixelsBefore,
      after: pixelsAfter,
      animated: pixelsBefore.hash !== pixelsAfter.hash,
    },
    consoleErrors,
    pageErrors,
    failedRequests,
  });

  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.locator('.menu-toggle').click();
  const mobileMenuOpen = await page.locator('.main-nav').evaluate((node) => node.classList.contains('is-open'));
  await page.locator('.main-nav a[href="#demo"]').click();
  await page.waitForTimeout(350);

  await page.locator('.demo-tab').filter({ hasText: 'Inmobiliaria' }).click();
  await page.locator('.demo-play').click();
  await page.waitForTimeout(300);
  const demoPlaying = await page.locator('.waveform').getAttribute('data-active');
  const voiceFallback = await page.locator('.demo-shell').getAttribute('data-voice-state');
  await page.locator('.demo-play').click();

  await page.locator('#impacto').scrollIntoViewIfNeeded();
  const beforeCalls = await page.locator('.stepper output').textContent();
  await page.locator('.stepper button[aria-label="Aumentar llamadas"]').click();
  const afterCalls = await page.locator('.stepper output').textContent();

  await page.locator('#contacto').scrollIntoViewIfNeeded();
  await page.locator('input[name="name"]').fill('Ana Martín');
  await page.locator('input[name="email"]').fill('ana@empresa.test');
  await page.locator('input[name="company"]').fill('Empresa Demo');
  await page.locator('textarea[name="useCase"]').fill('Agendar citas y derivar urgencias.');
  await page.locator('input[name="consent"]').check();
  await page.locator('.button--form').click();
  await page.waitForSelector('.form-success');

  report.interactions = {
    mobileMenuOpen,
    demoPlaying: demoPlaying === 'true',
    voiceFallback: voiceFallback === 'unconfigured',
    calculatorChanged: Number(afterCalls) === Number(beforeCalls) + 10,
    formCompleted: await page.locator('.form-success').isVisible(),
    errors,
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  let speechPayload = null;
  let resolveSpeech;
  const speechRequested = new Promise((resolve) => { resolveSpeech = resolve; });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/elevenlabs/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: true, model: 'eleven_multilingual_v2' }),
  }));
  await page.route('**/api/elevenlabs/voices', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      voices: [
        { id: 'voiceMockOne', name: 'Mónica', accent: 'castellano', gender: 'female', spanishVerified: true, previewUrl: '' },
        { id: 'voiceMockTwo', name: 'Carmen', accent: 'canario', gender: 'female', spanishVerified: true, previewUrl: '' },
      ],
    }),
  }));
  await page.route('**/api/elevenlabs/speech', async (route) => {
    speechPayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() });
    resolveSpeech();
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.demo-shell[data-voice-state="ready"]');
  const optionCount = await page.locator('#demo-voice-select option').count();
  await page.locator('#demo-voice-select').selectOption('voiceMockTwo');
  await page.locator('.demo-play').click();
  await Promise.race([
    speechRequested,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for speech request')), 5000)),
  ]);
  await page.locator('.demo-play').click();

  report.elevenLabsMock = {
    catalogueReady: await page.locator('.demo-shell').getAttribute('data-voice-state') === 'ready',
    optionCount,
    selectedVoiceSent: speechPayload?.voiceId === 'voiceMockTwo',
    allowlistedShape: speechPayload?.scenarioId === 'clinica' && speechPayload?.lineIndex === 0 && !('text' in speechPayload),
    errors,
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.voice-machine canvas');
  report.fallbacks.reducedMotion = {
    canvasVisible: await page.locator('.voice-machine canvas').isVisible(),
    headingVisible: await page.locator('.hero h1').isVisible(),
    errors,
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (String(type).startsWith('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-webgl="fallback"]');
  report.fallbacks.noWebgl = {
    fallbackVisible: await page.locator('.machine-fallback').isVisible(),
    headingVisible: await page.locator('.hero h1').isVisible(),
    errors,
  };
  await context.close();
}

await browser.close();
await writeFile(new URL('report.json', outputDir), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const failures = [];
for (const viewport of report.viewports) {
  if (viewport.status !== 200) failures.push(`${viewport.name}: HTTP ${viewport.status}`);
  if (viewport.layout.horizontalOverflow) failures.push(`${viewport.name}: horizontal overflow`);
  if (viewport.layout.headerOverlapsHeading) failures.push(`${viewport.name}: header overlaps heading`);
  if (!viewport.layout.headingInsideViewport || !viewport.layout.primaryInsideViewport) failures.push(`${viewport.name}: hero content outside viewport`);
  if (viewport.layout.heroHint < 24) failures.push(`${viewport.name}: next section is not visible`);
  if (viewport.layout.overflowingButtons.length) failures.push(`${viewport.name}: overflowing buttons ${viewport.layout.overflowingButtons.join(', ')}`);
  if (viewport.consoleErrors.length || viewport.pageErrors.length || viewport.failedRequests.length) failures.push(`${viewport.name}: runtime errors`);
  if (!viewport.canvas.before.available || viewport.canvas.before.visible < 100 || viewport.canvas.before.yellow < 10 || viewport.canvas.before.buckets < 8 || viewport.canvas.before.lumaRange < 30) failures.push(`${viewport.name}: canvas appears blank`);
  if (!viewport.canvas.animated) failures.push(`${viewport.name}: canvas is not animating`);
}

if (!report.interactions.mobileMenuOpen || !report.interactions.demoPlaying || !report.interactions.voiceFallback || !report.interactions.calculatorChanged || !report.interactions.formCompleted || report.interactions.errors.length) failures.push('interaction checks failed');
if (!report.elevenLabsMock.catalogueReady || report.elevenLabsMock.optionCount !== 2 || !report.elevenLabsMock.selectedVoiceSent || !report.elevenLabsMock.allowlistedShape || report.elevenLabsMock.errors.length) failures.push('mock ElevenLabs integration check failed');
if (!report.fallbacks.reducedMotion.canvasVisible || !report.fallbacks.reducedMotion.headingVisible || report.fallbacks.reducedMotion.errors.length) failures.push('reduced motion check failed');
if (!report.fallbacks.noWebgl.fallbackVisible || !report.fallbacks.noWebgl.headingVisible || report.fallbacks.noWebgl.errors.length) failures.push('WebGL fallback check failed');

console.log(JSON.stringify({ passed: failures.length === 0, failures, report: artifactPath('report.json') }, null, 2));
if (failures.length) process.exitCode = 1;
