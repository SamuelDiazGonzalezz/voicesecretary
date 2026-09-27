# NORA

Web B2B para una secretaria de voz con escena Three.js, demostración interactiva y voces de ElevenLabs.

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación y el proxy privado quedan disponibles en `http://localhost:5173/`.

## ElevenLabs

La clave compartida en una conversación o captura debe revocarse antes de utilizarse. Crea una nueva clave de servidor con permisos mínimos, cuota de créditos y restricciones de IP cuando el despliegue lo permita.

Añade la nueva clave directamente en `.env.local`, que está ignorado por Git:

```dotenv
ELEVENLABS_API_KEY=tu_nueva_clave
ELEVENLABS_VOICE_LIMIT=8
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

En desarrollo, el servidor se reinicia automáticamente cuando cambia `.env.local`.

Opcionalmente, `ELEVENLABS_VOICE_IDS` limita el selector a IDs concretos separados por comas. Si no se define, el servidor prioriza voces verificadas en español y publica como máximo `ELEVENLABS_VOICE_LIMIT` resultados.

En producción, la generación dinámica está desactivada por defecto. Actívala de forma explícita solo después de configurar cuota, rate limit y monitorización:

```dotenv
ELEVENLABS_DEMO_API_ENABLED=true
```

Nunca uses `VITE_ELEVENLABS_API_KEY`: las variables `VITE_*` se incluyen en el bundle del navegador. `VITE_ELEVENLABS_AGENT_ID` es independiente y sirve únicamente para conectar un agente público mediante el SDK de ElevenLabs.

### Protección aplicada

- La API key existe solo en el proceso Node.
- El navegador recibe un catálogo proyectado y limitado, nunca los datos completos del workspace.
- El endpoint de audio acepta únicamente voz, escenario y línea; el texto se resuelve desde los guiones del servidor.
- Las dos partes de cada conversación usan ElevenLabs: la voz de NORA se elige en la demo y el interlocutor recibe automáticamente una voz española distinta.
- La configuración incluida usa `eleven_v3` para maximizar naturalidad y expresividad en las demostraciones.
- Las voces se validan contra el catálogo permitido.
- La generación tiene rate limit, límite de concurrencia, timeout y tamaño máximo.
- Cada MP3 se cachea en `.cache/elevenlabs/` para no consumir créditos de nuevo.

## Otras variables

- `VITE_ELEVENLABS_AGENT_ID`: ID opcional de un agente público para conversación en directo.
- `VITE_ELEVENLABS_SERVER_LOCATION`: región opcional del agente, por ejemplo `eu-residency`.
- `VITE_DEMO_ENDPOINT`: endpoint HTTPS que recibe el formulario como JSON. Sin él, el briefing se guarda únicamente en `localStorage` y la interfaz lo indica.

## Producción

```bash
npm run build
npm start
```

`npm run preview` sirve el build en `http://localhost:4176/`.

## Verificación

```bash
npm test
npm run check:visual
```

Las pruebas unitarias simulan ElevenLabs y comprueban catálogo, secreto, allowlist y caché sin consumir créditos. `check:visual` usa Playwright Core con Chrome y verifica cinco viewports, errores de ejecución, interacciones, canvas WebGL, movimiento reducido y fallback sin WebGL. Las capturas quedan en `artifacts/visual-check/`.
