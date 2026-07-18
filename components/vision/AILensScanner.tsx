import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, ScanLine, AlertTriangle, CheckCircle2, ChevronRight, BookOpen, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db, collection, addDoc } from '../../services/firebase';
import toast from 'react-hot-toast';
import { ARTICLES_RO, ArticleMeta } from '../../src/data/academyContent';
import { Page } from '../../src/types';
import { alertService } from '../../services/pf/alertService';

interface Props {
  organizationId: string;
  userId: string;
  userName: string;
  onNavigate?: (page: Page, state?: any) => void;
  asCard?: boolean;
}

interface VisionResponse {
  diagnostic: string;
  confidence: number;
  actiune_urgenta: string;
  articleSlug?: string;
  type?: 'disease' | 'pest' | 'healthy';
}

export const AILensScanner: React.FC<Props> = ({ organizationId, userId, userName, onNavigate, asCard = false }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Result
  const [result, setResult] = useState<VisionResponse | null>(null);
  const [recommendedArticle, setRecommendedArticle] = useState<ArticleMeta | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isRequestingValidation, setIsRequestingValidation] = useState(false);

  const handleRequestExpertValidation = async () => {
    if (!result) return;
    setIsRequestingValidation(true);
    try {
      await addDoc(collection(db, 'expertValidations'), {
        organizationId,
        userId,
        userName,
        diagnostic: result.diagnostic,
        confidence: result.confidence,
        imageUrl: previewUrl, // In a real app, this should be uploaded to Storage first
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      toast.success("Fotografia a fost trimisă către experți! Vei primi o notificare curând.");
      closeLens();
    } catch (err) {
      toast.error("Eroare la trimiterea solicitării.");
    }
    setIsRequestingValidation(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Nu am putut accesa camera. Te rog să încarci o poză din galerie.");
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPreviewUrl(dataUrl);
      stopCamera();
      triggerScan(dataUrl);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Read as a data URL so we have a persistent preview AND base64 bytes to send
      // to the server (a blob: URL is a local reference the backend can't fetch).
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPreviewUrl(dataUrl);
        stopCamera();
        triggerScan(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  // Split a data: URL into the base64 payload and its MIME type for the API call.
  const parseDataUrl = (dataUrl: string): { base64: string; mimeType: string } | null => {
    const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!match) return null;
    return { mimeType: match[1], base64: match[2] };
  };

  const triggerScan = async (imageDataUrl: string) => {
    setIsScanning(true);
    setResult(null);
    setRecommendedArticle(null);

    const parts = parseDataUrl(imageDataUrl);
    if (!parts) {
      setIsScanning(false);
      toast.error('Format de imagine neacceptat. Încearcă o poză JPG sau PNG.');
      return;
    }

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: parts.base64, mimeType: parts.mimeType }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || 'Diagnoza AI a eșuat.');
      }

      const diagnosis: VisionResponse = await res.json();
      setResult(diagnosis);
      setIsScanning(false);

      // Save to Journal
      try {
        await addDoc(collection(db, 'garden_journal'), {
          organizationId,
          userId,
          type: 'ai_diagnosis',
          date: new Date(),
          details: `Diagnoză AI: ${diagnosis.diagnostic}\nÎncredere: ${diagnosis.confidence}%\n\n${diagnosis.actiune_urgenta}`,
          photos: [imageDataUrl], // Note: storing base64 locally, for prod would be a storage URL
          services: [{ name: 'Diagnoză AI Lentilă' }],
          performedByName: userName || 'Sistem AI',
          createdAt: new Date(),
        });
      } catch (e) {
        console.error("Failed to save to journal", e);
      }

      // Find Article
      if (diagnosis.articleSlug) {
        const article = ARTICLES_RO.find(a => a.slug === diagnosis.articleSlug);
        if (article) {
          setRecommendedArticle(article);
        }
      }
    } catch (err: any) {
      console.error('Vision scan failed', err);
      setIsScanning(false);
      toast.error(err.message || 'Diagnoza AI a eșuat. Încearcă din nou.');
    }
  };

  const handleReportCommunity = () => {
    if (!result) return;
    setIsReporting(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          await alertService.reportAlert({
            diseaseType: result.diagnostic,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            anonymousId: userId
          });
          toast.success("Raportat cu succes comunității!");
        } catch (err) {
          toast.error("Eroare la raportare.");
        }
        setIsReporting(false);
      }, () => {
        toast.error("Trebuie să permiți accesul la locație pentru a raporta.");
        setIsReporting(false);
      });
    } else {
      toast.error("Geolocația nu este suportată de browser.");
      setIsReporting(false);
    }
  };

  const reset = () => {
    setPreviewUrl(null);
    setResult(null);
    setRecommendedArticle(null);
    startCamera();
  };

  const closeLens = () => {
    stopCamera();
    setIsOpen(false);
    setPreviewUrl(null);
    setResult(null);
    setRecommendedArticle(null);
  };

  useEffect(() => {
    if (isOpen && !previewUrl) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) {
    if (asCard) {
      return (
        <div 
          onClick={() => setIsOpen(true)}
          className="relative overflow-hidden cursor-pointer rounded-3xl bg-black/80 backdrop-blur-xl border border-white/10 p-6 flex items-start gap-4 hover:shadow-[0_0_30px_var(--accent-color)] transition-all duration-500 group"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-10 transition-opacity group-hover:opacity-20" style={{ background: 'linear-gradient(to bottom right, var(--accent-color), transparent)' }} />
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-500">
            <ScanLine size={24} className="text-accent-color animate-pulse drop-shadow-md" />
          </div>
          <div className="flex-1 min-w-0 z-10">
            <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
              Lentila AI <div className="w-1.5 h-1.5 rounded-full bg-accent-color animate-pulse" />
            </h3>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">S.O.S. Grădină</p>
            <p className="text-xs text-zinc-400 font-medium mt-2 leading-relaxed">
              Scanează o problemă. AI-ul diagnostichează instant.
            </p>
          </div>
        </div>
      );
    }

    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 md:bottom-6 md:right-24 z-50 flex items-center justify-center gap-2 px-6 h-14 bg-gradient-to-r from-accent-color to-accent-color text-white rounded-full shadow-xl shadow-accent-color/40 hover:scale-105 transition-all duration-300 group overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        <ScanLine size={22} className="relative z-10 group-hover:rotate-12 transition-transform" />
        <span className="relative z-10 font-black uppercase tracking-widest text-[11px] hidden md:block">
          Lentilă AI
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full h-full md:w-[450px] md:h-[800px] md:max-h-[95vh] md:rounded-[3rem] bg-zinc-950 overflow-hidden relative shadow-2xl border border-white/10 flex flex-col">
        
        {/* Header HUD */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-color animate-pulse"></div>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Landscape Lens</span>
          </div>
          <button onClick={closeLens} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition">
            <X size={20} />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {!previewUrl ? (
            <>
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                playsInline 
                muted
              />
              {/* Camera Frame Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 border-2 border-white/30 rounded-3xl">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent-color rounded-tl-3xl"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent-color rounded-tr-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent-color rounded-bl-3xl"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent-color rounded-br-3xl"></div>
                </div>
              </div>
            </>
          ) : (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          )}

          {/* Scanning Animation */}
          {isScanning && (
            <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="relative w-64 h-64 rounded-3xl overflow-hidden border border-accent-color/50">
                <img src={previewUrl!} className="w-full h-full object-cover opacity-50" />
                <div className="absolute top-0 left-0 w-full h-1 bg-accent-color shadow-[0_0_15px_5px_var(--accent-color)] animate-scan"></div>
                
                {/* Analyzing points */}
                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-accent-color rounded-full animate-ping delay-100"></div>
                <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-accent-color rounded-full animate-ping delay-300"></div>
                <div className="absolute bottom-1/3 left-1/2 w-2 h-2 bg-accent-color rounded-full animate-ping delay-500"></div>
              </div>
              <p className="mt-6 text-xs font-black text-accent-color uppercase tracking-[0.2em] animate-pulse">Analizăm structura foliară...</p>
            </div>
          )}
        </div>

        {/* Controls / Result Panel */}
        <div className="bg-zinc-900 border-t border-white/10 p-6 z-50">
          {!previewUrl ? (
            <div className="flex items-center justify-center gap-8">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
              >
                <Upload size={20} />
              </button>
              
              <button 
                onClick={handleCapture}
                className="w-20 h-20 rounded-full border-4 border-white/50 flex items-center justify-center hover:border-white transition"
              >
                <div className="w-16 h-16 rounded-full bg-white hover:scale-95 transition-transform"></div>
              </button>
              
              <div className="w-12 h-12"></div> {/* Spacer for balance */}
            </div>
          ) : result ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                  {result.type === 'disease' ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} className="text-accent-color" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight leading-tight">{result.diagnostic}</h3>
                  <p className="text-[10px] font-black text-accent-color uppercase tracking-widest mt-1">Precizie AI: {result.confidence}%</p>
                </div>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  {result.actiune_urgenta}
                </p>
              </div>

              {recommendedArticle && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Protocol Recomandat</p>
                  <button 
                    onClick={() => {
                      closeLens();
                      if (onNavigate) {
                        onNavigate(Page.Academy);
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-accent-color/20 to-black/50 border border-accent-color/30 hover:border-accent-color/60 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-color/20 text-accent-color flex items-center justify-center">
                        <BookOpen size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-white">{recommendedArticle.title}</p>
                        <p className="text-[10px] font-bold text-accent-color">Master Academy • {recommendedArticle.readTime} min</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-accent-color group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              {result.type === 'disease' && (
                <button 
                  onClick={handleReportCommunity}
                  disabled={isReporting}
                  className="w-full py-4 mt-2 rounded-2xl bg-red-600/20 text-red-500 text-[11px] font-black uppercase tracking-widest hover:bg-red-600/30 transition flex items-center justify-center gap-2"
                >
                  {isReporting ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                  Raportează Comunității
                </button>
              )}

              <button 
                onClick={handleRequestExpertValidation}
                disabled={isRequestingValidation}
                className="w-full py-4 mt-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition flex items-center justify-center gap-2"
              >
                {isRequestingValidation ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                Nu ești sigur? Cere Părerea unui Expert
              </button>

              <button 
                onClick={reset}
                className="w-full py-4 mt-2 rounded-2xl border border-white/20 text-white text-[11px] font-black uppercase tracking-widest hover:bg-white/5 transition"
              >
                Scanează altă plantă
              </button>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center">
              <Loader2 size={24} className="text-accent-color animate-spin" />
            </div>
          )}
        </div>
        
        {/* Hidden Canvas and Input */}
        <canvas ref={canvasRef} className="hidden" />
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileSelect} 
        />
      </div>
      
      {/* Required for Tailwind dynamic animation if not defined in CSS */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(256px); }
          100% { transform: translateY(0); }
        }
        .animate-scan {
          animation: scan 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
