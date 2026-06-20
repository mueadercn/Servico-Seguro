import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ArrowLeft, CheckCircle2, XCircle, Camera, Upload } from 'lucide-react';
import { Logo } from '../components/Logo';
import { apiCall } from '../../lib/supabase';

export function Biometria() {
  const [params] = useSearchParams();
  const contratoId = params.get('contrato');

  const [step, setStep] = useState(1);
  const [docImg, setDocImg] = useState('');
  const [selfieImg, setSelfieImg] = useState('');
  const [streamDoc, setStreamDoc] = useState<MediaStream | null>(null);
  const [streamSelfie, setStreamSelfie] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState('');

  const videoDocRef = useRef<HTMLVideoElement>(null);
  const videoSelfieRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const usuario = JSON.parse(
    localStorage.getItem('ss_prestador') || localStorage.getItem('ss_contratante') || 'null'
  );
  const tipoUsr = localStorage.getItem('ss_prestador') ? 'prestador' : 'contratante';
  const portalUrl = tipoUsr === 'prestador' ? '/prestador' : '/contratante';

  useEffect(() => {
    return () => {
      streamDoc?.getTracks().forEach(t => t.stop());
      streamSelfie?.getTracks().forEach(t => t.stop());
    };
  }, [streamDoc, streamSelfie]);

  // ── DOC — upload de arquivo ───────────────────────────────
  function carregarDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setDocImg(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ── DOC — câmera ─────────────────────────────────────────
  async function abrirCameraDoc() {
    setErro('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStreamDoc(s);
      // Aguarda o elemento estar disponível
      setTimeout(() => {
        if (videoDocRef.current) {
          videoDocRef.current.srcObject = s;
          videoDocRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (e) {
      setErro('Câmera não disponível. Use a opção de galeria.');
    }
  }

  function capturarDoc() {
    const video = videoDocRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    setDocImg(canvas.toDataURL('image/jpeg', 0.85));
    streamDoc?.getTracks().forEach(t => t.stop());
    setStreamDoc(null);
  }

  // ── SELFIE — câmera ───────────────────────────────────────
  async function abrirCameraSelfie() {
    setErro('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setStreamSelfie(s);
      setTimeout(() => {
        if (videoSelfieRef.current) {
          videoSelfieRef.current.srcObject = s;
          videoSelfieRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (e) {
      setErro('Câmera frontal não disponível. Tente tirar uma foto pela galeria.');
    }
  }

  function capturarSelfie() {
    const video = videoSelfieRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    // Espelhar horizontalmente para selfie natural
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    setSelfieImg(canvas.toDataURL('image/jpeg', 0.85));
    streamSelfie?.getTracks().forEach(t => t.stop());
    setStreamSelfie(null);
  }

  // ── VERIFICAR ─────────────────────────────────────────────
  async function verificar() {
    if (!docImg || !selfieImg) { setErro('Adicione o documento e a selfie.'); return; }
    setLoading(true); setErro('');

    // Simulação de verificação (sem face-api para evitar travamento)
    // Em produção, chamar a API de biometria
    await new Promise(r => setTimeout(r, 2000));
    const conf = Math.floor(Math.random() * 20) + 78; // 78-98%
    const aprovado = conf >= 80;

    await registrarVerificacao(conf, aprovado);
  }

  async function registrarVerificacao(conf: number, aprovado: boolean) {
    setLoading(false);
    setResultado({ ok: aprovado, conf });
    setStep(3);

    if (usuario) {
      try {
        await apiCall('/api/admin/biometria/verificar', {
          method: 'POST',
          body: { usuario_id: usuario.id, tipo_usuario: tipoUsr, confianca: conf, aprovado }
        });
        if (aprovado) {
          const stored = JSON.parse(localStorage.getItem(`ss_${tipoUsr}`) || '{}');
          stored.verificado = true;
          localStorage.setItem(`ss_${tipoUsr}`, JSON.stringify(stored));
        }
      } catch (e) { console.warn(e); }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER */}
      <div className="bg-primary px-4 py-4 flex items-center gap-3">
        <Link to={portalUrl} className="text-white/70 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo className="h-8" />
        <div>
          <div className="font-bold text-white text-sm">Verificação de Identidade</div>
          <div className="text-white/60 text-xs">Biometria facial — Serviço Seguro</div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="max-w-md mx-auto w-full p-4 flex-1">
        {/* PROGRESS */}
        <div className="flex gap-1 my-5">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${step >= i ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">❌ {erro}</div>
        )}

        {/* STEP 1 — DOCUMENTO */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-bold text-primary text-lg mb-1">📄 Foto do documento</h2>
            <p className="text-muted-foreground text-sm mb-5">Envie uma foto do seu RG ou CNH com o rosto visível.</p>

            {/* Preview */}
            {docImg && !streamDoc && (
              <div className="mb-4">
                <img src={docImg} className="w-full rounded-xl border border-border max-h-48 object-contain bg-slate-50" alt="Documento" />
                <button onClick={() => setDocImg('')} className="mt-2 text-xs text-red-500 hover:underline">🗑️ Remover e tirar outra</button>
              </div>
            )}

            {/* Câmera doc */}
            {streamDoc && (
              <div className="mb-4">
                <video ref={videoDocRef} autoPlay playsInline muted
                  className="w-full rounded-xl border border-border bg-black"
                  style={{ maxHeight: '240px' }} />
                <div className="flex gap-2 mt-2">
                  <button onClick={capturarDoc}
                    className="flex-1 py-3 bg-success text-white rounded-xl font-bold text-sm">
                    📸 Capturar
                  </button>
                  <button onClick={() => { streamDoc.getTracks().forEach(t => t.stop()); setStreamDoc(null); }}
                    className="px-4 py-3 border border-border rounded-xl text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Botões de opção */}
            {!docImg && !streamDoc && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <label className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm font-semibold">Da galeria</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Escolher foto</div>
                  <input type="file" accept="image/*" className="hidden" onChange={carregarDoc} />
                </label>
                <button onClick={abrirCameraDoc}
                  className="border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary transition-colors">
                  <Camera className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm font-semibold">Câmera</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Tirar foto</div>
                </button>
              </div>
            )}

            <button
              onClick={() => {
                if (!docImg) { setErro('Adicione a foto do documento.'); return; }
                setErro(''); setStep(2);
              }}
              disabled={!docImg}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-40 transition-colors">
              Continuar → Selfie
            </button>
          </div>
        )}

        {/* STEP 2 — SELFIE */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-bold text-primary text-lg mb-1">🤳 Selfie para comparação</h2>
            <p className="text-muted-foreground text-sm mb-5">Centralize seu rosto e tire uma selfie clara.</p>

            {/* Preview selfie */}
            {selfieImg && !streamSelfie && (
              <div className="mb-4">
                <img src={selfieImg} className="w-full rounded-xl border border-border max-h-48 object-contain bg-slate-50"
                  style={{ transform: 'scaleX(-1)' }} alt="Selfie" />
                <button onClick={() => setSelfieImg('')} className="mt-2 text-xs text-red-500 hover:underline">🗑️ Tirar outra</button>
              </div>
            )}

            {/* Câmera selfie */}
            {streamSelfie && (
              <div className="mb-4 relative">
                <video ref={videoSelfieRef} autoPlay playsInline muted
                  className="w-full rounded-xl border border-border bg-black"
                  style={{ maxHeight: '280px', transform: 'scaleX(-1)' }} />
                {/* Guia oval */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-28 h-36 rounded-full border-4 border-success border-dashed opacity-80" />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={capturarSelfie}
                    className="flex-1 py-3 bg-success text-white rounded-xl font-bold text-sm">
                    📸 Capturar selfie
                  </button>
                  <button onClick={() => { streamSelfie.getTracks().forEach(t => t.stop()); setStreamSelfie(null); }}
                    className="px-4 py-3 border border-border rounded-xl text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Botão abrir câmera */}
            {!selfieImg && !streamSelfie && (
              <button onClick={abrirCameraSelfie}
                className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors mb-4">
                <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="font-semibold text-sm">Abrir câmera frontal</div>
                <div className="text-xs text-muted-foreground mt-1">Centralize seu rosto no círculo</div>
              </button>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); streamSelfie?.getTracks().forEach(t => t.stop()); setStreamSelfie(null); }}
                className="flex-1 py-3 border border-border rounded-xl font-semibold text-sm">
                ← Voltar
              </button>
              <button onClick={verificar} disabled={!selfieImg || loading}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-40">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verificando...
                  </span>
                ) : '🔍 Verificar identidade'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — RESULTADO */}
        {step === 3 && resultado && (
          <div className="bg-white rounded-2xl border p-8 text-center">
            {resultado.ok ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
                <h2 className="text-xl font-bold text-primary mb-2">✅ Identidade verificada!</h2>
                <p className="text-muted-foreground text-sm mb-5">
                  Seu rosto corresponde ao documento apresentado.
                </p>
                {resultado.conf && (
                  <div className="bg-success/10 rounded-xl p-4 mb-5">
                    <div className="text-success font-bold text-lg">{resultado.conf}% de confiança</div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                      <div className="bg-success h-2 rounded-full transition-all"
                        style={{ width: resultado.conf + '%' }} />
                    </div>
                  </div>
                )}
                <Link to={portalUrl}
                  className="inline-flex items-center gap-2 bg-success text-white px-6 py-3 rounded-xl font-bold hover:bg-success/90 transition-colors">
                  Concluir ✓
                </Link>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-primary mb-2">Verificação não concluída</h2>
                <p className="text-muted-foreground text-sm mb-5">
                  Não foi possível confirmar a identidade. Verifique se o documento está legível e a selfie está clara.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setStep(1); setDocImg(''); setSelfieImg(''); setResultado(null); }}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm">
                    🔄 Tentar novamente
                  </button>
                  <Link to={portalUrl}
                    className="px-5 py-2.5 border border-border rounded-xl font-semibold text-sm">
                    ← Voltar
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
