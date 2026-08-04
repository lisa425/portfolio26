import {
  generateAccretionDiskParticles,
  generateAmbientParticles,
  generateCoreParticles,
  generateSignalFieldParticles,
  type AccretionDiskOptions,
  type CoreParticleOptions,
  type SignalFieldOptions,
} from '../proceduralGenerators'

describe('generateCoreParticles', () => {
  const baseOptions: CoreParticleOptions = {
    count: 1000,
    radius: 3.8,
    flattening: 0.62,
    densityBias: 1.75,
    jitter: 0.18,
    palette: ['#f0d7a2', '#f5f7fa', '#aeb8c6'],
  }

  it('creates correctly sized finite buffers', () => {
    const { positions, randoms, colors } = generateCoreParticles(baseOptions)
    expect(positions).toHaveLength(baseOptions.count * 3)
    expect(randoms).toHaveLength(baseOptions.count)
    expect(colors).toHaveLength(baseOptions.count * 3)
    expect(positions.every(Number.isFinite)).toBe(true)
    expect(colors.every(Number.isFinite)).toBe(true)
  })

  it('keeps particles within the configured volume', () => {
    const { positions } = generateCoreParticles(baseOptions)
    const limit = baseOptions.radius + baseOptions.jitter * 2
    for (let i = 0; i < baseOptions.count; i++) {
      expect(Math.hypot(positions[i * 3], positions[i * 3 + 1])).toBeLessThanOrEqual(limit)
      expect(Math.abs(positions[i * 3 + 2])).toBeLessThanOrEqual(limit * baseOptions.flattening)
    }
  })

  it('keeps random seeds and colors in the normalized range', () => {
    const { randoms, colors } = generateCoreParticles(baseOptions)
    for (const value of [...randoms, ...colors]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('returns empty buffers for count 0', () => {
    const result = generateCoreParticles({ ...baseOptions, count: 0 })
    expect(result.positions).toHaveLength(0)
    expect(result.randoms).toHaveLength(0)
    expect(result.colors).toHaveLength(0)
  })
})

describe('generateAmbientParticles', () => {
  const options = {
    count: 900,
    spreadX: 34,
    spreadY: 22,
    depthMin: -14,
    depthMax: -3,
    palette: ['#8f98a4', '#66707d', '#aeb4bc'],
  }

  it('creates finite buffers inside the configured volume', () => {
    const { positions, randoms, colors } = generateAmbientParticles(options)
    expect(positions).toHaveLength(options.count * 3)
    expect(randoms).toHaveLength(options.count)
    expect(colors).toHaveLength(options.count * 3)
    expect(positions.every(Number.isFinite)).toBe(true)

    for (let i = 0; i < options.count; i++) {
      expect(Math.abs(positions[i * 3])).toBeLessThanOrEqual(options.spreadX)
      expect(Math.abs(positions[i * 3 + 1])).toBeLessThanOrEqual(options.spreadY)
      expect(positions[i * 3 + 2]).toBeGreaterThanOrEqual(options.depthMin)
      expect(positions[i * 3 + 2]).toBeLessThanOrEqual(options.depthMax)
    }
  })

  it('returns empty buffers for count 0', () => {
    const result = generateAmbientParticles({ ...options, count: 0 })
    expect(result.positions).toHaveLength(0)
    expect(result.randoms).toHaveLength(0)
    expect(result.colors).toHaveLength(0)
  })
})

describe('generateSignalFieldParticles', () => {
  const options: SignalFieldOptions = {
    count: 760,
    width: 24,
    height: 6.4,
    depth: 1.8,
    densityBias: 1.65,
    irregularity: 0.24,
    palette: ['#f1f3f5', '#89929d', '#626b76'],
  }

  it('creates finite buffers with normalized colors', () => {
    const { positions, randoms, colors } = generateSignalFieldParticles(options)
    expect(positions).toHaveLength(options.count * 3)
    expect(randoms).toHaveLength(options.count)
    expect(colors).toHaveLength(options.count * 3)
    expect(positions.every(Number.isFinite)).toBe(true)
    for (const value of [...randoms, ...colors]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('keeps the field inside its configured volume', () => {
    const { positions } = generateSignalFieldParticles(options)
    for (let i = 0; i < options.count; i++) {
      expect(Math.abs(positions[i * 3])).toBeLessThanOrEqual(options.width * 0.55)
      expect(Math.abs(positions[i * 3 + 1])).toBeLessThanOrEqual(options.height)
      expect(Math.abs(positions[i * 3 + 2])).toBeLessThanOrEqual(options.depth)
    }
  })

  it('keeps the center denser than equal-width outer regions', () => {
    const denseField = generateSignalFieldParticles({ ...options, count: 6000 })
    let centerCount = 0
    let outerCount = 0

    for (let i = 0; i < 6000; i++) {
      const normalizedX = Math.abs(denseField.positions[i * 3]) / options.width
      if (normalizedX < 0.15) centerCount++
      else if (normalizedX > 0.35) outerCount++
    }

    expect(centerCount).toBeGreaterThan(outerCount * 1.2)
  })

  it('returns empty buffers for count 0', () => {
    const result = generateSignalFieldParticles({ ...options, count: 0 })
    expect(result.positions).toHaveLength(0)
    expect(result.randoms).toHaveLength(0)
    expect(result.colors).toHaveLength(0)
  })
})

describe('generateAccretionDiskParticles', () => {
  const baseOptions: AccretionDiskOptions = {
    count: 1100,
    innerRadius: 1.6,
    outerRadius: 15,
    ellipseRatio: 0.42,
    thickness: 1.8,
    spiralStrength: 1.25,
    bridgeRatio: 0.16,
    rotation: -0.18,
    core1: [-3.8, -0.8],
    core2: [4.3, 1.5],
    palette: ['#f4f6f8', '#b9c2ce', '#7f8997'],
    warmCoreColor: '#e8c78d',
  }

  it('creates correctly sized finite buffers', () => {
    const { positions, randoms, colors } = generateAccretionDiskParticles(baseOptions)
    expect(positions).toHaveLength(baseOptions.count * 3)
    expect(randoms).toHaveLength(baseOptions.count)
    expect(colors).toHaveLength(baseOptions.count * 3)
    expect(positions.every(Number.isFinite)).toBe(true)
  })

  it('keeps the disk inside its outer radius plus arm noise', () => {
    const { positions } = generateAccretionDiskParticles(baseOptions)
    const limit = baseOptions.outerRadius + 1
    for (let i = 0; i < baseOptions.count; i++) {
      expect(Math.hypot(positions[i * 3], positions[i * 3 + 1])).toBeLessThanOrEqual(limit)
      expect(Math.abs(positions[i * 3 + 2])).toBeLessThanOrEqual(baseOptions.thickness)
    }
  })

  it('keeps colors in the normalized range', () => {
    const { colors } = generateAccretionDiskParticles(baseOptions)
    for (const value of colors) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('returns empty buffers for count 0', () => {
    const result = generateAccretionDiskParticles({ ...baseOptions, count: 0 })
    expect(result.positions).toHaveLength(0)
    expect(result.randoms).toHaveLength(0)
    expect(result.colors).toHaveLength(0)
  })
})
