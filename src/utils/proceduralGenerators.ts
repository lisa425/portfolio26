import * as THREE from 'three'

export interface CoreParticleOptions {
  count: number
  radius: number
  flattening: number
  densityBias: number
  jitter: number
  palette: string[]
  warmCoreRatio?: number
}

export interface AccretionDiskOptions {
  count: number
  innerRadius: number
  outerRadius: number
  ellipseRatio: number
  thickness: number
  spiralStrength: number
  bridgeRatio: number
  rotation: number
  core1: [number, number]
  core2: [number, number]
  palette: string[]
  warmCoreColor: string
}

export interface AmbientParticleOptions {
  count: number
  spreadX: number
  spreadY: number
  depthMin: number
  depthMax: number
  palette: string[]
}

export interface SignalFieldOptions {
  count: number
  width: number
  height: number
  depth: number
  bands: number
  palette: string[]
}

const randomSigned = () => Math.random() * 2 - 1

const writeColor = (target: Float32Array, index: number, color: THREE.Color) => {
  target[index * 3] = color.r
  target[index * 3 + 1] = color.g
  target[index * 3 + 2] = color.b
}

export function generateCoreParticles(options: CoreParticleOptions) {
  const positions = new Float32Array(options.count * 3)
  const randoms = new Float32Array(options.count)
  const colors = new Float32Array(options.count * 3)
  const palette = options.palette.map((color) => new THREE.Color(color))
  const warmCoreRatio = options.warmCoreRatio ?? 0.28

  for (let i = 0; i < options.count; i++) {
    const theta = Math.random() * Math.PI * 2
    const cosPhi = randomSigned()
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
    const normalizedRadius = Math.pow(Math.random(), options.densityBias)
    const radius = normalizedRadius * options.radius
    const edgeJitter = options.jitter * (0.25 + normalizedRadius * 0.75)

    positions[i * 3] = radius * sinPhi * Math.cos(theta) + randomSigned() * edgeJitter
    positions[i * 3 + 1] = radius * sinPhi * Math.sin(theta) + randomSigned() * edgeJitter
    positions[i * 3 + 2] =
      radius * cosPhi * options.flattening + randomSigned() * edgeJitter * options.flattening
    randoms[i] = Math.random()

    const coreWeight = 1 - normalizedRadius
    const colorIndex =
      coreWeight > 1 - warmCoreRatio
        ? 0
        : Math.min(palette.length - 1, 1 + Math.floor(Math.random() * Math.max(1, palette.length - 1)))
    writeColor(colors, i, palette[colorIndex] ?? new THREE.Color('#ffffff'))
  }

  return { positions, randoms, colors }
}

