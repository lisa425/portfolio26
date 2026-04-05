import * as THREE from "three";

// -------------------------------------------------------------
// Vertex Shader (Raw GLSL)
// -------------------------------------------------------------
const vertexShader = `
precision mediump float;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

uniform float uTime;
uniform float uParticleSize;
uniform vec3 uColor;
uniform float uNoiseStrength;

// Mouse Interaction Uniforms
uniform vec2 uMouse;             // Normalized mouse coordinates (-1 to 1)
uniform float uHoleRadius;       // Star1 hole radius
uniform float uHoleRadiusStar2;  // Star2 hole radius (star2Scale 적용)
uniform float uRepulsionForce;   // Base repulsion everywhere
uniform float uButtonHover;      // Button hover state (0.0 to 1.0, with smooth transition)
uniform float uIsCoreStar;       // 1.0 if coreStar, 0.0 if other particles
uniform vec2 uStar1Position;     // Star1 위치 (nebula 구멍용)
uniform vec2 uStar2Position;     // Star2 위치 (nebula 구멍용)
uniform float uButtonHoverStar1; // Star1 버튼 호버 상태 (nebula 구멍용)
uniform float uButtonHoverStar2; // Star2 버튼 호버 상태 (nebula 구멍용)

attribute vec3 position; // Initial mathematically generated 3D position
attribute float randomScale; // Individual randomness pre-calculated

#ifdef USE_VERTEX_COLORS
attribute vec3 aColor; // Per-particle random color
#endif

varying float vAlpha;
varying vec3 vColor;

// GLSL Simplex 3D noise (Shortened for brevity but valid)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

void main() {
    // 1. Time-based noise undulation (Z축 노이즈 제거 → snoise 2회만 호출)
    vec3 animatedPos = position;
    float noise1 = snoise(vec3(position.xy * 2.0, uTime * 0.2));
    float noise2 = snoise(vec3(position.yx * 1.5, uTime * 0.3 + 100.0));
    
    animatedPos.x += noise1 * uNoiseStrength;
    animatedPos.y += noise2 * uNoiseStrength;
    // Z축은 noise1을 재활용하여 추가 snoise 호출 제거
    animatedPos.z += noise1 * uNoiseStrength * randomScale;

    // 2. Mouse Interaction (분기 없이 smoothstep 사용)
    vec2 dirToMouse = animatedPos.xy - uMouse;
    float distToMouse = length(dirToMouse);
    float globalPush = smoothstep(2.0, 0.0, distToMouse) * uRepulsionForce;
    
    vec2 pushDir = normalize(dirToMouse + vec2(0.001));
    animatedPos.xy += pushDir * globalPush;

    // 3. Hole Effect (if 분기 대신 step/smoothstep으로 branchless 처리)
    // Star1 구멍 효과
    vec2 dirToStar1 = animatedPos.xy - uStar1Position;
    float distToStar1 = length(dirToStar1);
    float holeMask1 = smoothstep(uHoleRadius, 0.0, distToStar1) * uButtonHoverStar1;
    vec2 star1Dir = normalize(dirToStar1 + vec2(0.001));
    animatedPos.xy += star1Dir * (uHoleRadius - distToStar1) * holeMask1 * 1.5;
    animatedPos.z -= (uHoleRadius - distToStar1) * holeMask1;
    
    // Star2 구멍 효과 (star2용 별도 holeRadius 사용)
    vec2 dirToStar2 = animatedPos.xy - uStar2Position;
    float distToStar2 = length(dirToStar2);
    float holeMask2 = smoothstep(uHoleRadiusStar2, 0.0, distToStar2) * uButtonHoverStar2;
    vec2 star2Dir = normalize(dirToStar2 + vec2(0.001));
    animatedPos.xy += star2Dir * (uHoleRadiusStar2 - distToStar2) * holeMask2 * 1.5;
    animatedPos.z -= (uHoleRadiusStar2 - distToStar2) * holeMask2;

    vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
    
    // Distance attenuation for size
    float finalSize = uParticleSize;
    
    gl_PointSize = (finalSize * (1.0 + randomScale * 2.0)) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // 구멍 효과 페이드아웃 (nebula에만 적용, branchless)
    float isNebula = step(0.5, 1.0 - uIsCoreStar); // uIsCoreStar < 0.5이면 1.0
    float totalHoleActivation = max(holeMask1, holeMask2);
    // 각 별의 holeRadius 기준으로 내부 여부 판단
    float insideStar1 = step(distToStar1, uHoleRadius);
    float insideStar2 = step(distToStar2, uHoleRadiusStar2);
    float insideHole = max(insideStar1, insideStar2);
    float holeAlphaFade = mix(1.0, 0.2, totalHoleActivation * insideHole);
    vAlpha = mix(1.0, holeAlphaFade, isNebula);
    
#ifdef USE_VERTEX_COLORS
    vColor = aColor;
#else
    vColor = uColor;
#endif
}
`;

// -------------------------------------------------------------
// Fragment Shader (Raw GLSL)
// -------------------------------------------------------------
const fragmentShader = `
precision mediump float;

varying float vAlpha;
varying vec3 vColor;

void main() {
    vec2 coord = gl_PointCoord;

    // gl_PointCoord is always in [0,1] per OpenGL spec, so no bounds check needed.
    // Edge fade for a softer square look
    float edgeFade = 0.1;
    float minDist = min(min(coord.x, 1.0 - coord.x), min(coord.y, 1.0 - coord.y));
    float alpha = smoothstep(0.0, edgeFade, minDist) * vAlpha;

    gl_FragColor = vec4(vColor, alpha);
}
`;

// -------------------------------------------------------------
// Material Factory
// -------------------------------------------------------------
export interface InteractiveParticleOptions {
  size: number;
  color: string | THREE.Color;
  noiseStrength: number;
  holeRadius?: number;
  holeRadiusStar2?: number; // star2용 별도 holeRadius
  repulsionForce?: number;
  useVertexColors?: boolean;
  isCoreStar?: boolean; // true if coreStar, false otherwise
}

export function createInteractiveParticleMaterial(
  options: InteractiveParticleOptions,
) {
  return new THREE.RawShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false, // Prevents depth sorting issues with transparent particles
    blending: THREE.AdditiveBlending, // Makes multiple overlapping glowing particles very bright
    defines: options.useVertexColors ? { USE_VERTEX_COLORS: "" } : {},
    uniforms: {
      uTime: { value: 0 },
      uParticleSize: { value: options.size },
      uColor: { value: new THREE.Color(options.color) },
      uNoiseStrength: { value: options.noiseStrength },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uHoleRadius: { value: options.holeRadius || 0.5 },
      uHoleRadiusStar2: { value: options.holeRadiusStar2 || options.holeRadius || 0.5 },
      uRepulsionForce: { value: options.repulsionForce ?? 0.1 },
      uButtonHover: { value: 0.0 },
      uIsCoreStar: { value: options.isCoreStar ? 1.0 : 0.0 },
      uStar1Position: { value: new THREE.Vector2(0, 0) },
      uStar2Position: { value: new THREE.Vector2(0, 0) },
      uButtonHoverStar1: { value: 0.0 },
      uButtonHoverStar2: { value: 0.0 },
    },
  });
}
