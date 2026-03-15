import { useEffect } from "react";
import * as THREE from "three";
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
      count: 4000,
      radius: 8.5,
      innerRadiusRatio: 0.5,
      points: 5,
      thickness: 4.5, // Increased from 1.0. This directly controls the maximum Z-axis spread (depth)
      jitter: 0.4, // Increased from 0.1. Adds random 3D scatter, making it look less like a solid shell
      rotationOffset: Math.PI / 2 + 0.3,

      material: {
        size: 75.0, // Smaller particles reveal the shape better than huge overlapping ones
        color: "#cffcff", // Pure white/blue core
        noiseStrength: 0.2, // Less undulating so it doesn't distort the star shape too much
        holeRadius: 8.0, // The exact coordinate size of the pushed hole
        repulsionForce: 0.5, // Reduced from 1.5 to 0.5 to make distance interaction weaker
      },
    },
    nebula: {
      count: 10000, // Medium density spread over a huge area
      radiusBase: 2.5, // Starts roughly outside the star
      radiusSpread: 20.0, // Extends far out
      thickness: 10.0, // Thick volumetric cloud (Increased from 4.0 to match the star's new depth)

      material: {
        size: 30.0,
        color: "#4e77ff", // Deep blue/purple cosmic cloud tone
        noiseStrength: 0.2, // Less wavey
        holeRadius: 9.0, // Pushes nebula out slightly wider than the core
        repulsionForce: 0.8, // Reduced from 2.5 to 0.8
      },
    },
  },
  postprocessing: {
    bloom: {
      enabled: true,
      strength: 0.3, // Let the core star shine like crazy
      radius: 0.7, // Spread the glow
      threshold: 0.1, // Catch most of the colored point particles
    },
  },
};

