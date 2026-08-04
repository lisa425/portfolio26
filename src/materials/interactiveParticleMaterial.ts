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
uniform float uFieldHalfHeight;

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
  float normalizedRadius = length(vec2(
    position.x / max(1.0, uFieldHalfWidth),
    position.y / max(1.0, uFieldHalfHeight)
  ));
  float edgeFade = 1.0 - smoothstep(0.78, 1.12, normalizedRadius);

  float slowWave = sin(position.x * 0.18 + position.y * 0.22 - uTime * 0.14);
  float crossWave = cos(position.y * 0.17 - position.x * 0.08 + uTime * 0.1);
  animatedPos.x += crossWave * uNoiseStrength * (0.14 + randomScale * 0.08);
  animatedPos.y += slowWave * uWaveStrength * (0.09 + randomScale * 0.07);
  animatedPos.z += (slowWave + crossWave) * uWaveStrength * 0.08;

  float pointerDistance = length(position.xy - uPointer);
  float focus = (1.0 - smoothstep(0.3, 4.4, pointerDistance)) * uPointerIntensity;
  float rippleEnvelope = exp(-pointerDistance * 0.24) * uPointerIntensity;
  float pointerRipple = sin(pointerDistance * 1.55 - uTime * 0.95) * rippleEnvelope;
  vec2 pointerDirection = normalize(position.xy - uPointer + vec2(0.001));
  animatedPos.xy += pointerDirection * pointerRipple * uWaveStrength * 0.18;
  animatedPos.y += pointerRipple * uWaveStrength * 0.22;
  animatedPos.z += pointerRipple * uWaveStrength * (0.24 + randomScale * 0.18);
  animatedPos.z += focus * (0.04 + randomScale * 0.08);

  float spread = smoothstep(0.0, 1.0, uTransitionProgress);
  animatedPos.xy *= 1.0 + spread * (0.42 + randomScale * 0.32);
  animatedPos.z += spread * (0.7 + randomScale * 1.9);

  vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
  float sizeVariation = 0.5 + randomScale * 1.25;
  gl_PointSize = max(1.0, uParticleSize * sizeVariation * (1.0 + focus * 0.18) / max(1.0, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;

  float textRegion = max(abs(animatedPos.x) / max(1.0, uFieldHalfWidth * 0.72), abs(animatedPos.y) / 1.18);
  float textClearance = mix(0.28, 1.0, smoothstep(0.52, 1.18, textRegion));
  vAlpha = (0.2 + randomScale * 0.34) * edgeFade * textClearance * uOpacity;
  vAlpha *= 1.0 + focus * 0.34;
  vAlpha *= 1.0 - spread * 0.86;
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
  vec3 color = mix(vColor, vec3(0.95, 0.97, 1.0), vHighlight * 0.12);
  gl_FragColor = vec4(color, alpha);
}
`

export interface InteractiveParticleOptions {
  size: number
  color: string | THREE.Color
  noiseStrength: number
  waveStrength?: number
  fieldWidth?: number
  fieldHeight?: number
  useVertexColors?: boolean
}

export function createInteractiveParticleMaterial(options: InteractiveParticleOptions) {
  return new THREE.RawShaderMaterial({
    vertexShader: signalVertexShader,
    fragmentShader: signalFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
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
      uFieldHalfHeight: { value: (options.fieldHeight ?? 10) * 0.5 },
    },
  })
}

const ambientVertexShader = `
precision mediump float;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uParticleSize;

attribute vec3 position;
attribute float randomScale;
attribute vec3 aColor;

varying float vAlpha;
varying vec3 vColor;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.0, uParticleSize * (0.42 + randomScale * 1.45) / max(1.0, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = 0.13 + randomScale * 0.24;
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
      uParticleSize: { value: size },
    },
  })
}