export function generateAccretionDiskParticles(options: AccretionDiskOptions) {
  const positions = new Float32Array(options.count * 3)
  const randoms = new Float32Array(options.count)
  const colors = new Float32Array(options.count * 3)
  const palette = options.palette.map((color) => new THREE.Color(color))
  const warmCoreColor = new THREE.Color(options.warmCoreColor)
  const bridgeCount = Math.round(options.count * options.bridgeRatio)
  const haloCount = Math.round(options.count * 0.12)
  const cosRotation = Math.cos(options.rotation)
  const sinRotation = Math.sin(options.rotation)

  const setPosition = (index: number, x: number, y: number, z: number) => {
    positions[index * 3] = x * cosRotation - y * sinRotation
    positions[index * 3 + 1] = x * sinRotation + y * cosRotation
    positions[index * 3 + 2] = z
  }

  for (let i = 0; i < options.count; i++) {
    randoms[i] = Math.random()

    if (i < bridgeCount) {
      const t = Math.random()
      const inverseT = 1 - t
      const midX = (options.core1[0] + options.core2[0]) * 0.5
      const midY = (options.core1[1] + options.core2[1]) * 0.5 + 2.1
      const x =
        inverseT * inverseT * options.core1[0] +
        2 * inverseT * t * midX +
        t * t * options.core2[0] +
        randomSigned() * 0.65
      const y =
        inverseT * inverseT * options.core1[1] +
        2 * inverseT * t * midY +
        t * t * options.core2[1] +
        randomSigned() * 0.38
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = randomSigned() * options.thickness * 0.35
      writeColor(colors, i, Math.random() < 0.16 ? warmCoreColor : palette[0])
      continue
    }

    const isHalo = i >= options.count - haloCount
    const radialProgress = isHalo
      ? 0.58 + Math.random() * 0.42
      : Math.pow(Math.random(), 1.18)
    const radius = options.innerRadius + (options.outerRadius - options.innerRadius) * radialProgress
    const arm = i % 2
    const armWidth = isHalo ? Math.PI : 0.28 + radialProgress * 0.48
    const angle = isHalo
      ? Math.random() * Math.PI * 2
      : arm * Math.PI + radialProgress * options.spiralStrength * Math.PI * 2 + randomSigned() * armWidth
    const radialNoise = randomSigned() * (0.18 + radialProgress * 0.7)
    const x = (radius + radialNoise) * Math.cos(angle)
    const y = (radius + radialNoise) * Math.sin(angle) * options.ellipseRatio
    const zSpread = options.thickness * (1 - radialProgress * 0.72)

    setPosition(i, x, y, randomSigned() * zSpread)

    const nearCenter = radialProgress < 0.24
    const paletteIndex = Math.floor(Math.random() * palette.length)
    writeColor(colors, i, nearCenter && Math.random() < 0.14 ? warmCoreColor : palette[paletteIndex])
  }

  return { positions, randoms, colors }
}

export function generateAmbientParticles(options: AmbientParticleOptions) {
  const positions = new Float32Array(options.count * 3)
  const randoms = new Float32Array(options.count)
  const colors = new Float32Array(options.count * 3)
  const palette = options.palette.map((color) => new THREE.Color(color))
  const depthRange = options.depthMax - options.depthMin

  for (let i = 0; i < options.count; i++) {
    positions[i * 3] = randomSigned() * options.spreadX
    positions[i * 3 + 1] = randomSigned() * options.spreadY
    positions[i * 3 + 2] = options.depthMin + Math.random() * depthRange
    randoms[i] = Math.random()
    writeColor(colors, i, palette[Math.floor(Math.random() * palette.length)] ?? new THREE.Color('#77808c'))
  }

  return { positions, randoms, colors }
}

export function generateSignalFieldParticles(options: SignalFieldOptions) {
  const positions = new Float32Array(options.count * 3)
  const randoms = new Float32Array(options.count)
  const colors = new Float32Array(options.count * 3)
  const palette = options.palette.map((color) => new THREE.Color(color))
  const bandCount = Math.max(1, Math.floor(options.bands))

  for (let i = 0; i < options.count; i++) {
    const seed = Math.random()
    const rawX = randomSigned()
    const xProgress = rawX * (0.7 + Math.abs(rawX) * 0.3)
    const x = xProgress * options.width * 0.5
    const band = i % bandCount
    const rawBand = band / Math.max(1, bandCount - 1) - 0.5
    const centeredBand = Math.sign(rawBand) * Math.pow(Math.abs(rawBand) * 2, 1.25) * 0.5
    const bandOffset = centeredBand * options.height * 0.62
    const wave = Math.sin(xProgress * Math.PI * (1.25 + band * 0.18) + band * 1.7)
    const envelope = Math.pow(1 - Math.abs(xProgress), 0.55)
    const yNoise = randomSigned() * options.height * (0.075 + (1 - envelope) * 0.17)

    positions[i * 3] = x + randomSigned() * options.width * 0.018
    positions[i * 3 + 1] = bandOffset + wave * options.height * 0.12 + yNoise
    positions[i * 3 + 2] = randomSigned() * options.depth * (0.35 + envelope * 0.65)
    randoms[i] = seed
    writeColor(colors, i, palette[Math.floor(seed * palette.length)] ?? new THREE.Color('#aeb4bc'))
  }

  return { positions, randoms, colors }
}
