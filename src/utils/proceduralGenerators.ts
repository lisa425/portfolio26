import * as THREE from "three";

export interface StarGeneratorOptions {
  count: number;
  radius: number;
  innerRadiusRatio: number; // For the star shape indent (e.g. 0.4 for a classic 5-point star)
  points: number; // 5 for a 5-pointed star
  thickness: number; // Z-axis depth
  jitter: number; // Random deviation from the mathematical shape
  rotationOffset?: number; // Internal rotation offset in radians
}

export function generateStarParticles(options: StarGeneratorOptions) {
  const positions = new Float32Array(options.count * 3);
  const randoms = new Float32Array(options.count); // Optional: individual random seeds per particle

  const { count, radius, innerRadiusRatio, points, thickness, jitter } = options;

  for (let i = 0; i < count; i++) {
    // Determine which of the 'points' (arms of the star) this particle belongs to
    const pointIndex = Math.floor(Math.random() * points);
    
    // Angle range for this arm
    const angleStep = (Math.PI * 2) / points;
    const baseAngle = pointIndex * angleStep;
    
    // Random angle within the arm (spanning from center to the two valleys)
    const angleOffset = (Math.random() - 0.5) * angleStep;
    let a = baseAngle + angleOffset;

    // Apply internal rotation so the raycaster coordinates perfectly match the geometry
    if (options.rotationOffset) {
      a += options.rotationOffset;
    }

    // To get straight edges, we use the polar equation of a line segment 
    // connecting the outer tip (radius) to the inner valley (radius * innerRadiusRatio).
    const innerRadius = radius * innerRadiusRatio;
    
    // Math to find the radius of the straight line edge at exactly 'angleOffset'
    const theta = Math.abs(angleOffset); // Symmetrical around the arm axis
    const halfAngleStep = angleStep / 2;
    
    // Polar equation of a line between (radius, 0) and (innerRadius, halfAngleStep)
    const numerator = radius * innerRadius * Math.sin(halfAngleStep);
    const denominator = radius * Math.sin(theta) + innerRadius * Math.sin(halfAngleStep - theta);
    
    const maxR = numerator / denominator;

    // Direct placement: square root ensures uniform density within the 2D polygon shape
    const r = Math.pow(Math.random(), 0.5) * maxR;

    // Calculate distance factor from center (0 = center, 1 = edge tip)
    const distFactor = r / maxR;
    
    // Apply 3D thickness: dense/bulging in the center, tapering off to zero thickness at the sharp tips
    // This creates a 3D cushion/bevel effect instead of a flat cookie-cutter shape.
    const currentZThickness = thickness * (1.0 - Math.pow(distFactor, 1.5)); 
    let z = (Math.random() - 0.5 + Math.random() - 0.5) * currentZThickness;

    // Add noise jitter using 3D random vector
    // Scale jitter down near the edges to preserve sharp points
    const rx = (Math.random() - 0.5) * jitter;
    const ry = (Math.random() - 0.5) * jitter;
    const rz = (Math.random() - 0.5) * jitter;

    positions[i * 3 + 0] = r * Math.cos(a) + rx;
    positions[i * 3 + 1] = r * Math.sin(a) + ry;
    positions[i * 3 + 2] = z + rz;

    randoms[i] = Math.random();
  }

  return { positions, randoms };
}


export interface NebulaGeneratorOptions {
  count: number;
  radiusBase: number; // Inner empty area roughly
  radiusSpread: number; // How far it spreads outward
  thickness: number; // Z-axis depth (cloud thickness)
}

export function generateNebulaParticles(options: NebulaGeneratorOptions) {
  const positions = new Float32Array(options.count * 3);
  const randoms = new Float32Array(options.count);
  const colors = new Float32Array(options.count * 3); // Per-particle colors

  const { count, radiusBase, radiusSpread, thickness } = options;

  // Pre-define the 3 aesthetic colors requested by user
  const palette = [
    // new THREE.Color("#dedde7"), 
    // new THREE.Color("#c7c5d2"),
    // new THREE.Color("#9e9cb0"),
    new THREE.Color("#ffffff"),
  ];

  for (let i = 0; i < count; i++) {
    // 화면 전체에 균일하게 퍼지도록 직교좌표 랜덤 분포
    const totalSpread = radiusBase + radiusSpread;
    const x = (Math.random() - 0.5) * 2.0 * totalSpread;
    const y = (Math.random() - 0.5) * 2.0 * totalSpread;
    const z = (Math.random() - 0.5) * thickness;

    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    randoms[i] = Math.random();

    // Assign random color from palette
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return { positions, randoms, colors };
}
