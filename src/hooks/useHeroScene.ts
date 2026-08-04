import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { generateAmbientParticles, generateSignalFieldParticles } from '../utils/proceduralGenerators'
import {
  createAmbientParticleMaterial,
  createInteractiveParticleMaterial,
} from '../materials/interactiveParticleMaterial'

const heroConfig = {
  camera: {
    fov: 66,
    near: 0.1,
    far: 50,
    desktopZ: 15.5,
    mobileZ: 17.5,
  },
  signal: {
    count: 8500,
    width: 18.5,
    height: 9.5,
    depth: 3.1,
    densityBias: 0.65,
    irregularity: 0.24,
    palette: ['#f1f3f5', '#c3c9d0', '#89929d', '#626b76'],
    materialSize: 40,
    noiseStrength: 0.2,
    waveStrength: 0.44,
    offsetY: 0.45,
    mobileOffsetY: 0,
  },
  ambient: {
    count: 900,
    spreadX: 34,
    spreadY: 22,
    depthMin: -14,
    depthMax: -3,
    palette: ['#8f98a4', '#66707d', '#aeb4bc'],
    materialSize: 48,
  },
}

type StableView = 'hero' | 'works' | 'about'

export const useHeroScene = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLElement | null>,
  statementRef?: React.RefObject<HTMLElement | null>,
  onProgress?: (progress: number) => void,
  isHeroActiveRef?: React.RefObject<boolean>,
): {
  triggerWorksTransition: (onComplete: () => void) => void
  triggerAboutTransition: (onComplete: () => void) => void
  triggerHeroTransition: (onComplete: () => void) => void
  triggerAssembly: () => void
  applyViewInstant: (view: StableView) => void
} => {
  const worksTransitionRef = useRef<((onComplete: () => void) => void) | null>(null)
  const aboutTransitionRef = useRef<((onComplete: () => void) => void) | null>(null)
  const heroTransitionRef = useRef<((onComplete: () => void) => void) | null>(null)
  const assemblyRef = useRef<(() => void) | null>(null)
  const applyInstantRef = useRef<((view: StableView) => void) | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current
    const reportProgress = (value: number) => onProgress?.(Math.min(value, 100))
    reportProgress(0)

    const scene = new THREE.Scene()
    const ambientScene = new THREE.Scene()
    const initialAspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight)
    const camera = new THREE.PerspectiveCamera(
      heroConfig.camera.fov,
      initialAspect,
      heroConfig.camera.near,
      heroConfig.camera.far,
    )
    const ambientCamera = new THREE.PerspectiveCamera(
      heroConfig.camera.fov,
      initialAspect,
      heroConfig.camera.near,
      heroConfig.camera.far,
    )
    camera.position.set(0, 0, heroConfig.camera.desktopZ)
    ambientCamera.position.copy(camera.position)

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    renderer.setClearColor(0x010101, 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(container.clientWidth, container.clientHeight)
    reportProgress(18)

    const composer = new EffectComposer(renderer)
    const ambientPass = new RenderPass(ambientScene, ambientCamera)
    const signalPass = new RenderPass(scene, camera)
    signalPass.clear = false
    composer.addPass(ambientPass)
    composer.addPass(signalPass)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.16,
      0.42,
      0.48,
    )
    composer.addPass(bloomPass)
    reportProgress(30)

    const ambientData = generateAmbientParticles(heroConfig.ambient)
    const ambientGeometry = new THREE.BufferGeometry()
    ambientGeometry.setAttribute('position', new THREE.BufferAttribute(ambientData.positions, 3))
    ambientGeometry.setAttribute('randomScale', new THREE.BufferAttribute(ambientData.randoms, 1))
    ambientGeometry.setAttribute('aColor', new THREE.BufferAttribute(ambientData.colors, 3))
    const ambientMaterial = createAmbientParticleMaterial(heroConfig.ambient.materialSize)
    const ambientPoints = new THREE.Points(ambientGeometry, ambientMaterial)
    ambientPoints.renderOrder = -1
    ambientScene.add(ambientPoints)

    const signalData = generateSignalFieldParticles(heroConfig.signal)
    const signalGeometry = new THREE.BufferGeometry()
    signalGeometry.setAttribute('position', new THREE.BufferAttribute(signalData.positions, 3))
    signalGeometry.setAttribute('randomScale', new THREE.BufferAttribute(signalData.randoms, 1))
    signalGeometry.setAttribute('aColor', new THREE.BufferAttribute(signalData.colors, 3))
    const signalMaterial = createInteractiveParticleMaterial({
      size: heroConfig.signal.materialSize,
      color: '#d9dde2',
      noiseStrength: heroConfig.signal.noiseStrength,
      waveStrength: heroConfig.signal.waveStrength,
      fieldWidth: heroConfig.signal.width,
      fieldHeight: heroConfig.signal.height,
      useVertexColors: true,
    })
    const signalPoints = new THREE.Points(signalGeometry, signalMaterial)
    signalPoints.frustumCulled = false
    scene.add(signalPoints)
    reportProgress(62)

    const originalPositions = new Float32Array(signalData.positions)
    const scanPositions = new Float32Array(originalPositions.length)
    for (let i = 0; i < heroConfig.signal.count; i++) {
      scanPositions[i * 3] = originalPositions[i * 3]
      scanPositions[i * 3 + 1] = (signalData.randoms[i] - 0.5) * 0.06
      scanPositions[i * 3 + 2] = originalPositions[i * 3 + 2] * 0.08
    }
    ;(signalGeometry.attributes.position.array as Float32Array).set(scanPositions)
    signalGeometry.attributes.position.needsUpdate = true

    const pointerTarget = new THREE.Vector2(100, 100)
    const pointerCurrent = new THREE.Vector2(100, 100)
    let pointerIntensityTarget = 0
    let isTransitioning = false

    const setSignalVisible = (visible: boolean, opacity = 1) => {
      signalPoints.visible = visible
      ambientPoints.visible = visible
      signalMaterial.uniforms.uOpacity.value = visible ? opacity : 0
    }

    const pointerNdc = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    const signalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const intersection = new THREE.Vector3()

    const setTextLight = (event: PointerEvent) => {
      const statement = statementRef?.current
      if (!statement) return
      const rect = statement.getBoundingClientRect()
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      statement.style.setProperty('--light-x', `${event.clientX - rect.left}px`)
      statement.style.setProperty('--light-y', `${event.clientY - rect.top}px`)
      statement.style.setProperty('--light-strength', inside ? '1' : '0')
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (isTransitioning || isHeroActiveRef?.current === false) return
      const rect = container.getBoundingClientRect()
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc, camera)
      if (raycaster.ray.intersectPlane(signalPlane, intersection)) {
        const localPoint = signalPoints.worldToLocal(intersection.clone())
        pointerTarget.set(localPoint.x, localPoint.y)
        pointerIntensityTarget = 1
      }
      setTextLight(event)
    }

    const handlePointerLeave = () => {
      if (isTransitioning) return
      pointerIntensityTarget = 0
      statementRef?.current?.style.setProperty('--light-strength', '0')
    }

    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)

    assemblyRef.current = () => {
      const progress = { value: 0 }
      gsap.to(progress, {
        value: 1,
        duration: 1.75,
        ease: 'power3.out',
        onUpdate: () => {
          const positions = signalGeometry.attributes.position.array as Float32Array
          for (let i = 0; i < positions.length; i++) {
            positions[i] = scanPositions[i] + (originalPositions[i] - scanPositions[i]) * progress.value
          }
          signalGeometry.attributes.position.needsUpdate = true
        },
      })
    }

    const clock = new THREE.Clock()
    let animationFrameId = 0
    const update = () => {
      const elapsed = clock.getElapsedTime()
      signalMaterial.uniforms.uTime.value = elapsed
      pointerCurrent.lerp(pointerTarget, 0.09)
      signalMaterial.uniforms.uPointer.value.copy(pointerCurrent)
      const currentIntensity = signalMaterial.uniforms.uPointerIntensity.value as number
      signalMaterial.uniforms.uPointerIntensity.value += (pointerIntensityTarget - currentIntensity) * 0.085
      bloomPass.strength = 0.045

      if (isHeroActiveRef?.current === false && !isTransitioning) pointerIntensityTarget = 0
    }
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      update()
      composer.render()
    }

    const resetHeroDom = (visible: boolean) => {
      gsap.set('.hero-copy', { opacity: visible ? 1 : 0, scale: visible ? 1 : 1.035 })
      gsap.set('.header-clock', { opacity: visible ? 1 : 0 })
      statementRef?.current?.style.setProperty('--light-strength', '0')
    }

    const runSectionTransition = (onComplete: () => void) => {
      isTransitioning = true
      setSignalVisible(true)
      pointerTarget.set(0, 0)
      pointerIntensityTarget = 0
      const timeline = gsap.timeline({
        onComplete: () => {
          isTransitioning = false
          pointerIntensityTarget = 0
          setSignalVisible(false)
          onComplete()
        },
      })
      timeline
        .to('.hero-copy', { opacity: 0, scale: 1.035, duration: 0.9, ease: 'power3.in' }, 0.1)
        .to('.header-clock', { opacity: 0, duration: 0.55, ease: 'power2.in' }, 0.1)
        .to(signalMaterial.uniforms.uTransitionProgress, { value: 1, duration: 1.2, ease: 'power2.inOut' }, 0)
        .to(camera.position, { x: 0, z: 9.2, duration: 1.2, ease: 'power3.in' }, 0)
    }

    worksTransitionRef.current = runSectionTransition
    aboutTransitionRef.current = runSectionTransition

    applyInstantRef.current = (view) => {
      ;(signalGeometry.attributes.position.array as Float32Array).set(originalPositions)
      signalGeometry.attributes.position.needsUpdate = true
      const isMobile = (window.visualViewport?.width ?? window.innerWidth) <= 1023
      const homeZ = isMobile ? heroConfig.camera.mobileZ : heroConfig.camera.desktopZ
      pointerIntensityTarget = 0

      if (view === 'hero') {
        signalMaterial.uniforms.uTransitionProgress.value = 0
        setSignalVisible(true, 1)
        camera.position.set(0, isMobile ? -0.35 : 0, homeZ)
        resetHeroDom(true)
      } else {
        signalMaterial.uniforms.uTransitionProgress.value = 1
        setSignalVisible(false)
        camera.position.set(0, isMobile ? -0.35 : 0, 9.2)
        resetHeroDom(false)
      }
      camera.updateProjectionMatrix()
    }

    heroTransitionRef.current = (onComplete) => {
      isTransitioning = true
      setSignalVisible(true, 1)
      const isMobile = (window.visualViewport?.width ?? window.innerWidth) <= 1023
      const homeZ = isMobile ? heroConfig.camera.mobileZ : heroConfig.camera.desktopZ
      pointerIntensityTarget = 0
      resetHeroDom(false)
      const timeline = gsap.timeline({
        onComplete: () => {
          isTransitioning = false
          onComplete()
        },
      })
      timeline
        .to(camera.position, { x: 0, y: isMobile ? -0.35 : 0, z: homeZ, duration: 1.5, ease: 'power3.out' }, 0)
        .to(signalMaterial.uniforms.uTransitionProgress, { value: 0, duration: 1.5, ease: 'power3.out' }, 0)
        .to('.hero-copy', { opacity: 1, scale: 1, duration: 0.7, ease: 'power2.out' }, 0.78)
        .to('.header-clock', { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0.9)
    }

    const handleResize = () => {
      const width = window.visualViewport?.width ?? container.clientWidth
      const height = window.visualViewport?.height ?? container.clientHeight
      if (width === 0 || height === 0) return
      const isMobile = width <= 1023
      const homeZ = isMobile ? heroConfig.camera.mobileZ : heroConfig.camera.desktopZ
      camera.aspect = width / height
      ambientCamera.aspect = width / height
      ambientCamera.position.set(0, 0, homeZ)
      const visibleWorldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * homeZ
      const targetFieldWidth = visibleWorldHeight * camera.aspect * (isMobile ? 0.9 : 0.66)
      const verticalScale = isMobile ? 0.76 : 1
      signalPoints.scale.set(targetFieldWidth / heroConfig.signal.width, verticalScale, verticalScale)
      signalPoints.position.y = isMobile ? heroConfig.signal.mobileOffsetY : heroConfig.signal.offsetY
      signalMaterial.uniforms.uParticleSize.value = heroConfig.signal.materialSize * (isMobile ? 0.78 : 1)
      ambientMaterial.uniforms.uParticleSize.value = heroConfig.ambient.materialSize * (isMobile ? 0.8 : 1)
      if (isHeroActiveRef?.current !== false && !isTransitioning) camera.position.set(0, isMobile ? -0.35 : 0, homeZ)
      camera.updateProjectionMatrix()
      ambientCamera.updateProjectionMatrix()
      renderer.setSize(width, height)
      composer.setSize(width, height)
    }

    handleResize()
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)

    composer.render()
    reportProgress(100)
    animate()

    return () => {
      worksTransitionRef.current = null
      aboutTransitionRef.current = null
      heroTransitionRef.current = null
      assemblyRef.current = null
      applyInstantRef.current = null
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
      renderer.dispose()
      composer.dispose()
      signalGeometry.dispose()
      signalMaterial.dispose()
      ambientGeometry.dispose()
      ambientMaterial.dispose()
      scene.clear()
      ambientScene.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, containerRef, statementRef, isHeroActiveRef])

  const triggerWorksTransition = useCallback((onComplete: () => void) => worksTransitionRef.current?.(onComplete), [])
  const triggerAboutTransition = useCallback((onComplete: () => void) => aboutTransitionRef.current?.(onComplete), [])
  const triggerHeroTransition = useCallback((onComplete: () => void) => heroTransitionRef.current?.(onComplete), [])
  const triggerAssembly = useCallback(() => assemblyRef.current?.(), [])
  const applyViewInstant = useCallback((view: StableView) => applyInstantRef.current?.(view), [])

  return { triggerWorksTransition, triggerAboutTransition, triggerHeroTransition, triggerAssembly, applyViewInstant }
}
