import * as THREE from "three";

// -------------------------------------------------------------
// Vertex Shader (Raw GLSL)
// -------------------------------------------------------------
const vertexShader = `
precision mediump float;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

uniform float uTime;
uniform float uRandom;
uniform float uDepth;
uniform float uSize;
uniform vec2 uTextureSize;
uniform sampler2D uTexture;
uniform float uScale;

attribute vec3 position; // Instanced Quad Base position
attribute vec2 uv;       // Instanced Quad Base uv
attribute vec3 offset;   // Pixel instance position
attribute float pindex;  // Pixel instance index
attribute float angle;   // Pixel instance angle

varying vec2 vUv;
varying vec2 vPUv;

// Random functions
float random(float n) { return fract(sin(n) * 1e4); }
float random(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

// GLSL Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vUv = uv;
    vPUv = offset.xy / uTextureSize;

    // Displacement base on offset
    vec3 displaced = offset;

    // Center the image around origin
    displaced.xy -= uTextureSize * 0.5;
    
    // Invert Y to match 3D coordinate system to screen image
    displaced.y = -displaced.y;

    // Add random noise and displacement
    displaced.xy += vec2(random(pindex) - 0.5, random(offset.x + pindex) - 0.5) * uRandom;
    
    // 3D Depth oscillation
    float rndz = (random(pindex) + snoise(vec2(pindex * 0.1, uTime * 0.1)));
    displaced.z += rndz * (random(pindex) * 2.0 * uDepth);

    // Apply global scaling to match scene configuration
    displaced *= uScale;

    // Sample the color from the picture
    vec4 colA = texture2D(uTexture, vPUv);

    // 밝기를 복원하여 원래 이미지의 대비(Contrast)를 있는 그대로 살림
    float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;
    
    // Particle size calculation based on noise and image brightness
    float psize = (snoise(vec2(uTime, pindex) * 0.5) + 2.0);
    psize *= max(grey, 0.2);
    psize *= uSize;
    
    // 씬 스케일(0.015)에 맞춰 개별 파티클 크기 축소 (GPU 과부하 방지)
    psize *= uScale;

    // 파티클 회전 제거 (항상 정방향 사각형 유지)
    vec2 rotated = position.xy;
    
    // Convert quad size to scene scale
    vec3 p = vec3(rotated * psize, position.z * uScale);

    // Final matrix transformations
    vec4 mvPosition = modelViewMatrix * vec4(p + displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

// -------------------------------------------------------------
// Fragment Shader (Raw GLSL)
// -------------------------------------------------------------
const fragmentShader = `
precision mediump float;

uniform sampler2D uTexture;
uniform vec3 uColorTint;

varying vec2 vUv;
varying vec2 vPUv;

void main() {
    vec4 colA = texture2D(uTexture, vPUv);

    // Grayscale calculation from original pixel
    // 밝기를 복원하여 원래 이미지의 대비(Contrast)를 있는 그대로 살림
    float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;
    
    // Add cool digital tint specified via configurations
    vec4 colB = vec4(grey * uColorTint, 1.0);

    // -------------------------------------------------------------
    // Circular Particle shape rendering
    // -------------------------------------------------------------
    float border = 0.05; // 부드러운 원 가장자리 비율 (매우 낮춰서 날카로운 픽셀 형태로 복구)
    float radius = 0.5;
    float dist = radius - distance(vUv, vec2(0.5));
    
    // 외곽으로 갈수록 투명해지도록 마스킹
    float t = smoothstep(0.0, border, dist);

    // 원형 영역을 벗어나는 픽셀은 렌더링 비용을 위해 버림
    if (dist < 0.0) discard;

    gl_FragColor = colB;
    // 튜토리얼 사진과 동일한 선명하고 불투명한(Opacity 100%) 점묘법 느낌을 위해 알파 제한(0.5) 해제
    gl_FragColor.a = t * colA.a; 
}
`;

// -------------------------------------------------------------
// Material Factory
// -------------------------------------------------------------
export interface InstancedBlackHoleOptions {
  texture: THREE.Texture;
  textureWidth: number;
  textureHeight: number;
  size: number;
  random: number;
  depth: number;
  scale: number;
  colorTint: string | THREE.Color;
}

export function createInstancedParticleMaterial(
  options: InstancedBlackHoleOptions,
) {
  return new THREE.RawShaderMaterial({
    vertexShader,
    fragmentShader,
    depthTest: false,
    transparent: true,
    // AdditiveBlending 제거 -> Normal Blending으로 선명한 점묘 렌더링
    uniforms: {
      uTime: { value: 0 },
      uRandom: { value: options.random },
      uDepth: { value: options.depth },
      uSize: { value: options.size },
      uTextureSize: {
        value: new THREE.Vector2(options.textureWidth, options.textureHeight),
      },
      uTexture: { value: options.texture },
      uScale: { value: options.scale },
      uColorTint: { value: new THREE.Color(options.colorTint) },
    },
  });
}
