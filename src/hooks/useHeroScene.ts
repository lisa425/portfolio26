import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  generateStarParticles,
  generateNebulaParticles,
} from "../utils/proceduralGenerators";
import { createInteractiveParticleMaterial } from "../materials/interactiveParticleMaterial";
import { useMobile } from "./useMobile";

const heroConfig = {
  camera: {
    fov: 75,
    near: 0.1,
    far: 50, // Z depth
    z: 22, // Move camera back to see the volumetric shapes
    x: window.innerWidth < 1280 ? -7.0 : -3.5, // 별이 화면 오른쪽에 보이도록 카메라를 좌측으로
    y: window.innerWidth < 1280 ? -2.0 : -0.0, // 별이 화면 위쪽에 보이도록 카메라를 아래로
  },
  render: {
    maxPixelRatio: Math.min(window.devicePixelRatio, 1.5),
    alpha: true,
    antialias: true,
    clearColor: 0x000000,
    clearAlpha: 1, // Let's make the background pitch black for maximum cosmic space contrast
  },
  particles: {
    coreStar: {
      count: 5000,
      radius: 8.5,
      innerRadiusRatio: 0.6,
      points: 5,
      thickness: 4.5, // Increased from 1.0. This directly controls the maximum Z-axis spread (depth)
      jitter: 0.4, // Increased from 0.1. Adds random 3D scatter, making it look less like a solid shell
      rotationOffset: Math.PI / 2 + 0.3,

      material: {
        size: 50.0,
        color: "#eae9f3", // Pure white/blue core
        noiseStrength: 0.2, // Less undulating so it doesn't distort the star shape too much
        holeRadius: 9.0, // The exact coordinate size of the pushed hole
        repulsionForce: 0.5, // Reduced from 1.5 to 0.5 to make distance interaction weaker
      },
      starPosition: {
        star1: [-6, 1, 0],
        star2: [7, -4, 0],
      },
      star2Scale: 0.6, // star2의 비율 (holeRadius 등에 공통 적용)
    },
    nebula: {
      count: 8000, // 배경 별 밀도 증가
      radiusBase: 0, // Starts roughly outside the star
      radiusSpread: 50.0, // 더 넓게 퍼지도록 확장
      thickness: 0.0, // Flat spread

      material: {
        size: 10.0,
        color: "#4e77ff",
        noiseStrength: 0.2, // Less wavey
        holeRadius: 9.0, // 별 크기(radius)와 비슷하게 설정
        repulsionForce: 0, // 마우스 인터랙션 없음
      },
    },
  },
  postprocessing: {
    bloom: {
      enabled: true,
      strength: 0.3,
      radius: 0.7,
      threshold: 0.2,
    },
  },
};

