export const checkUploadRateLimit = (accountType?: string, uploadCount: number = 1): { allowed: boolean; remaining: number; errorMsg?: string } => {
  if (accountType !== 'PF') {
    return { allowed: true, remaining: 999 }; // PJ/Business accounts are exempt
  }
  
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  // Retrieve timestamps of uploads in the last hour
  const stored = localStorage.getItem('pf_upload_timestamps');
  let timestamps: number[] = stored ? JSON.parse(stored) : [];
  
  // Filter out timestamps older than 1 hour
  timestamps = timestamps.filter(t => t > oneHourAgo);
  
  if (timestamps.length + uploadCount > 5) {
    const oldest = timestamps[0] || now;
    const minutesLeft = Math.ceil((oldest + 60 * 60 * 1000 - now) / (60 * 1000));
    return { 
      allowed: false, 
      remaining: Math.max(0, 5 - timestamps.length), 
      errorMsg: `Limită de încărcare depășită! Ca utilizator individual (PF), poți încărca maxim 5 imagini pe oră pentru a preveni abuzurile. Te rugăm să aștepți încă ${minutesLeft} minute.` 
    };
  }
  
  return { allowed: true, remaining: 5 - timestamps.length };
};

export const recordUploadAction = (accountType?: string, count: number = 1) => {
  if (accountType !== 'PF') return;
  const now = Date.now();
  const stored = localStorage.getItem('pf_upload_timestamps');
  let timestamps: number[] = stored ? JSON.parse(stored) : [];
  
  // Add new timestamps
  for (let i = 0; i < count; i++) {
    timestamps.push(now);
  }
  
  localStorage.setItem('pf_upload_timestamps', JSON.stringify(timestamps));
};
