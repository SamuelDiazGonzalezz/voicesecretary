import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import dotenv from 'dotenv';
import express from 'express';
import { createElevenLabsRouter } from './elevenlabs.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(rootDir, '.env.local'), quiet: true });
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

const args = process.argv.slice(2);
const isProduction = args.includes('--production') || process.env.NODE_ENV === 'production';
const portIndex = args.indexOf('--port');
const requestedPort = portIndex >= 0 ? Number(args[portIndex + 1]) : Number(process.env.PORT);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 5173;
const host = process.env.HOST?.trim() || '0.0.0.0';

const app = express();
app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.set({
    'Permissions-Policy': 'camera=(), geolocation=(), payment=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  next();
});
app.use(compression());
app.use(express.json({ limit: '12kb', strict: true }));
app.use('/api/elevenlabs', createElevenLabsRouter({ isProduction }));
app.use((error, request, response, next) => {
  if (request.path.startsWith('/api/')) {
    response.status(error?.type === 'entity.parse.failed' ? 400 : 500).json({
      error: {
        code: error?.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'INTERNAL_ERROR',
        message: error?.type === 'entity.parse.failed'
          ? 'El cuerpo JSON no es válido.'
          : 'No se pudo completar la solicitud.',
      },
    });
    return;
  }
  next(error);
});

let vite;
if (isProduction) {
  const distDir = path.join(rootDir, 'dist');
  app.use('/assets', express.static(path.join(distDir, 'assets'), {
    immutable: true,
    maxAge: '1y',
  }));
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use((request, response, next) => {
    if (request.method === 'GET' && request.accepts('html')) {
      response.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    next();
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({
    root: rootDir,
    appType: 'spa',
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
}

app.use('/api', (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint no encontrado.' } });
});

const server = app.listen(port, host, () => {
  console.log(`NORA ${isProduction ? 'production' : 'development'}: http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await vite?.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
