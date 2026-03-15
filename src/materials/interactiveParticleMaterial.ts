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
uniform float uHoleRadius;       // How wide the hole becomes
uniform float uRepulsionForce;   // Base repulsion everywhere
uniform float uButtonHover;      // Button hover state (0.0 to 1.0, with smooth transition)

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
    // 1. Time-based noise undulation
    vec3 animatedPos = position;
    float noise1 = snoise(vec3(position.xy * 2.0, uTime * 0.2));
    float noise2 = snoise(vec3(position.yx * 1.5, uTime * 0.3 + 100.0));
    
    animatedPos.x += noise1 * uNoiseStrength;
    animatedPos.y += noise2 * uNoiseStrength;
    animatedPos.z += snoise(vec3(position.z, uTime * 0.1, randomScale)) * uNoiseStrength * 2.0;

    // 2. Mouse Interaction
    // A subtle global push based on mouse
    vec2 dirToMouse = animatedPos.xy - uMouse; // Vector pointing from mouse to particle
    float distToMouse = length(dirToMouse);
    float globalPush = smoothstep(2.0, 0.0, distToMouse) * uRepulsionForce;
    
    vec2 pushDir = normalize(dirToMouse + vec2(0.001)); // push away from mouse
    animatedPos.xy += pushDir * globalPush;

    // 3. Central Hole Effect (Black hole punch ONLY when mouse is near center OR button is hovered)
    float distFromCenter = length(animatedPos.xy);
    float mouseFromCenter = length(uMouse);
    
    // Activate black hole if mouse is near center (radius 0.3) OR button is hovered
    float holeActivation = max(
      smoothstep(0.4, 0.1, mouseFromCenter),
      uButtonHover
    ); 
    
    // Force particles out of the center hole
    if (distFromCenter < uHoleRadius && holeActivation > 0.0) {
       // Push out completely to uHoleRadius bounds
       float pushOut = (uHoleRadius - distFromCenter);
       vec2 centerDir = normalize(animatedPos.xy + vec2(0.001));
       
       // Squeeze geometry back creating an edge ridge
       animatedPos.xy += centerDir * pushOut * holeActivation * 1.5;
       animatedPos.z -= pushOut * holeActivation; // Push them slightly backwards in Z too
    }

    vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
    
    // Distance attenuation for size (closer particles are bigger)
    gl_PointSize = (uParticleSize * (1.0 + randomScale * 2.0)) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // Pass to fragment shader
    // Fade out particles that were hard-pushed by the black hole
    vAlpha = 1.0;
    if (holeActivation > 0.0 && length(position.xy) < uHoleRadius) {
       vAlpha = mix(1.0, 0.2, holeActivation); 
    }
    
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
    // Render square particles
    vec2 coord = gl_PointCoord;
    
    // Check if within square bounds (0.0 to 1.0)
    if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
        discard;
    }
    
    // Optional: smooth edges for softer square look
    float edgeFade = 0.1; // Edge fade distance
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
  repulsionForce?: number;
  useVertexColors?: boolean;
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
      uRepulsionForce: { value: options.repulsionForce || 0.1 },
      uButtonHover: { value: 0.0 },
    },
  });
}
