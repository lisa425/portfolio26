export interface SampleOptions {
  sampleStep: number;
  brightnessThreshold: number;
  centerHoleRadiusPx: number;
  imageScale: number;
}

export interface SampleResult {
  positions: Float32Array;
  particleCount: number;
  width: number;
  height: number;
}

export async function generateParticleTargets(
  imageSrc: string,
  options: SampleOptions,
): Promise<SampleResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const { width, height } = img;
      
      // 1. Create hidden canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return reject(new Error("Failed to get 2D context from canvas"));
      }

      // 2. Draw image & extract pixel data
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const tempPositions: number[] = [];
      const centerX = width / 2;
      const centerY = height / 2;

      // 3. Iterate over pixels using step
      for (let y = 0; y < height; y += options.sampleStep) {
        for (let x = 0; x < width; x += options.sampleStep) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];

          // Calculate perceived brightness or luminance
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          if (brightness >= options.brightnessThreshold) {
            // Check distance from center
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist >= options.centerHoleRadiusPx) {
              // Convert to scene coordinates
              // invert Y to match WebGL coordinate system
              const sceneX = dx * options.imageScale;
              const sceneY = -dy * options.imageScale;
              const sceneZ = 0; // future Z jitter could be added here

              tempPositions.push(sceneX, sceneY, sceneZ);
            }
          }
        }
      }

      // 4. Return formatted result
      const particleCount = tempPositions.length / 3;
      const positionsArray = new Float32Array(tempPositions);

      resolve({
        positions: positionsArray,
        particleCount,
        width,
        height
      });
    };

    img.onerror = (_err) => {
      reject(new Error("Failed to load source image for target generation."));
    };

    img.src = imageSrc;
  });
}
