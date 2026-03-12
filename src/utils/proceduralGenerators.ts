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

export interface SupernovaGeneratorOptions {
  count: number;
  radius: number; // Base radius of the sphere
}

export function generateSupernovaParticles(options: SupernovaGeneratorOptions) {
  const positions = new Float32Array(options.count * 3);
  const randoms = new Float32Array(options.count);

  const { count, radius } = options;

  // Roughly 70% on surface, 30% inside (rough fill)
  const surfaceRatio = 0.7;

  for (let i = 0; i < count; i++) {
    // Generate uniform distribution on sphere surface using spherical coordinates
    const u = Math.random(); // 0 to 1
    const v = Math.random(); // 0 to 1
    
    // Spherical coordinates
    const theta = u * Math.PI * 2; // Azimuth angle (0 to 2π)
    const phi = Math.acos(2 * v - 1); // Polar angle (0 to π)
    
    // Convert to Cartesian coordinates on unit sphere
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);
    
    // Decide if particle is on surface or inside
    const isSurface = Math.random() < surfaceRatio;
    
    if (isSurface) {
      // Place particles on sphere surface
      positions[i * 3 + 0] = x * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = z * radius;
    } else {
      // Place particles inside sphere (rough fill)
      // Use cube root for uniform distribution in 3D volume
      const r = Math.pow(Math.random(), 1/3) * radius;
      positions[i * 3 + 0] = x * r;
      positions[i * 3 + 1] = y * r;
      positions[i * 3 + 2] = z * r;
    }

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
    new THREE.Color("#ff8c00"), // Orange
    new THREE.Color("#4e77ff"), // Blue
    new THREE.Color("#9b5de5"), // Purple
  ];

  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    // Push particles out past radiusBase, then feather out
    const r = radiusBase + Math.random() * Math.random() * radiusSpread; // Math.random() twice biases to the inner edge of the nebula ring

    const rootDist = Math.sqrt(r - radiusBase) / Math.sqrt(radiusSpread); // Density falloff
    
    // Z-thickness, thicker in the outer edge forming an accretion disk / cloud
    const zThickness = thickness * (0.2 + rootDist); 
    let z = (Math.random() - 0.5) * zThickness;

    // Add extra volumetric noise
    const rz = (Math.random() - 0.5) * (thickness * 0.5);

    positions[i * 3 + 0] = r * Math.cos(a);
    positions[i * 3 + 1] = r * Math.sin(a);
    positions[i * 3 + 2] = z + rz;
    randoms[i] = Math.random();

    // Assign random color from palette
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return { positions, randoms, colors };
}
