import * as THREE from 'three';

// -------------------------------------------------------------
// Vertex Shader
// -------------------------------------------------------------
const vertexShader = `
  uniform float uBaseSize;

  // Geometry attributes
  attribute float aRandom;

  // Varyings for Fragment Shader
  varying float vRandom;

  void main() {
    vRandom = aRandom;

    // Local position
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    // View position
    vec4 viewPosition = viewMatrix * modelPosition;
    
    // Projection position
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;

    // Size calculation (Depth Attenuation)
    // - Add slight variation based on aRandom
    // - Size diminishes with distance (viewPosition.z)
    float sizeVariation = 0.8 + aRandom * 0.4;
    gl_PointSize = uBaseSize * sizeVariation;
    gl_PointSize *= (2.0 / -viewPosition.z); // simple perspective
  }
`;

// -------------------------------------------------------------
// Fragment Shader
// -------------------------------------------------------------
const fragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uGlowStrength;
  uniform float uAlphaRange;

  varying float vRandom;

  void main() {
    // 1. Coordinates from 0.0 to 1.0 within the point
    vec2 coord = gl_PointCoord;

    // 2. Square Shape logic
    // We want a solid square with very slight soft edges to avoid harsh aliasing
    // Calculate distance from center (0.5, 0.5) in X and Y
    vec2 distVec = abs(coord - 0.5);
    
    // Max distance in either X or Y gives us a square metric
    float maxDist = max(distVec.x, distVec.y);

    // If particle is too far outside the square bounds, discard
    if (maxDist > 0.5) {
      discard;
    }

    // Soft Edge Falloff: Sharp square with slight blur at the very edge (0.4 ~ 0.5)
    float shapeAlpha = 1.0 - smoothstep(0.42, 0.5, maxDist);

    // 3. Subtle Glow & Intensity
    // Core is brighter, outer area remains subtle
    // Use length for a circular gradient overlay on the square
    float circularDist = length(coord - 0.5);
    float glow = 1.0 - smoothstep(0.0, 0.5, circularDist);
    glow = pow(glow, uGlowStrength); // Falloff curve

    // 4. Color Variation
    // Mix between two base colors randomly per particle
    vec3 mixedColor = mix(uColorA, uColorB, vRandom);

    // Additive brightness
    vec3 finalColor = mixedColor * (1.0 + glow * 0.5);

    // 5. Alpha Variation
    // Vary alpha randomly between (1.0 - uAlphaRange) and 1.0
    float baseAlpha = mix(1.0 - uAlphaRange, 1.0, vRandom);
    
    // Final alpha combines shape edges and base opacity
    float finalAlpha = shapeAlpha * baseAlpha;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

// -------------------------------------------------------------
// Material Factory
// -------------------------------------------------------------
export interface BlackHoleParticleOptions {
  baseSize: number;
  colorA: string | THREE.Color;
  colorB: string | THREE.Color;
  glowStrength: number;
  alphaRange: number;
}

export function createBlackHoleParticleMaterial(options: BlackHoleParticleOptions) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,     // Important for particles looking right
    blending: THREE.AdditiveBlending, // Enhances the digital, glowing feel
    uniforms: {
      uBaseSize: { value: options.baseSize },
      uColorA: { value: new THREE.Color(options.colorA) },
      uColorB: { value: new THREE.Color(options.colorB) },
      uGlowStrength: { value: options.glowStrength },
      uAlphaRange: { value: options.alphaRange },
    },
  });
}
