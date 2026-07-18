import { useState, useEffect, useRef } from 'react';
import { Camera, Upload } from 'lucide-react';

// Captura de foto via câmera ou upload, normalizada para JPEG (máx. 1600px).
// Extraído do padrão do Biometria.tsx. modo 'documento' = câmera traseira;
// modo 'selfie' = câmera frontal espelhada com guia oval.
export function CapturaFoto({
  modo,
  onCapture,
}: {
  modo: 'documento' | 'selfie';
  onCapture: (dataUrl: string) => void;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [erro, setErro] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selfie = modo === 'selfie';

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  function normalizar(fonte: HTMLVideoElement | HTMLImageElement, espelhar: boolean): string {
    const canvas = canvasRef.current!;
    const largura = fonte instanceof HTMLVideoElement ? fonte.videoWidth || 640 : fonte.naturalWidth;
    const altura = fonte instanceof HTMLVideoElement ? fonte.videoHeight || 480 : fonte.naturalHeight;
    const escala = Math.min(1, 1600 / Math.max(largura, altura));
    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (espelhar) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  async function abrirCamera() {
    setErro('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: selfie ? 'user' : 'environment',
          width: { ideal: selfie ? 640 : 1280 },
          height: { ideal: selfie ? 480 : 720 },
        },
      });
      setStream(s);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch {
      setErro(selfie
        ? 'Câmera frontal não disponível. Tente enviar uma foto da galeria.'
        : 'Câmera não disponível. Use a opção de galeria.');
    }
  }

  function capturar() {
    const video = videoRef.current;
    if (!video) return;
    const dataUrl = normalizar(video, selfie);
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    onCapture(dataUrl);
  }

  function carregarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => onCapture(normalizar(img, false));
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div>
      <canvas ref={canvasRef} className="hidden" />

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-3">
          {erro}
        </div>
      )}

      {stream ? (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-xl border border-border bg-black"
            style={{ maxHeight: '280px', ...(selfie ? { transform: 'scaleX(-1)' } : {}) }}
          />
          {selfie && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-28 h-36 rounded-full border-4 border-green-500 border-dashed opacity-80" />
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={capturar}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm"
            >
              📸 Capturar
            </button>
            <button
              onClick={() => { stream.getTracks().forEach(t => t.stop()); setStream(null); }}
              className="px-4 py-3 border border-border rounded-xl text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={abrirCamera}
            className="border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-[#1B2F6E] transition-colors"
          >
            <Camera className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm font-semibold">Câmera</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {selfie ? 'Tirar selfie' : 'Fotografar'}
            </div>
          </button>
          <label className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-[#1B2F6E] transition-colors">
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm font-semibold">Da galeria</div>
            <div className="text-xs text-muted-foreground mt-0.5">Escolher foto</div>
            <input type="file" accept="image/*" className="hidden" onChange={carregarArquivo} />
          </label>
        </div>
      )}
    </div>
  );
}
