export interface InstancedDataOptions {
  sampleStep: number;
  threshold: number;
}

export interface InstancedDataResult {
  offsets: Float32Array;
  indices: Float32Array;
  angles: Float32Array;
  numVisible: number;
  width: number;
  height: number;
}

export async function createInstancedParticleData(
  imageSrc: string,
  options: InstancedDataOptions,
): Promise<InstancedDataResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const { width, height } = img;

      const canvas = document.createElement("canvas");
      // Scale down image size according to sample step for efficiency
      const sampleWidth = Math.floor(width / options.sampleStep);
      const sampleHeight = Math.floor(height / options.sampleStep);
      
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return reject(new Error("Failed to get 2D context from canvas"));
      }

      ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);
      const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
      const data = imageData.data;

      const totalPixels = sampleWidth * sampleHeight;
      let numVisible = 0;

      // First pass: count visible based on threshold
      for (let i = 0; i < totalPixels; i++) {
        let isValid = data[i * 4 + 0] > options.threshold;

        if (isValid) {
          numVisible++;
        }
      }

      const offsets = new Float32Array(numVisible * 3);
      const indices = new Float32Array(numVisible);
      const angles = new Float32Array(numVisible);

      let j = 0;
      for (let i = 0; i < totalPixels; i++) {
        let isValid = data[i * 4 + 0] > options.threshold;

        if (!isValid) continue;

        offsets[j * 3 + 0] = i % sampleWidth;
        offsets[j * 3 + 1] = Math.floor(i / sampleWidth);
        offsets[j * 3 + 2] = 0;

        indices[j] = i;

        angles[j] = Math.random() * Math.PI;

        j++;
      }

      resolve({
        offsets,
        indices,
        angles,
        numVisible,
        width: sampleWidth,
        height: sampleHeight,
      });
    };

    img.onerror = (_err) => {
      reject(new Error("Failed to load source image for instancing."));
    };

    img.src = imageSrc;
  });
}
