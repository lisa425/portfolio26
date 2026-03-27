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

const heroConfig = {
  camera: {
    fov: 75,
    near: 0.1,
    far: 50, // Z depth
    z: 20, // Move camera back to see the volumetric shapes
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
        size: 50.0, // Smaller particles reveal the shape better than huge overlapping ones
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
      strength: 0.3, // Let the core star shine like crazy
      radius: 0.7, // Spread the glow
      threshold: 0.2, // Catch most of the colored point particles
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
    camera.position.z = heroConfig.camera.z;

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: heroConfig.render.alpha,
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

    const dragParams = {
      isDragging: false,
      previousX: 0,
      previousY: 0,
      targetRotationX: 0,
      targetRotationY: 0,
    };

    // Button hover state (각 별별로 독립적으로 관리)
    let isButtonHoveredStar1 = false;
    let isButtonHoveredStar2 = false;
    let isTransitioning = false;

    const MAX_ROTATION = THREE.MathUtils.degToRad(10); // limit to ~15 degrees max in either direction

    // Create an invisible plane at Z=0 to cast rays against to know exactly where the mouse is in 3D world space
    const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    const mouseVec2D = new THREE.Vector2(-9999, -9999); // Start offscreen

    const handleMouseMove = (event: MouseEvent) => {
      if (isHeroActiveRef?.current === false) return;

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
        // The shader expects coordinates in the same 3D world space scale
        mouseParams.targetX = intersectPoint.x;
        mouseParams.targetY = intersectPoint.y;
      }

      // 2. Drag Rotation Logic (버튼 호버 중에는 비활성화)
      if (
        dragParams.isDragging &&
        !isButtonHoveredStar1 &&
        !isButtonHoveredStar2
      ) {
        const deltaX = event.clientX - dragParams.previousX;
        const deltaY = event.clientY - dragParams.previousY;

        // Accumulate rotation target based on mouse movement speed
        dragParams.targetRotationY += deltaX * 0.005; // Pan horizontally changes Y rotation
        dragParams.targetRotationX += deltaY * 0.005; // Pan vertically changes X rotation

        // Clamp rotation to prevent spinning fully around
        dragParams.targetRotationX = THREE.MathUtils.clamp(
          dragParams.targetRotationX,
          -MAX_ROTATION,
          MAX_ROTATION,
        );
        dragParams.targetRotationY = THREE.MathUtils.clamp(
          dragParams.targetRotationY,
          -MAX_ROTATION,
          MAX_ROTATION,
        );

        dragParams.previousX = event.clientX;
        dragParams.previousY = event.clientY;
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      // 버튼 호버 중에는 드래그 비활성화
      if (!isButtonHoveredStar1 && !isButtonHoveredStar2) {
        dragParams.isDragging = true;
        dragParams.previousX = event.clientX;
        dragParams.previousY = event.clientY;
        container.style.cursor = "grabbing";
      }
    };

    const handleMouseUp = () => {
      dragParams.isDragging = false;
      container.style.cursor = "";

      // Optional: gracefully return to 0 rotation when mouse released
      // dragParams.targetRotationX = 0;
      // dragParams.targetRotationY = 0;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp); // Attach to window in case they drag outside container
    // On mouse leave, lerp mouse back towards infinity (or corner) so the hole closes
    const handleMouseLeave = () => {
      mouseParams.targetX = 100;
      mouseParams.targetY = 100;
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

    // Button hover effect: 버튼에 마우스오버하면 구멍 효과 발생
    let targetButtonHoverStar1 = 0.0; // star1용 (btn-go-works)
    let targetButtonHoverStar2 = 0.0; // star2용 (btn-go-info)
    let buttonCleanup: (() => void) | null = null;

    // btn-go-works: star1에만 효과
    if (buttonWorksRef?.current) {
      const button = buttonWorksRef.current;

      const handleButtonMouseEnter = () => {
        if (isTransitioning) return;
        isButtonHoveredStar1 = true;
        targetButtonHoverStar1 = 1.0; // star1만 활성화

        // 별의 rotation을 0으로 초기화
        dragParams.targetRotationX = 0;
        dragParams.targetRotationY = 0;
      };

      const handleButtonMouseLeave = () => {
        if (isTransitioning) return;
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
        isButtonHoveredStar2 = true;
        targetButtonHoverStar2 = 1.0; // star2만 활성화

        // 별의 rotation을 0으로 초기화
        dragParams.targetRotationX = 0;
        dragParams.targetRotationY = 0;
      };

      const handleButtonMouseLeave = () => {
        if (isTransitioning) return;
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

    const update = () => {
      const elapsedTime = clock.getElapsedTime();

      // hero가 아닐 때 마우스를 멀리 보내서 파티클 인터랙션 비활성화
      if (isHeroActiveRef?.current === false) {
        mouseParams.targetX = 100;
        mouseParams.targetY = 100;
      }

      // Smooth lerp for mouse coordinates to avoid jerky jumps
      // 버튼 호버 중이 아닐 때만 마우스 위치 업데이트
      if (!isButtonHoveredStar1 && !isButtonHoveredStar2) {
        // 마우스가 멀리 떨어져 있을 때는 더 느리게 전환 (부드러운 아웃 트랜지션)
        const targetDistance = Math.sqrt(
          mouseParams.targetX * mouseParams.targetX +
            mouseParams.targetY * mouseParams.targetY,
        );
        // 타겟이 멀리 있으면 더 느리게 전환 (마우스아웃 시 부드러운 트랜지션)
        const lerpSpeed = targetDistance > 10 ? 0.05 : 0.1;

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
        star1Mat.uniforms.uTime.value = elapsedTime;
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
        star2Mat.uniforms.uTime.value = elapsedTime;
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
        nebulaMat.uniforms.uTime.value = elapsedTime * 0.4;

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
        const minStrength = 0.2;
        const maxStrength = 0.25;
        // sin 함수를 사용해서 0.2와 0.3 사이를 부드럽게 오가도록
        const normalizedSin = (Math.sin(elapsedTime * 2.0) + 1) / 2; // 0 to 1
        bloomPass.strength =
          minStrength + (maxStrength - minStrength) * normalizedSin;
      }

      // Apply drag rotation via smooth lerp EXCLUSIVELY to the Stars (mesh) so the Nebula remains static
      star1Points.rotation.x +=
        (dragParams.targetRotationX - star1Points.rotation.x) * 0.1;
      star1Points.rotation.y +=
        (dragParams.targetRotationY - star1Points.rotation.y) * 0.1;

      star2Points.rotation.x +=
        (dragParams.targetRotationX - star2Points.rotation.x) * 0.1;
      star2Points.rotation.y +=
        (dragParams.targetRotationY - star2Points.rotation.y) * 0.1;

      // 홀의 중심 위치(셰이더 uStar1/2Position)를 화면 좌표로 프로젝션하여 버튼 위치 동기화
      const projectHoleToScreen = (holePos: THREE.Vector2) => {
        const pos3D = new THREE.Vector3(holePos.x, holePos.y, 0);
        pos3D.project(camera); // NDC (-1 ~ 1)
        return {
          x: (pos3D.x * 0.5 + 0.5) * container.clientWidth,
          y: (-pos3D.y * 0.5 + 0.5) * container.clientHeight,
        };
      };

      if (buttonWorksRef?.current) {
        const screen1 = projectHoleToScreen(
          nebulaMat.uniforms.uStar1Position.value,
        );
        buttonWorksRef.current.style.left = `${screen1.x}px`;
        buttonWorksRef.current.style.top = `${screen1.y}px`;
      }
      if (buttonInfoRef?.current) {
        const screen2 = projectHoleToScreen(
          nebulaMat.uniforms.uStar2Position.value,
        );
        buttonInfoRef.current.style.left = `${screen2.x}px`;
        buttonInfoRef.current.style.top = `${screen2.y}px`;
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
    // INTRO ANIMATION: 응축 → 폭발 → 안정
    // -------------------------------------------------------------
    const introTl = gsap.timeline({ delay: 0.5 });

    introTl
      .from([star1Points.scale, star2Points.scale], {
        x: 0,
        y: 0,
        z: 0,
        duration: 3.0,
        ease: "elastic.out(1, 100)",
        stagger: 0.1,
      })
      .from(
        star1Points.rotation,
        {
          z: THREE.MathUtils.degToRad(-200),
          duration: 3.5,
          ease: "elastic.out(1, 100)",
        },
        "<",
      )
      .from(
        star2Points.rotation,
        {
          z: THREE.MathUtils.degToRad(180),
          duration: 3.5,
          ease: "elastic.out(1, 100)",
        },
        "<",
      );

    // -------------------------------------------------------------
    // 8. TRANSITION TRIGGERS
    // -------------------------------------------------------------
    worksTransitionRef.current = (onComplete: () => void) => {
      isTransitioning = true;
      introTl.kill();
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
      introTl.kill();
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
          x: 0,
          y: 0,
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
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      composer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    // 10. CLEANUP
    return () => {
      worksTransitionRef.current = null;
      infoTransitionRef.current = null;
      heroTransitionRef.current = null;
      introTl.kill();

      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
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

  return {
    triggerWorksTransition,
    triggerInfoTransition,
    triggerHeroTransition,
  };
};
