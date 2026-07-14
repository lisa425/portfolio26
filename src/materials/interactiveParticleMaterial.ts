import * as THREE from 'three'

const signalVertexShader = `
precision mediump float;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uTime;
uniform float uParticleSize;
uniform vec3 uColor;
uniform float uNoiseStrength;
uniform float uWaveStrength;
uniform vec2 uPointer;
uniform float uPointerIntensity;
uniform float uTransitionProgress;
uniform float uOpacity;
uniform float uFieldHalfWidth;

attribute vec3 position;
attribute float randomScale;

#ifdef USE_VERTEX_COLORS
attribute vec3 aColor;
#endif

varying float vAlpha;
varying vec3 vColor;
varying float vHighlight;

void main() {
  vec3 animatedPos = position;
  float phase = randomScale * 6.28318;
  float edgeFade = 1.0 - smoothstep(uFieldHalfWidth * 0.68, uFieldHalfWidth, abs(position.x));
  float verticalFade = 1.0 - smoothstep(2.9, 5.8, abs(position.y));

  float slowWave = sin(position.x * 0.34 - uTime * 0.28 + phase) *
    cos(position.y * 0.72 + uTime * 0.18 + phase * 0.35);
  animatedPos.y += slowWave * uWaveStrength * (0.38 + randomScale * 0.62);
  animatedPos.z += sin(position.x * 0.22 + uTime * 0.22 + phase) * uWaveStrength * 0.72;
  animatedPos.x += sin(uTime * 0.12 + phase) * uNoiseStrength;

  float pointerDistance = length(position.xy - uPointer);
  float focus = (1.0 - smoothstep(0.3, 4.4, pointerDistance)) * uPointerIntensity;
  float rippleEnvelope = exp(-pointerDistance * 0.24) * uPointerIntensity;
  float pointerRipple = sin(pointerDistance * 2.35 - uTime * 1.85 + phase * 0.12) * rippleEnvelope;
  vec2 pointerDirection = normalize(position.xy - uPointer + vec2(0.001));
  animatedPos.xy += pointerDirection * pointerRipple * uWaveStrength * 0.34;
  animatedPos.y += pointerRipple * uWaveStrength * 0.48;
  animatedPos.z += pointerRipple * uWaveStrength * (0.58 + randomScale * 0.42);
  animatedPos.z += focus * (0.26 + randomScale * 0.65);

  animatedPos.xy *= 1.0 + uTransitionProgress * (0.2 + randomScale * 0.12);
  animatedPos.z += uTransitionProgress * (0.8 + randomScale * 1.8);

  vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
  float sizeVariation = 0.5 + randomScale * 1.25;
  gl_PointSize = max(1.0, uParticleSize * sizeVariation * (1.0 + focus * 0.65) / max(1.0, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;

  vAlpha = (0.17 + randomScale * 0.4) * edgeFade * verticalFade * uOpacity;
  vAlpha *= 1.0 + focus * 1.3;
  vAlpha *= 1.0 - uTransitionProgress * 0.82;
  vHighlight = focus;

#ifdef USE_VERTEX_COLORS
  vColor = aColor;
#else
  vColor = uColor;
#endif
}
`

const signalFragmentShader = `
precision mediump float;

varying float vAlpha;
varying vec3 vColor;
varying float vHighlight;

void main() {
  float distanceToCenter = length(gl_PointCoord - vec2(0.5));
  float softDisc = 1.0 - smoothstep(0.12, 0.5, distanceToCenter);
  float core = 1.0 - smoothstep(0.0, 0.16, distanceToCenter);
  float alpha = (softDisc * 0.82 + core * 0.18) * vAlpha;
  if (alpha < 0.008) discard;
  vec3 color = mix(vColor, vec3(0.95, 0.97, 1.0), vHighlight * 0.36);
  gl_FragColor = vec4(color, alpha);
}
`

export interface InteractiveParticleOptions {
  size: number
  color: string | THREE.Color
  noiseStrength: number
  waveStrength?: number
  fieldWidth?: number
  useVertexColors?: boolean
}

export function createInteractiveParticleMaterial(options: InteractiveParticleOptions) {
  return new THREE.RawShaderMaterial({
    vertexShader: signalVertexShader,
    fragmentShader: signalFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    defines: options.useVertexColors ? { USE_VERTEX_COLORS: '' } : {},
    uniforms: {
      uTime: { value: 0 },
      uParticleSize: { value: options.size },
      uColor: { value: new THREE.Color(options.color) },
      uNoiseStrength: { value: options.noiseStrength },
      uWaveStrength: { value: options.waveStrength ?? 0 },
      uPointer: { value: new THREE.Vector2(100, 100) },
      uPointerIntensity: { value: 0 },
      uTransitionProgress: { value: 0 },
      uOpacity: { value: 1 },
      uFieldHalfWidth: { value: (options.fieldWidth ?? 24) * 0.5 },
    },
  })
}

const ambientVertexShader = `
precision mediump float;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uTime;
uniform float uParticleSize;

attribute vec3 position;
attribute float randomScale;
attribute vec3 aColor;

varying float vAlpha;
varying vec3 vColor;

void main() {
  vec3 animatedPos = position;
  float phase = randomScale * 6.28318;
  animatedPos.x += sin(uTime * 0.055 + phase) * (0.18 + randomScale * 0.2);
  animatedPos.y += cos(uTime * 0.045 + phase) * (0.12 + randomScale * 0.18);

  vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
  gl_PointSize = max(1.0, uParticleSize * (0.42 + randomScale * 1.45) / max(1.0, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;

  vAlpha = (0.16 + randomScale * 0.28) * (0.82 + sin(uTime * 0.12 + phase) * 0.18);
  vColor = aColor;
}
`

const ambientFragmentShader = `
precision mediump float;

varying float vAlpha;
varying vec3 vColor;

void main() {
  float distanceToCenter = length(gl_PointCoord - vec2(0.5));
  float alpha = (1.0 - smoothstep(0.12, 0.5, distanceToCenter)) * vAlpha;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`

export function createAmbientParticleMaterial(size: number) {
  return new THREE.RawShaderMaterial({
    vertexShader: ambientVertexShader,
    fragmentShader: ambientFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uParticleSize: { value: size },
    },
  })
}
