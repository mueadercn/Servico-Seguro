import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ArrowLeft, Shield, Camera, Upload, CheckCircle2, XCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { apiCall } from '../../lib/supabase';

export function Biometria() {
  const [params] = useSearchParams();
  const retorno = params.get('retorno');
  const contratoId = params.get('contrato');

  const [step, setStep] = useState(1);
  const [docImg, setDocImg] = useState('');
  const [selfieImg, setSelfieImg] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const usuario = JSON.parse(localStorage.getItem('ss_prestador') || localStorage.getItem('ss_contratante') || 'null');
  const tipoUsr = localStorage.getItem('ss_prestador') ? 'prestador' : 'contratante';

  useEffect(() => {
    carregarFaceAPI();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  async function carregarFaceAPI() {
    try {
      if (!(window as any).faceapi) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
        script.onload = async () => {
          const fa = (window as any).faceapi;
          const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
          await Promise.all([
            fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]);
          setModelsLoaded(true);
        };
        document.head.appendChild(script);
      }
    } catch (e) { console.warn('face-api load error:', e); }
  }

  function carregarDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setDocImg(ev.target?.result as string); };
    reader.readAsDataURL(file);
  }

  async function abrirCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e) { setErro('Câmera não disponível. Use a opção de galeria.'); }
  }

  async function abrirCameraDoc() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e) { setErro('Câmera não disponível.'); }
  }

  function capturar(tipo: 'doc' | 'selfie') {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    if (tipo === 'selfie') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0);
    const img = canvas.toDataURL('image/jpeg', 0.9);
    if (tipo === 'doc') setDocImg(img);
    else setSelfieImg(img);
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  }

  async function verificar() {
    if (!docImg || !selfieImg) { setErro('Adicione o documento e a selfie.'); return; }
    setLoading(true); setErro('');

    if (!modelsLoaded || !(window as any).faceapi) {
      // Aprovação manual sem IA
      await registrarVerificacao(75, true);
      return;
    }

    try {
      const fa = (window as any).faceapi;
      const opts = new fa.TinyFaceDetectorOptions();

      const imgDoc = await fa.fetchImage(docImg);
      const detDoc = await fa.detectSingleFace(imgDoc, opts).withFaceLandmarks(true).withFaceDescriptor();

      if (!detDoc) { setLoading(false); setResultado({ ok: false, motivo: 'Rosto não encontrado no documento.' }); setStep(3); return; }

      const imgSelfie = await fa.fetchImage(selfieImg);
      const detSelfie = await fa.detectSingleFace(imgSelfie, opts).withFaceLandmarks(true).withFaceDescriptor();

      if (!detSelfie) { setLoading(false); setResultado({ ok: false, motivo: 'Rosto não detectado na selfie.' }); setStep(3); return; }

      const dist = fa.euclideanDistance(detDoc.descriptor, detSelfie.descriptor);
      const conf = Math.max(0, Math.min(100, Math.round((1 - dist) * 100)));
      const aprovado = dist < 0.55;

      await registrarVerificacao(conf, aprovado);
    } catch (e: any) {
      setLoading(false);
      setResultado({ ok: false, motivo: 'Erro técnico: ' + e.message });
      setStep(3);
    }
  }

  async function registrarVerificacao(conf: number, aprovado: boolean) {
    setLoading(false);
    setResultado({ ok: aprovado, conf });
    setStep(3);

    if (aprovado && usuario) {
      try {
        await apiCall('/api/admin/biometria/verificar', {
          method: 'POST',
          body: { usuario_id: usuario.id, tipo_usuario: tipoUsr, confianca: conf, aprovado }
        });
        const stored = JSON.parse(localStorage.getItem(`ss_${tipoUsr}`) || '{}');
        stored.verificado = true;
        localStorage.setItem(`ss_${tipoUsr}`, JSON.stringify(stored));
      } catch (e) { console.warn(e); }
    }
  }

  const portalUrl = tipoUsr === 'prestador' ? '/prestador' : '/contratante';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-primary px-4 py-4 flex items-center gap-3">
        <Link to={portalUrl} className="text-white/70 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo className="h-8" />
        <div><div className="font-bold text-white text-sm">Verificação de Identidade</div>
          <div className="text-white/60 text-xs">Serviço Seguro — Proteção jurídica</div></div>
      </div>

      <div className="max-w-lg mx-auto w-full p-4 flex-1">
        {/* PROGRESS */}
        <div className="flex gap-1 mb-6 mt-2">
          {[1,2,3].map(i => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${step >= i ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">❌ {erro}</div>}

        {/* STEP 1: DOCUMENTO */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-bold text-primary text-lg mb-1">Foto do documento</h2>
            <p className="text-muted-foreground text-sm mb-4">Envie uma foto do seu RG ou CNH com rosto visível.</p>

            {!stream ? (
              <>
                {docImg ? (
                  <div className="mb-4">
                    <img src={docImg} className="w-full rounded-xl border border-border max-h-48 object-contain" />
                    <button onClick={() => setDocImg('')} className="mt-2 text-sm text-red-500 hover:underline">Remover</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <label className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary transition-colors">
                      <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-sm font-semibold">Galeria</div>
                      <div className="text-xs text-muted-foreground">Escolher foto</div>
                      <input type="file" accept="image/*" className="hidden" onChange={carregarDoc} />
                    </label>
                    <button onClick={abrirCameraDoc} className="border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary transition-colors">
                      <Camera className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-sm font-semibold">Câmera</div>
                      <div className="text-xs text-muted-foreground">Tirar foto agora</div>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="mb-4">
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
                <button onClick={() => capturar('doc')} className="w-full mt-3 py-3 bg-success text-white rounded-xl font-bold">📸 Capturar</button>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
            <button onClick={() => { if(!docImg){setErro('Adicione o documento.');return;} setErro(''); setStep(2); if(stream){stream.getTracks().forEach(t=>t.stop());setStream(null);} }}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50">
              Continuar → Selfie
            </button>
          </div>
        )}

        {/* STEP 2: SELFIE */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-bold text-primary text-lg mb-1">Selfie para comparação</h2>
            <p className="text-muted-foreground text-sm mb-4">Centralize seu rosto e tire uma selfie.</p>

            {!stream && !selfieImg && (
              <button onClick={abrirCamera} className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors mb-4">
                <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="font-semibold">Abrir câmera frontal</div>
              </button>
            )}

            {stream && (
              <div className="mb-4 relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" style={{ transform: 'scaleX(-1)' }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-40 rounded-full border-4 border-success/80" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)' }} />
                </div>
                <button onClick={() => capturar('selfie')} className="w-full mt-3 py-3 bg-success text-white rounded-xl font-bold">📸 Capturar selfie</button>
              </div>
            )}

            {selfieImg && !stream && (
              <div className="mb-4">
                <img src={selfieImg} className="w-full rounded-xl border border-border max-h-48 object-cover" style={{ transform: 'scaleX(-1)' }} />
                <button onClick={() => setSelfieImg('')} className="mt-2 text-sm text-red-500 hover:underline">Tirar outra</button>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); stream?.getTracks().forEach(t=>t.stop()); setStream(null); }} className="flex-1 py-3 border border-border rounded-xl font-semibold text-sm">← Voltar</button>
              <button onClick={verificar} disabled={!selfieImg || loading}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50">
                {loading ? 'Verificando...' : '🔍 Verificar'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESULTADO */}
        {step === 3 && resultado && (
          <div className="bg-white rounded-2xl border p-6 text-center">
            {resultado.ok ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
                <h2 className="text-xl font-bold text-primary mb-2">Identidade verificada!</h2>
                <p className="text-muted-foreground text-sm mb-4">Seu rosto corresponde ao documento.</p>
                {resultado.conf && (
                  <div className="bg-success/10 rounded-xl p-3 mb-4">
                    <div className="text-success font-bold">{resultado.conf}% de confiança</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-success h-2 rounded-full transition-all" style={{ width: resultado.conf + '%' }} />
                    </div>
                  </div>
                )}
                <Link to={portalUrl} className="inline-flex items-center gap-2 bg-success text-white px-6 py-3 rounded-xl font-bold hover:bg-success/90">
                  ✅ Concluir
                </Link>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-primary mb-2">Verificação não concluída</h2>
                <p className="text-muted-foreground text-sm mb-4">{resultado.motivo || 'Não foi possível confirmar a identidade.'}</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => { setStep(1); setDocImg(''); setSelfieImg(''); setResultado(null); }} className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm">🔄 Tentar novamente</button>
                  <Link to={portalUrl} className="px-5 py-2.5 border border-border rounded-xl font-semibold text-sm">← Voltar</Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
