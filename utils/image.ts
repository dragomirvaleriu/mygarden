export const compressImage = (file: File, maxDim: number = 1024): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      
      // Dynamic compression loop to target < 100KB while preserving optimal quality
      let currentQuality = 0.85;
      const attemptBlob = () => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          if (blob.size > 100 * 1024 && currentQuality > 0.3) {
            currentQuality -= 0.15;
            attemptBlob();
          } else {
            console.log(`Compressed image size: ${(blob.size / 1024).toFixed(1)} KB (Quality: ${currentQuality.toFixed(2)})`);
            resolve(blob);
          }
        }, 'image/jpeg', currentQuality);
      };
      
      attemptBlob();
    };
    img.onerror = reject;
  });
};
