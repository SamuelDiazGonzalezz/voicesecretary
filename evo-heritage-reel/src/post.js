// Cadena de post-procesado: bloom + pase final propio (overlay 2D, aberración cromática,
// desenfoque radial/direccional, flash, viñeta y grano).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, tOverlay: { value: null },
    uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uCA: { value: 0.002 }, uRadial: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uDir: { value: new THREE.Vector2(0, 0) }, uGrain: { value: 0.05 }, uVignette: { value: 0.6 },
    uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) }, uOverlayBlur: { value: 0.35 },
    uFade: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tOverlay; uniform float uTime, uCA, uRadial, uGrain, uVignette, uFlash, uOverlayBlur, uFade;
    uniform vec2 uRes, uCenter, uDir; uniform vec3 uFlashColor; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    vec3 scene(vec2 uv){
      vec2 d = uv - 0.5;
      return vec3(texture2D(tDiffuse, uv + d*uCA).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d*uCA).b);
    }
    void main(){
      vec2 uv = vUv; vec3 col = vec3(0.0); vec4 ov = vec4(0.0);
      float blur = uRadial + length(uDir);
      if (blur < 0.0005) { col = scene(uv); ov = texture2D(tOverlay, uv); }
      else {
        const int N = 14; float jitter = hash(uv*uRes + uTime) - 0.5;
        for (int i = 0; i < N; i++) {
          float k = (float(i) + jitter) / float(N - 1);
          vec2 off = (uCenter - uv) * uRadial * k + uDir * (k - 0.5);
          col += scene(uv + off);
          ov += texture2D(tOverlay, uv + off * uOverlayBlur);
        }
        col /= float(N); ov /= float(N);
      }
      // overlay: canvas 2D en alpha no premultiplicado
      col = mix(col, ov.rgb / max(ov.a, 1e-4), clamp(ov.a, 0.0, 1.0));
      col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
      vec2 d = (uv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
      col *= mix(1.0, smoothstep(1.25, 0.25, length(d)), uVignette);
      float g = hash(floor(uv*uRes/2.0) + fract(uTime*7.13)*97.0) - 0.5;
      col += g * uGrain;
      col = mix(col, vec3(0.0), uFade);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function makePost(renderer, W, H, overlayCanvas) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(W, H);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.5, 0.82);
  const output = new OutputPass();
  const final = new ShaderPass(FinalShader);
  const ovTex = new THREE.CanvasTexture(overlayCanvas);
  ovTex.colorSpace = THREE.NoColorSpace; ovTex.minFilter = THREE.LinearFilter; ovTex.generateMipmaps = false;
  final.uniforms.tOverlay.value = ovTex;
  final.uniforms.uRes.value.set(W, H);
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output); composer.addPass(final);
  return { composer, renderPass, bloom, final, ovTex };
}
