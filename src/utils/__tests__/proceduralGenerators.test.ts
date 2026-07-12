import {
  generateNebulaParticles,
  generateStarParticles,
  type StarGeneratorOptions,
} from '../proceduralGenerators'

// 랜덤 기반 생성기라 값 자체가 아니라 "불변 조건"을 검증한다:
// 버퍼 길이, 유한성(NaN/Infinity 없음), 기하학적 범위.
describe('generateStarParticles', () => {
  const baseOptions: StarGeneratorOptions = {
    count: 1000,
    radius: 8.5,
    innerRadiusRatio: 0.6,
    points: 5,
    thickness: 4.5,
    jitter: 0.4,
  }

  it('positions는 count*3, randoms는 count 길이의 버퍼를 만든다', () => {
    const { positions, randoms } = generateStarParticles(baseOptions)
    expect(positions).toBeInstanceOf(Float32Array)
    expect(positions).toHaveLength(baseOptions.count * 3)
    expect(randoms).toHaveLength(baseOptions.count)
  })

  it('모든 좌표가 유한한 수다 (NaN/Infinity 없음)', () => {
    const { positions, randoms } = generateStarParticles(baseOptions)
    expect(positions.every(Number.isFinite)).toBe(true)
    expect(randoms.every(Number.isFinite)).toBe(true)
  })

  it('XY 평면에서 별 외접원(radius + jitter)을 벗어나지 않는다', () => {
    const { positions } = generateStarParticles(baseOptions)
    const limit = baseOptions.radius + baseOptions.jitter
    for (let i = 0; i < baseOptions.count; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(limit)
    }
  })

  it('Z 깊이가 thickness + jitter 범위 안에 있다', () => {
    const { positions } = generateStarParticles(baseOptions)
    // z = (rand-0.5 + rand-0.5) * currentZThickness → |z| ≤ thickness, + jitter/2
    const limit = baseOptions.thickness + baseOptions.jitter
    for (let i = 0; i < baseOptions.count; i++) {
      expect(Math.abs(positions[i * 3 + 2])).toBeLessThanOrEqual(limit)
    }
  })

  it('randoms는 [0, 1) 구간의 시드다', () => {
    const { randoms } = generateStarParticles(baseOptions)
    for (const r of randoms) {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    }
  })

  it('rotationOffset을 줘도 반경 불변 조건이 유지된다', () => {
    const { positions } = generateStarParticles({
      ...baseOptions,
      rotationOffset: Math.PI / 2 + 0.3, // heroConfig에서 실제 사용하는 값
    })
    const limit = baseOptions.radius + baseOptions.jitter
    for (let i = 0; i < baseOptions.count; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(limit)
      expect(Number.isFinite(positions[i * 3 + 2])).toBe(true)
    }
  })

  it('count 0이면 빈 버퍼를 돌려준다', () => {
    const { positions, randoms } = generateStarParticles({ ...baseOptions, count: 0 })
    expect(positions).toHaveLength(0)
    expect(randoms).toHaveLength(0)
  })
})

describe('generateNebulaParticles', () => {
  const baseOptions = {
    count: 500,
    radiusBase: 0,
    radiusSpread: 50,
    thickness: 0,
  }

  it('positions/randoms/colors 버퍼 길이가 맞는다', () => {
    const { positions, randoms, colors } = generateNebulaParticles(baseOptions)
    expect(positions).toHaveLength(baseOptions.count * 3)
    expect(randoms).toHaveLength(baseOptions.count)
    expect(colors).toHaveLength(baseOptions.count * 3)
  })

  it('XY가 전체 스프레드(radiusBase + radiusSpread) 안에 균일 분포한다', () => {
    const { positions } = generateNebulaParticles(baseOptions)
    const spread = baseOptions.radiusBase + baseOptions.radiusSpread
    for (let i = 0; i < baseOptions.count; i++) {
      expect(Math.abs(positions[i * 3])).toBeLessThanOrEqual(spread)
      expect(Math.abs(positions[i * 3 + 1])).toBeLessThanOrEqual(spread)
    }
  })

  it('thickness 0이면 Z는 전부 0이다 (평면 분포)', () => {
    const { positions } = generateNebulaParticles(baseOptions)
    for (let i = 0; i < baseOptions.count; i++) {
      expect(positions[i * 3 + 2]).toBeCloseTo(0)
    }
  })

  it('컬러는 흰색 팔레트(r=g=b=1)에서 나온다', () => {
    const { colors } = generateNebulaParticles(baseOptions)
    for (const c of colors) {
      expect(c).toBeCloseTo(1)
    }
  })
})