export const useHeroScene = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLElement | null>,
  buttonWorksRef?: React.RefObject<HTMLElement | null>,
  buttonInfoRef?: React.RefObject<HTMLElement | null>,
  onProgress?: (progress: number) => void,
  isHeroActiveRef?: React.RefObject<boolean>,
): {
  triggerWorksTransition: (onComplete: () => void) => void;
  triggerInfoTransition: (onComplete: () => void) => void;
  triggerHeroTransition: (onComplete: () => void) => void;
  triggerAssembly: () => void;
} => {
  const worksTransitionRef = useRef<((onComplete: () => void) => void) | null>(
    null,
  );
  const infoTransitionRef = useRef<((onComplete: () => void) => void) | null>(
    null,
  );
  const heroTransitionRef = useRef<((onComplete: () => void) => void) | null>(
    null,
  );
  const assemblyRef = useRef<(() => void) | null>(null);

  const { isMobile } = useMobile();
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    // Progress tracking helper
    const reportProgress = (value: number) => {
      onProgress?.(Math.min(value, 100));
    };

    reportProgress(0);

    // 1. SCENE
    const scene = new THREE.Scene();

    // 2. CAMERA
    const camera = new THREE.PerspectiveCamera(
      heroConfig.camera.fov,
      container.clientWidth / container.clientHeight,
      heroConfig.camera.near,
      heroConfig.camera.far,
    );
    camera.position.set(
      heroConfig.camera.x,
      heroConfig.camera.y,
      heroConfig.camera.z,
    );

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: isMobileRef.current ? false : heroConfig.render.alpha,
      antialias: false, // 파티클 시스템에는 antialias 불필요 (성능 최적화)
    });
    renderer.setClearColor(
      heroConfig.render.clearColor,
      heroConfig.render.clearAlpha,
    );
    renderer.setPixelRatio(heroConfig.render.maxPixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);

    reportProgress(15); // Renderer ready

    // 4. POST-PROCESSING (Bloom Composer)
    const composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    let bloomPass: UnrealBloomPass | null = null;
    if (heroConfig.postprocessing.bloom.enabled) {
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        heroConfig.postprocessing.bloom.strength,
        heroConfig.postprocessing.bloom.radius,
        heroConfig.postprocessing.bloom.threshold,
      );
      composer.addPass(bloomPass);
    }

    reportProgress(25); // Post-processing ready

    // -------------------------------------------------------------
    // 5. MOUSE INTERACTION SETUP (Raycaster & Drag Rotation)
    // -------------------------------------------------------------
    // 각 별에 대해 별도의 마우스 파라미터 (별의 위치를 고려한 로컬 좌표계)
    const mouseParams = {
      targetX: 100, // 초기값을 멀리 설정하여 구멍이 생기지 않도록
      targetY: 100,
      currentX: 100, // We lerp towards target for smoothness
      currentY: 100,
    };

    // Cursor-driven rotation targets (mapped directly from mouse NDC position)
    let targetRotationX = 0;
    let targetRotationY = 0;

    // Button hover state (각 별별로 독립적으로 관리)
    let isButtonHoveredStar1 = false;
    let isButtonHoveredStar2 = false;
    let isTransitioning = false;

    const MAX_ROTATION = THREE.MathUtils.degToRad(20); // limit to ~10 degrees max in either direction

    // Create an invisible plane at Z=0 to cast rays against to know exactly where the mouse is in 3D world space
    const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    const mouseVec2D = new THREE.Vector2(-9999, -9999); // Start offscreen

    const handleMouseMove = (event: MouseEvent) => {
      if (isHeroActiveRef?.current === false) return;
      if (isMobileRef.current) return; // Disable all mouse interactions on mobile

      // 1. Hole Repulsion Logic (Raycaster)
      const rect = container.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;

      mouseVec2D.x = (clientX / container.clientWidth) * 2 - 1;
      mouseVec2D.y = -(clientY / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouseVec2D, camera);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeZ0, intersectPoint);

      if (intersectPoint) {
        mouseParams.targetX = intersectPoint.x;
        mouseParams.targetY = intersectPoint.y;
      }

      // 2. Cursor-position-based rotation (버튼 호버 중에는 비활성화)
      if (!isButtonHoveredStar1 && !isButtonHoveredStar2) {
        // NDC mouseVec2D is already -1..1; scale directly to MAX_ROTATION
        targetRotationY = mouseVec2D.x * MAX_ROTATION;
        targetRotationX = -mouseVec2D.y * MAX_ROTATION;
      }
    };

    container.addEventListener("mousemove", handleMouseMove);
    // On mouse leave, lerp mouse back towards infinity (or corner) so the hole closes
    // and return stars to neutral rotation
    const handleMouseLeave = () => {
      mouseParams.targetX = 100;
      mouseParams.targetY = 100;
      targetRotationX = 0;
      targetRotationY = 0;
    };
    container.addEventListener("mouseleave", handleMouseLeave);

    // -------------------------------------------------------------
    // 6. GENERATE PARTICLES (Core Star & Nebula)
    // -------------------------------------------------------------
    const clock = new THREE.Clock();

    // LAYER 1: Star 1 (기존 별)
    const star1Data = generateStarParticles({
      count: heroConfig.particles.coreStar.count,
      radius: heroConfig.particles.coreStar.radius,
      innerRadiusRatio: heroConfig.particles.coreStar.innerRadiusRatio,
      points: heroConfig.particles.coreStar.points,
      thickness: heroConfig.particles.coreStar.thickness,
      jitter: heroConfig.particles.coreStar.jitter,
      rotationOffset: heroConfig.particles.coreStar.rotationOffset,
    });

    const star1Geo = new THREE.BufferGeometry();
    star1Geo.setAttribute(
      "position",
      new THREE.BufferAttribute(star1Data.positions, 3),
    );
    star1Geo.setAttribute(
      "randomScale",
      new THREE.BufferAttribute(star1Data.randoms, 1),
    );

    const star1Mat = createInteractiveParticleMaterial({
      size: heroConfig.particles.coreStar.material.size,
      color: heroConfig.particles.coreStar.material.color,
      noiseStrength: heroConfig.particles.coreStar.material.noiseStrength,
      holeRadius: heroConfig.particles.coreStar.material.holeRadius,
      repulsionForce: heroConfig.particles.coreStar.material.repulsionForce,
      isCoreStar: true, // coreStar 파티클에만 크기 변화 적용
    });

    const star1Points = new THREE.Points(star1Geo, star1Mat);
    star1Points.position.set(
      heroConfig.particles.coreStar.starPosition.star1[0],
      heroConfig.particles.coreStar.starPosition.star1[1],
      heroConfig.particles.coreStar.starPosition.star1[2],
    );
    star1Points.rotation.y = THREE.MathUtils.degToRad(30);
    scene.add(star1Points);

    reportProgress(45); // Star 1 generated

    // LAYER 2: Star 2 (작은 별)
    const star2Data = generateStarParticles({
      count: heroConfig.particles.coreStar.count,
      radius: heroConfig.particles.coreStar.radius * 0.6, // 60% 크기
      innerRadiusRatio: heroConfig.particles.coreStar.innerRadiusRatio,
      points: heroConfig.particles.coreStar.points,
      thickness: heroConfig.particles.coreStar.thickness,
      jitter: heroConfig.particles.coreStar.jitter,
      rotationOffset: heroConfig.particles.coreStar.rotationOffset,
    });

    const star2Geo = new THREE.BufferGeometry();
    star2Geo.setAttribute(
      "position",
      new THREE.BufferAttribute(star2Data.positions, 3),
    );
    star2Geo.setAttribute(
      "randomScale",
      new THREE.BufferAttribute(star2Data.randoms, 1),
    );

    const star2Scale = heroConfig.particles.coreStar.star2Scale;
    const star2Mat = createInteractiveParticleMaterial({
      size: heroConfig.particles.coreStar.material.size * 0.8,
      color: heroConfig.particles.coreStar.material.color,
      noiseStrength: heroConfig.particles.coreStar.material.noiseStrength,
      holeRadius:
        heroConfig.particles.coreStar.material.holeRadius * star2Scale, // star2Scale 적용
      repulsionForce: heroConfig.particles.coreStar.material.repulsionForce,
      isCoreStar: true,
    });

    const star2Points = new THREE.Points(star2Geo, star2Mat);
    star2Points.position.set(
      heroConfig.particles.coreStar.starPosition.star2[0],
      heroConfig.particles.coreStar.starPosition.star2[1],
      heroConfig.particles.coreStar.starPosition.star2[2],
    );
    star2Points.rotation.y = THREE.MathUtils.degToRad(-30);
    star2Points.rotation.z = THREE.MathUtils.degToRad(-30);
    scene.add(star2Points);

    reportProgress(60); // Star 2 generated

    // -------------------------------------------------------------
    // 7a. PARTICLE ASSEMBLY SETUP (scatter → star convergence)
    // -------------------------------------------------------------
    // Copy the original (star-shaped) positions before we scatter them
    const originalPos1 = new Float32Array(star1Data.positions);
    const originalPos2 = new Float32Array(star2Data.positions);

    // Generate random scatter positions in a sphere
    const genScatter = (n: number, r = 22): Float32Array => {
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i += 3) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const dist = r * (0.5 + Math.random() * 0.5);
        arr[i] = dist * Math.sin(phi) * Math.cos(theta);
        arr[i + 1] = dist * Math.sin(phi) * Math.sin(theta);
        arr[i + 2] = dist * Math.cos(phi);
      }
      return arr;
    };

    const scattered1 = genScatter(heroConfig.particles.coreStar.count);
    const scattered2 = genScatter(heroConfig.particles.coreStar.count);

    // Set geometries to scattered state (canvas is brightness(0) so not visible yet)
    (star1Geo.attributes.position.array as Float32Array).set(scattered1);
    star1Geo.attributes.position.needsUpdate = true;
    (star2Geo.attributes.position.array as Float32Array).set(scattered2);
    star2Geo.attributes.position.needsUpdate = true;

    // Assembly trigger — called from heroIntroMotion in App.tsx
    assemblyRef.current = () => {
      const prog = { v: 0 };
      gsap.to(prog, {
        v: 1,
        duration: 2.0,
        ease: "expo.out",
        onUpdate: () => {
          const t = prog.v;
          const p1 = star1Geo.attributes.position.array as Float32Array;
          const p2 = star2Geo.attributes.position.array as Float32Array;
          for (let i = 0; i < p1.length; i++) {
            p1[i] = scattered1[i] + (originalPos1[i] - scattered1[i]) * t;
          }
          for (let i = 0; i < p2.length; i++) {
            p2[i] = scattered2[i] + (originalPos2[i] - scattered2[i]) * t;
          }
          star1Geo.attributes.position.needsUpdate = true;
          star2Geo.attributes.position.needsUpdate = true;
        },
      });
    };

    // Button hover effect: 버튼에 마우스오버하면 구멍 효과 발생
    let targetButtonHoverStar1 = 0.0; // star1용 (btn-go-works)
    let targetButtonHoverStar2 = 0.0; // star2용 (btn-go-info)
    let buttonCleanup: (() => void) | null = null;

    // btn-go-works: star1에만 효과
    if (buttonWorksRef?.current) {
      const button = buttonWorksRef.current;

      const handleButtonMouseEnter = () => {
        if (isTransitioning) return;
        if (isMobileRef.current) return; // Disable hover effect on mobile
        isButtonHoveredStar1 = true;
        targetButtonHoverStar1 = 1.0; // star1만 활성화

        // 별의 rotation을 0으로 초기화
        targetRotationX = 0;
        targetRotationY = 0;
      };

      const handleButtonMouseLeave = () => {
        if (isTransitioning) return;
        if (isMobileRef.current) return; // Disable hover effect on mobile
        isButtonHoveredStar1 = false;
        targetButtonHoverStar1 = 0.0; // star1 비활성화
      };

      button.addEventListener("mouseenter", handleButtonMouseEnter);
      button.addEventListener("mouseleave", handleButtonMouseLeave);

      if (!buttonCleanup) {
        buttonCleanup = () => {};
      }
      const originalCleanup = buttonCleanup;
      buttonCleanup = () => {
        originalCleanup();
        button.removeEventListener("mouseenter", handleButtonMouseEnter);
        button.removeEventListener("mouseleave", handleButtonMouseLeave);
      };
    }

    // btn-go-info: star2에만 효과
    if (buttonInfoRef?.current) {
      const button = buttonInfoRef.current;

      const handleButtonMouseEnter = () => {
        if (isTransitioning) return;
        if (isMobileRef.current) return; // Disable hover effect on mobile
        isButtonHoveredStar2 = true;
        targetButtonHoverStar2 = 1.0; // star2만 활성화

        // 별의 rotation을 0으로 초기화
        targetRotationX = 0;
        targetRotationY = 0;
      };

      const handleButtonMouseLeave = () => {
        if (isTransitioning) return;
        if (isMobileRef.current) return; // Disable hover effect on mobile
        isButtonHoveredStar2 = false;
        targetButtonHoverStar2 = 0.0; // star2 비활성화
      };

      button.addEventListener("mouseenter", handleButtonMouseEnter);
      button.addEventListener("mouseleave", handleButtonMouseLeave);

      if (!buttonCleanup) {
        buttonCleanup = () => {};
      }
      const originalCleanup = buttonCleanup;
      buttonCleanup = () => {
        originalCleanup();
        button.removeEventListener("mouseenter", handleButtonMouseEnter);
        button.removeEventListener("mouseleave", handleButtonMouseLeave);
      };
    }

    // LAYER 2: Nebula Cloud
    const nebulaData = generateNebulaParticles({
      count: heroConfig.particles.nebula.count,
      radiusBase: heroConfig.particles.nebula.radiusBase,
      radiusSpread: heroConfig.particles.nebula.radiusSpread,
      thickness: heroConfig.particles.nebula.thickness,
    });

    const nebulaGeo = new THREE.BufferGeometry();
    nebulaGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(nebulaData.positions, 3),
    );
    nebulaGeo.setAttribute(
      "randomScale",
      new THREE.BufferAttribute(nebulaData.randoms, 1),
    );
    nebulaGeo.setAttribute(
      "aColor",
      new THREE.BufferAttribute(nebulaData.colors, 3),
    );

    const nebulaMat = createInteractiveParticleMaterial({
      size: heroConfig.particles.nebula.material.size,
      color: heroConfig.particles.nebula.material.color,
      noiseStrength: heroConfig.particles.nebula.material.noiseStrength,
      holeRadius: 0, // 초기값은 0 (버튼 호버 시에만 구멍 생성)
      holeRadiusStar2: 0, // star2 holeRadius도 초기값 0
      repulsionForce: heroConfig.particles.nebula.material.repulsionForce,
      useVertexColors: true, // Enable the per-vertex color macro in the shader
    });

    const nebulaPoints = new THREE.Points(nebulaGeo, nebulaMat);
    scene.add(nebulaPoints);

    reportProgress(80); // Nebula generated

    // -------------------------------------------------------------
    // 7. ANIMATION LOOP
    // -------------------------------------------------------------
    let animationFrameId: number;

    // Reusable Vector3 for projectHoleToScreen — allocated once, never GC'd per frame
    const _projVec3 = new THREE.Vector3();

    // Project a 2D hole position (world XY, Z=0) into CSS pixel coords for button placement
    // Defined OUTSIDE update() so the function object is not re-created every frame
    const projectHoleToScreen = (hx: number, hy: number) => {
      _projVec3.set(hx, hy, 0);
      _projVec3.project(camera); // NDC (-1 ~ 1)
      return {
        x: (_projVec3.x * 0.5 + 0.5) * container.clientWidth,
        y: (-_projVec3.y * 0.5 + 0.5) * container.clientHeight,
      };
    };

    const update = () => {
      const elapsedTime = clock.getElapsedTime();
      const starElapsedSpeed = 0.1;
      const nebulaElapsedSpeed = 0.1;

      // hero가 아닐 때 마우스를 멀리 보내서 파티클 인터랙션 비활성화
      if (isHeroActiveRef?.current === false) {
        mouseParams.targetX = 100;
        mouseParams.targetY = 100;
      }

      // Smooth lerp for mouse coordinates to avoid jerky jumps
      // 버튼 호버 중이 아닐 때만 마우스 위치 업데이트
      if (!isButtonHoveredStar1 && !isButtonHoveredStar2) {
        // Skip sqrt: compare squared distance to 10² = 100 (same threshold, cheaper)
        const targetDistSq =
          mouseParams.targetX * mouseParams.targetX +
          mouseParams.targetY * mouseParams.targetY;
        const lerpSpeed = targetDistSq > 100 ? 0.05 : 0.1;

        mouseParams.currentX +=
          (mouseParams.targetX - mouseParams.currentX) * lerpSpeed;
        mouseParams.currentY +=
          (mouseParams.targetY - mouseParams.currentY) * lerpSpeed;
      } else {
        // 버튼 호버 중에는 마우스를 해당 별의 위치로 유지하여 holeActivation 활성화
        // star1 호버 중이면 star1 위치로, star2 호버 중이면 star2 위치로
        let targetMouseX = mouseParams.targetX;
        let targetMouseY = mouseParams.targetY;

        if (isButtonHoveredStar1) {
          targetMouseX = star1Points.position.x;
          targetMouseY = star1Points.position.y;
        }
        if (isButtonHoveredStar2) {
          targetMouseX = star2Points.position.x;
          targetMouseY = star2Points.position.y;
        }

        mouseParams.currentX += (targetMouseX - mouseParams.currentX) * 0.1;
        mouseParams.currentY += (targetMouseY - mouseParams.currentY) * 0.1;
      }

      // Update uniforms for both layers
      // 각 별의 마우스 좌표를 별의 로컬 좌표계로 변환 (별의 위치를 빼서 상대 좌표로)
      if (star1Mat) {
        // star1은 0.1초 늦게 시작 (타이밍 차이)
        star1Mat.uniforms.uTime.value = elapsedTime * starElapsedSpeed;
        // star1의 로컬 좌표계로 변환 (별의 위치를 빼서)
        star1Mat.uniforms.uMouse.value.set(
          mouseParams.currentX - star1Points.position.x,
          mouseParams.currentY - star1Points.position.y,
        );

        // Smooth lerp for uButtonHover transition (btn-go-works 호버 시 0→1, 마우스아웃 시 1→0)
        const currentButtonHover = star1Mat.uniforms.uButtonHover.value;
        star1Mat.uniforms.uButtonHover.value +=
          (targetButtonHoverStar1 - currentButtonHover) * 0.1; // 부드러운 트랜지션 속도

        // 별의 구멍 효과를 위한 uniform 전달 (별의 로컬 좌표계에서는 중심이 0,0)
        star1Mat.uniforms.uStar1Position.value.set(0, 0);
        star1Mat.uniforms.uStar2Position.value.set(0, 0);
        const currentButtonHoverStar1 =
          star1Mat.uniforms.uButtonHoverStar1.value;
        star1Mat.uniforms.uButtonHoverStar1.value +=
          (targetButtonHoverStar1 - currentButtonHoverStar1) * 0.1;
        star1Mat.uniforms.uButtonHoverStar2.value = 0.0; // star1에는 star2 호버 효과 없음
      }
      if (star2Mat) {
        // star2는 즉시 시작 (기본 타이밍)
        star2Mat.uniforms.uTime.value = elapsedTime * starElapsedSpeed;
        // star2의 로컬 좌표계로 변환 (별의 위치를 빼서)
        star2Mat.uniforms.uMouse.value.set(
          mouseParams.currentX - star2Points.position.x,
          mouseParams.currentY - star2Points.position.y,
        );

        // Smooth lerp for uButtonHover transition (btn-go-info 호버 시 0→1, 마우스아웃 시 1→0)
        const currentButtonHover = star2Mat.uniforms.uButtonHover.value;
        star2Mat.uniforms.uButtonHover.value +=
          (targetButtonHoverStar2 - currentButtonHover) * 0.1; // 부드러운 트랜지션 속도

        // 별의 구멍 효과를 위한 uniform 전달 (별의 로컬 좌표계에서는 중심이 0,0)
        star2Mat.uniforms.uStar1Position.value.set(0, 0);
        star2Mat.uniforms.uStar2Position.value.set(0, 0);
        star2Mat.uniforms.uButtonHoverStar1.value = 0.0; // star2에는 star1 호버 효과 없음
        const currentButtonHoverStar2 =
          star2Mat.uniforms.uButtonHoverStar2.value;
        star2Mat.uniforms.uButtonHoverStar2.value +=
          (targetButtonHoverStar2 - currentButtonHoverStar2) * 0.1;
      }
      if (nebulaMat) {
        nebulaMat.uniforms.uTime.value = elapsedTime * nebulaElapsedSpeed;

        // Star1과 Star2의 실제 위치를 nebula에 전달 (Points 객체에서 직접 읽어 항상 동기화)
        nebulaMat.uniforms.uStar1Position.value.set(
          star1Points.position.x,
          star1Points.position.y,
        );
        nebulaMat.uniforms.uStar2Position.value.set(
          star2Points.position.x,
          star2Points.position.y,
        );

        // 각 별의 버튼 호버 상태를 nebula에 전달 (부드러운 트랜지션)
        const currentButtonHoverStar1 =
          nebulaMat.uniforms.uButtonHoverStar1.value;
        nebulaMat.uniforms.uButtonHoverStar1.value +=
          (targetButtonHoverStar1 - currentButtonHoverStar1) * 0.1;

        const currentButtonHoverStar2 =
          nebulaMat.uniforms.uButtonHoverStar2.value;
        nebulaMat.uniforms.uButtonHoverStar2.value +=
          (targetButtonHoverStar2 - currentButtonHoverStar2) * 0.1;

        // Nebula holeRadius: star1은 원본, star2는 star2Scale 적용
        nebulaMat.uniforms.uHoleRadius.value =
          heroConfig.particles.nebula.material.holeRadius;
        nebulaMat.uniforms.uHoleRadiusStar2.value =
          heroConfig.particles.nebula.material.holeRadius * star2Scale;
      }

      // Animate bloom strength: 0.2와 0.3 사이를 왔다갔다 반짝거리는 효과
      if (bloomPass) {
        const minStrength = 0.15;
        const maxStrength = 0.22;
        // sin 함수를 사용해서 0.2와 0.3 사이를 부드럽게 오가도록
        const normalizedSin = (Math.sin(elapsedTime * 2.0) + 1) / 2; // 0 to 1
        bloomPass.strength =
          minStrength + (maxStrength - minStrength) * normalizedSin;
      }

      // Apply cursor-driven rotation via smooth lerp EXCLUSIVELY to the Stars (mesh)
      star1Points.rotation.x +=
        (targetRotationX - star1Points.rotation.x) * 0.1;
      star1Points.rotation.y +=
        (targetRotationY - star1Points.rotation.y) * 0.1;

      star2Points.rotation.x +=
        (targetRotationX - star2Points.rotation.x) * 0.1;
      star2Points.rotation.y +=
        (targetRotationY - star2Points.rotation.y) * 0.1;

      // Sync button positions to the projected 3D hole centres
      if (buttonWorksRef?.current) {
        const s1 = projectHoleToScreen(
          nebulaMat.uniforms.uStar1Position.value.x,
          nebulaMat.uniforms.uStar1Position.value.y,
        );
        buttonWorksRef.current.style.left = `${s1.x}px`;
        buttonWorksRef.current.style.top = `${s1.y}px`;
      }
      if (buttonInfoRef?.current) {
        const s2 = projectHoleToScreen(
          nebulaMat.uniforms.uStar2Position.value.x,
          nebulaMat.uniforms.uStar2Position.value.y,
        );
        buttonInfoRef.current.style.left = `${s2.x}px`;
        buttonInfoRef.current.style.top = `${s2.y}px`;
      }
    };

    const render = () => {
      composer.render();
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      update();
      render();
    };

    // 첫 프레임 렌더 후 컴파일 완료 → 로딩 100%
    composer.render();
    reportProgress(100);

    animate();

    // -------------------------------------------------------------
    // 8. TRANSITION TRIGGERS
    // -------------------------------------------------------------
    worksTransitionRef.current = (onComplete: () => void) => {
      isTransitioning = true;
      // Open the hole in star1 and lock mouse to star1 center
      targetButtonHoverStar1 = 1.0;
      isButtonHoveredStar1 = true;

      const star1Pos = heroConfig.particles.coreStar.starPosition.star1;
      const tl = gsap.timeline({
        onComplete: () => {
          isTransitioning = false;
          targetButtonHoverStar1 = 0.0;
          isButtonHoveredStar1 = false;
          onComplete();
        },
      });
      tl.to(
        camera.position,
        {
          x: star1Pos[0],
          y: star1Pos[1],
          z: 1.0,
          duration: 1.8,
          ease: "power4.in",
        },
        0,
      );
      tl.to(
        camera,
        {
          fov: 8,
          duration: 1.8,
          ease: "power4.in",
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        0,
      );
    };

    infoTransitionRef.current = (onComplete: () => void) => {
      isTransitioning = true;
      targetButtonHoverStar2 = 1.0;
      isButtonHoveredStar2 = true;

      const star2Pos = heroConfig.particles.coreStar.starPosition.star2;
      const tl = gsap.timeline({
        onComplete: () => {
          isTransitioning = false;
          targetButtonHoverStar2 = 0.0;
          isButtonHoveredStar2 = false;
          onComplete();
        },
      });
      tl.to(
        camera.position,
        {
          x: star2Pos[0],
          y: star2Pos[1],
          z: 1.0,
          duration: 1.8,
          ease: "power4.in",
        },
        0,
      );
      tl.to(
        camera,
        {
          fov: 8,
          duration: 1.8,
          ease: "power4.in",
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        0,
      );
    };

    heroTransitionRef.current = (onComplete: () => void) => {
      targetButtonHoverStar1 = 0.0;
      isButtonHoveredStar1 = false;
      targetButtonHoverStar2 = 0.0;
      isButtonHoveredStar2 = false;

      const tl = gsap.timeline({ onComplete });
      tl.to(
        camera.position,
        {
          x: heroConfig.camera.x,
          y: heroConfig.camera.y,
          z: heroConfig.camera.z,
          duration: 1.5,
          ease: "power3.out",
        },
        0,
      );
      tl.to(
        camera,
        {
          fov: heroConfig.camera.fov,
          duration: 1.5,
          ease: "power3.out",
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        0,
      );
    };

    // -------------------------------------------------------------
    // 9. RESIZE HANDLER
    // -------------------------------------------------------------
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;

      const isMobile = width <= 1000;
      let currentCameraX = -3.5;
      let currentCameraY = 0.0;
      let s1X = -6,
        s1Y = 1;
      let s2X = 7,
        s2Y = -4;

      if (isMobile) {
        // Center the camera on mobile
        currentCameraX = 0;
        currentCameraY = 0;
        // Arrange stars to be both visible horizontally but closer to center
        s1X = -2.5;
        s1Y = -4.5;
        s2X = 5.5;
        s2Y = -13.5;

        // Dynamic scaling based on width so sizes shrink nicely like on PC height-scaling
        const baseAspect = 0.75; // 3:4 aspect ratio base for mobile scaling
        if (camera.aspect < baseAspect) {
          heroConfig.camera.z = 22 * (baseAspect / camera.aspect);
        } else {
          heroConfig.camera.z = 22;
        }
      } else {
        currentCameraX = width < 1280 ? -7.0 : -3.5;
        currentCameraY = width < 1280 ? -2.0 : 0.0;
        heroConfig.camera.z = 22;
      }

      // We only apply camera X, Y here if we are NOT in a transition
      // (This avoids jumping if resize happens during transition)
      if (isHeroActiveRef?.current !== false && !isTransitioning) {
        camera.position.x = currentCameraX;
        camera.position.y = currentCameraY;
        camera.position.z = heroConfig.camera.z;
      }

      // Update heroConfig to ensure transitions land on the correct mobile/pc coordinates
      heroConfig.camera.x = currentCameraX;
      heroConfig.camera.y = currentCameraY;

      heroConfig.particles.coreStar.starPosition.star1[0] = s1X;
      heroConfig.particles.coreStar.starPosition.star1[1] = s1Y;
      heroConfig.particles.coreStar.starPosition.star2[0] = s2X;
      heroConfig.particles.coreStar.starPosition.star2[1] = s2Y;

      // Update mesh positions dynamically
      star1Points.position.set(s1X, s1Y, 0);
      star2Points.position.set(s2X, s2Y, 0);

      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      composer.setSize(width, height);
    };

    // Run once on load to initialize positioning
    handleResize();
    window.addEventListener("resize", handleResize);

    // 10. CLEANUP
    return () => {
      worksTransitionRef.current = null;
      infoTransitionRef.current = null;
      heroTransitionRef.current = null;
      assemblyRef.current = null;

      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);

      if (buttonCleanup) {
        buttonCleanup();
      }

      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      composer.dispose();

      scene.traverse((object) => {
        const obj = object as any;
        if (obj.isMesh || obj.isPoints) {
          if (obj.geometry) obj.geometry.dispose();

          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat: THREE.Material) => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });

      scene.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, containerRef, buttonWorksRef, buttonInfoRef, isHeroActiveRef]);

  const triggerWorksTransition = useCallback((onComplete: () => void) => {
    worksTransitionRef.current?.(onComplete);
  }, []);

  const triggerInfoTransition = useCallback((onComplete: () => void) => {
    infoTransitionRef.current?.(onComplete);
  }, []);

  const triggerHeroTransition = useCallback((onComplete: () => void) => {
    heroTransitionRef.current?.(onComplete);
  }, []);

  const triggerAssembly = useCallback(() => {
    assemblyRef.current?.();
  }, []);

  return {
    triggerWorksTransition,
    triggerInfoTransition,
    triggerHeroTransition,
    triggerAssembly,
  };
};