export const useHeroScene = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLElement | null>,
  buttonRef?: React.RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

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
      antialias: heroConfig.render.antialias,
    });
    renderer.setClearColor(
      heroConfig.render.clearColor,
      heroConfig.render.clearAlpha,
    );
    renderer.setPixelRatio(heroConfig.render.maxPixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);

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

    // -------------------------------------------------------------
    // 5. MOUSE INTERACTION SETUP (Raycaster & Drag Rotation)
    // -------------------------------------------------------------
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

    // Button hover state (드래그 비활성화를 위해 앞에 선언)
    let isButtonHovered = false;

    const MAX_ROTATION = THREE.MathUtils.degToRad(10); // limit to ~15 degrees max in either direction

    // Create an invisible plane at Z=0 to cast rays against to know exactly where the mouse is in 3D world space
    const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    const mouseVec2D = new THREE.Vector2(-9999, -9999); // Start offscreen
    
    const handleMouseMove = (event: MouseEvent) => {
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
      if (dragParams.isDragging && !isButtonHovered) {
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
      if (!isButtonHovered) {
        dragParams.isDragging = true;
        dragParams.previousX = event.clientX;
        dragParams.previousY = event.clientY;
        container.style.cursor = "grabbing";
      }
    };

    const handleMouseUp = () => {
      dragParams.isDragging = false;
      container.style.cursor = "default";

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

    // LAYER 1: Core Star Shape
    const starData = generateStarParticles({
      count: heroConfig.particles.coreStar.count,
      radius: heroConfig.particles.coreStar.radius,
      innerRadiusRatio: heroConfig.particles.coreStar.innerRadiusRatio,
      points: heroConfig.particles.coreStar.points,
      thickness: heroConfig.particles.coreStar.thickness,
      jitter: heroConfig.particles.coreStar.jitter,
      rotationOffset: heroConfig.particles.coreStar.rotationOffset,
    });

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starData.positions, 3),
    );
    starGeo.setAttribute(
      "randomScale",
      new THREE.BufferAttribute(starData.randoms, 1),
    );

    const starMat = createInteractiveParticleMaterial({
      size: heroConfig.particles.coreStar.material.size,
      color: heroConfig.particles.coreStar.material.color,
      noiseStrength: heroConfig.particles.coreStar.material.noiseStrength,
      holeRadius: heroConfig.particles.coreStar.material.holeRadius,
      repulsionForce: heroConfig.particles.coreStar.material.repulsionForce,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // Button hover effect: 버튼에 마우스오버하면 구멍 효과 발생
    let targetButtonHover = 0.0; // 초기값은 0 (구멍 없음)
    let targetNebulaHoleRadius = 0; // 초기값은 0 (구멍 없음)
    let buttonCleanup: (() => void) | null = null;
    
    if (buttonRef?.current) {
      const button = buttonRef.current;
      
      const handleButtonMouseEnter = () => {
        // 버튼 호버 시 구멍 효과 활성화 (uButtonHover를 1.0으로 트랜지션)
        isButtonHovered = true;
        targetButtonHover = 1.0;
        targetNebulaHoleRadius = heroConfig.particles.nebula.material.holeRadius; // Nebula holeRadius 활성화
        
        // 별의 rotation을 0으로 초기화
        dragParams.targetRotationX = 0;
        dragParams.targetRotationY = 0;
      };
      
      const handleButtonMouseLeave = () => {
        // 버튼에서 벗어나면 구멍 효과 비활성화 (uButtonHover를 0.0으로 트랜지션)
        isButtonHovered = false;
        targetButtonHover = 0.0;
        targetNebulaHoleRadius = 0; // Nebula holeRadius 비활성화
      };
      
      button.addEventListener("mouseenter", handleButtonMouseEnter);
      button.addEventListener("mouseleave", handleButtonMouseLeave);
      
      buttonCleanup = () => {
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
      repulsionForce: heroConfig.particles.nebula.material.repulsionForce,
      useVertexColors: true, // Enable the per-vertex color macro in the shader
    });

    const nebulaPoints = new THREE.Points(nebulaGeo, nebulaMat);
    scene.add(nebulaPoints);

    // -------------------------------------------------------------
    // 7. ANIMATION LOOP
    // -------------------------------------------------------------
    let animationFrameId: number;

    const update = () => {
      const elapsedTime = clock.getElapsedTime();

      // Smooth lerp for mouse coordinates to avoid jerky jumps
      // 버튼 호버 중이 아닐 때만 마우스 위치 업데이트
      if (!isButtonHovered) {
        // 마우스가 멀리 떨어져 있을 때는 더 느리게 전환 (부드러운 아웃 트랜지션)
        const targetDistance = Math.sqrt(
          mouseParams.targetX * mouseParams.targetX + 
          mouseParams.targetY * mouseParams.targetY
        );
        // 타겟이 멀리 있으면 더 느리게 전환 (마우스아웃 시 부드러운 트랜지션)
        const lerpSpeed = targetDistance > 10 ? 0.05 : 0.1;
        
        mouseParams.currentX +=
          (mouseParams.targetX - mouseParams.currentX) * lerpSpeed;
        mouseParams.currentY +=
          (mouseParams.targetY - mouseParams.currentY) * lerpSpeed;
      } else {
        // 버튼 호버 중에는 마우스를 중앙으로 유지하여 holeActivation 활성화
        mouseParams.currentX += (0 - mouseParams.currentX) * 0.1;
        mouseParams.currentY += (0 - mouseParams.currentY) * 0.1;
      }

      // Update uniforms for both layers
      if (starMat) {
        starMat.uniforms.uTime.value = elapsedTime;
        starMat.uniforms.uMouse.value.set(
          mouseParams.currentX,
          mouseParams.currentY,
        );
        
        // Smooth lerp for uButtonHover transition (버튼 호버 시 0→1, 마우스아웃 시 1→0)
        const currentButtonHover = starMat.uniforms.uButtonHover.value;
        starMat.uniforms.uButtonHover.value += 
          (targetButtonHover - currentButtonHover) * 0.1; // 부드러운 트랜지션 속도
      }
      if (nebulaMat) {
        nebulaMat.uniforms.uTime.value = elapsedTime;
        nebulaMat.uniforms.uMouse.value.set(
          mouseParams.currentX,
          mouseParams.currentY,
        );
        
        // Smooth lerp for uButtonHover transition (버튼 호버 시 0→1, 마우스아웃 시 1→0)
        const currentNebulaButtonHover = nebulaMat.uniforms.uButtonHover.value;
        nebulaMat.uniforms.uButtonHover.value += 
          (targetButtonHover - currentNebulaButtonHover) * 0.1; // 부드러운 트랜지션 속도
        
        // Smooth lerp for nebula holeRadius transition
        const currentNebulaHoleRadius = nebulaMat.uniforms.uHoleRadius.value;
        nebulaMat.uniforms.uHoleRadius.value += 
          (targetNebulaHoleRadius - currentNebulaHoleRadius) * 0.1; // 부드러운 트랜지션 속도
      }

      // Animate bloom strength: 0.2와 0.3 사이를 왔다갔다 반짝거리는 효과
      if (bloomPass) {
        const minStrength = 0.25;
        const maxStrength = 0.3;
        // sin 함수를 사용해서 0.2와 0.3 사이를 부드럽게 오가도록
        const normalizedSin = (Math.sin(elapsedTime * 2.0) + 1) / 2; // 0 to 1
        bloomPass.strength = minStrength + (maxStrength - minStrength) * normalizedSin;
      }

      // Apply drag rotation via smooth lerp EXCLUSIVELY to the Star (mesh) so the Nebula remains static
      starPoints.rotation.x +=
        (dragParams.targetRotationX - starPoints.rotation.x) * 0.1;
      starPoints.rotation.y +=
        (dragParams.targetRotationY - starPoints.rotation.y) * 0.1;
    };

    const render = () => {
      composer.render();
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      update();
      render();
    };

    animate();

    // -------------------------------------------------------------
    // 8. RESIZE HANDLER
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

    // 9. CLEANUP
    return () => {
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
  }, [canvasRef, containerRef, buttonRef]);
};
