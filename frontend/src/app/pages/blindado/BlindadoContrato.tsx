import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { CheckCircle2, Download, ShieldCheck, Lock, FileText } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { OtpInput } from '../../components/blindado/OtpInput';
import { AnexosParte } from '../../components/blindado/AnexosParte';
import { CompraCreditos } from '../../components/blindado/CompraCreditos';
import { getSessaoBlindado, formatarValor, formatarData, API_URL } from './util';

export function BlindadoContrato() {
  const { token } = useParams();
  const sessao = getSessaoBlindado();

  const [contrato, setContrato] = useState<any>(null);
  const [partes, setPartes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Assinatura
  const [aceite, setAceite] = useState(false);
  const [docConfirmado, setDocConfirmado] = useState('');
  const [assinando, setAssinando] = useState(false);

  // Pagamento
  const [saldo, setSaldo] = useState<number | null>(null);
  const [usandoCredito, setUsandoCredito] = useState(false);
  const [mostrarCompra, setMostrarCompra] = useState(false);

  const criador = partes.find(p => p.papel === 'criador');
  const convidado = partes.find(p => p.papel === 'convidado');

  const souCriador = !!(sessao && contrato &&
    contrato.criador_tipo === sessao.tipo &&
    contrato.criador_id === sessao.usuario.id);

  // Minha parte nesta visita: criador logado → parte criador; senão → convidado
  const minhaParte = souCriador ? criador : convidado;
  const outraParte = souCriador ? convidado : criador;

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function carregar() {
    try {
      const d = await apiCall(`/api/blindado/token/${token}`);
      setContrato(d.contrato);
      setPartes(d.partes);
    } catch (e: any) {
      setErro(e.message || 'Contrato não encontrado.');
    }
    setCarregando(false);
  }

  useEffect(() => {
    if (souCriador && contrato && !contrato.pago) {
      apiCall(`/api/blindado/pagamentos/saldo?user_tipo=${sessao!.tipo}&user_id=${sessao!.usuario.id}`)
        .then(d => setSaldo(d.saldo))
        .catch(() => setSaldo(0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [souCriador, contrato?.pago]);

  async function usarCredito() {
    setUsandoCredito(true); setErro('');
    try {
      await apiCall(`/api/blindado/contratos/${contrato.id}/pagar-credito`, {
        method: 'POST',
        body: { criador_tipo: sessao!.tipo, criador_id: sessao!.usuario.id },
      });
      await carregar();
    } catch (e: any) {
      if (e.message && e.message.includes('créditos')) {
        setMostrarCompra(true);
      } else {
        setErro(e.message || 'Erro ao usar crédito.');
      }
    }
    setUsandoCredito(false);
  }

  async function assinar() {
    if (!minhaParte) return;
    if (!aceite) { setErro('Marque o aceite das cláusulas para assinar.'); return; }
    const docDigits = docConfirmado.replace(/\D/g, '');
    if (docDigits.length < 11) { setErro('Confirme seu CPF/CNPJ para assinar.'); return; }

    setAssinando(true); setErro('');

    let ip = 'desconhecido';
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      ip = (await r.json()).ip;
    } catch { /* segue sem IP externo */ }

    const geo: any = await new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      const timer = setTimeout(() => resolve(null), 5000);
      navigator.geolocation.getCurrentPosition(
        pos => {
          clearTimeout(timer);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        },
        () => { clearTimeout(timer); resolve(null); },
        { timeout: 5000 }
      );
    });

    try {
      await apiCall(`/api/blindado/token/${token}/assinar`, {
        method: 'POST',
        body: {
          parte_id: minhaParte.id,
          cpf_confirmado: docDigits,
          aceite: true,
          ip,
          user_agent: navigator.userAgent,
          geo,
        },
      });
      setAceite(false);
      setDocConfirmado('');
      await carregar();
    } catch (e: any) {
      setErro(e.message || 'Erro ao assinar.');
    }
    setAssinando(false);
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-[#1B2F6E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="max-w-lg mx-auto p-4 py-16 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h2 className="font-black text-[#1B2F6E] text-lg">Contrato não encontrado</h2>
        <p className="text-sm text-muted-foreground mt-1">Confira se o link está completo e correto.</p>
      </div>
    );
  }

  const concluido = contrato.status === 'assinado';
  const pdfUrl = `${API_URL}/api/blindado/token/${token}/pdf`;

  return (
    <div className="max-w-2xl mx-auto p-4 py-8 space-y-4">
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {erro}
        </div>
      )}

      {/* BANNER CONCLUÍDO */}
      {concluido && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
          <div className="font-black text-green-800 text-lg">Contrato assinado por ambas as partes!</div>
          <div className="text-xs text-green-700 mt-1 mb-4">
            Concluído em {formatarData(contrato.assinado_em)} — protegido por evidências digitais.
          </div>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B2F6E] text-white rounded-xl font-bold text-sm"
          >
            <Download className="h-4 w-4" /> Baixar PDF completo
          </a>
        </div>
      )}

      {/* DOCUMENTO */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="bg-[#0D1B3E] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-black">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</div>
            <div className="text-[10px] text-[#E8C547] uppercase tracking-wide">Contrato Blindado — {contrato.codigo}</div>
          </div>
          <FileText className="h-6 w-6 text-white/50" />
        </div>

        <div className="p-6 space-y-5">
          <Secao titulo="Partes">
            {[
              partes.find(p => p.papel_contratual === 'contratante'),
              partes.find(p => p.papel_contratual === 'prestador'),
            ].map(p => p && (
              <div key={p.id} className="flex justify-between items-start gap-3 py-1.5">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-semibold">{p.papel_contratual}</div>
                  <div className="text-sm font-semibold">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'}: {p.cpf_cnpj}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {p.telefone_validado && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">📱 WhatsApp validado</span>
                  )}
                  {p.assinado ? (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Assinou</span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Aguardando</span>
                  )}
                </div>
              </div>
            ))}
          </Secao>

          <Secao titulo="Objeto do contrato">
            <p className="text-sm whitespace-pre-wrap">{contrato.servico_desc}</p>
          </Secao>

          <Secao titulo="Condições financeiras">
            <ItemLinha k="Valor total" v={formatarValor(contrato.valor)} destaque />
            <ItemLinha k="Forma de pagamento" v={contrato.pagamento || 'A combinar'} />
            <ItemLinha k="Prazo de execução" v={contrato.prazo || 'A combinar'} />
            <ItemLinha k="Garantia" v={contrato.garantia || '--'} />
          </Secao>

          <Secao titulo="Cláusulas resumidas">
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>O prestador executa o serviço com qualidade e dentro do prazo; o contratante paga conforme acordado.</li>
              <li>Garantia de {contrato.garantia || 'prazo acordado'} após a conclusão.</li>
              <li>Desistência após assinatura: multa de 20% do valor, salvo acordo mútuo.</li>
              <li>A plataforma é apenas ferramenta de formalização — não é parte nem garantidora.</li>
              <li>Evidências digitais registradas com hash SHA-256 (Lei 14.063/2020).</li>
              <li>As partes declaram a veracidade dos dados e imagens fornecidos.</li>
              <li>Foro: comarca de domicílio do contratante.</li>
            </ul>
            <div className="text-[10px] text-muted-foreground mt-2">O texto integral das cláusulas consta no PDF do contrato.</div>
          </Secao>

          {contrato.hash_documento && (
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <div className="text-[10px] text-muted-foreground font-semibold mb-0.5">🔒 HASH SHA-256 (integridade do documento)</div>
              <div className="font-mono text-[10px] break-all text-muted-foreground">{contrato.hash_documento}</div>
            </div>
          )}
        </div>
      </div>

      {/* ANEXOS DA OUTRA PARTE (conferência mútua) */}
      {outraParte && (outraParte.selfie_url || outraParte.documento_url) && (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="font-black text-[#1B2F6E] text-sm mb-1">🔎 Confira quem está do outro lado</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Imagens anexadas por <b>{outraParte.nome}</b>. Verifique se conferem antes de assinar — a plataforma não faz validação documental.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {outraParte.selfie_url && (
              <div>
                <img src={outraParte.selfie_url} alt="Selfie" className="w-full rounded-xl border border-border max-h-48 object-contain bg-slate-50" />
                <div className="text-[10px] text-muted-foreground mt-1 text-center">Selfie</div>
              </div>
            )}
            {outraParte.documento_url && (
              <div>
                <img src={outraParte.documento_url} alt="Documento" className="w-full rounded-xl border border-border max-h-48 object-contain bg-slate-50" />
                <div className="text-[10px] text-muted-foreground mt-1 text-center">Documento</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLUXO DA MINHA PARTE (antes de concluído) */}
      {!concluido && minhaParte && !minhaParte.assinado && contrato.status === 'liberado' && (
        <>
          {/* 1. OTP */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="font-black text-[#1B2F6E] text-sm mb-3">
              1️⃣ Valide seu WhatsApp {minhaParte.telefone_validado ? '' : '(obrigatório para assinar)'}
            </h3>
            <OtpInput
              token={token!}
              parteId={minhaParte.id}
              telefoneInicial={minhaParte.telefone}
              validado={minhaParte.telefone_validado}
              onValidado={carregar}
            />
          </div>

          {/* 2. Anexos próprios */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="font-black text-[#1B2F6E] text-sm mb-3">2️⃣ Suas fotos (opcional)</h3>
            <AnexosParte
              token={token!}
              parteId={minhaParte.id}
              selfieUrl={minhaParte.selfie_url}
              documentoUrl={minhaParte.documento_url}
              onAtualizado={carregar}
            />
          </div>
        </>
      )}

      {/* BLOCO DE PAGAMENTO (só criador, quando não pago) */}
      {!concluido && souCriador && contrato.status === 'liberado' && !contrato.pago && (
        <div className="bg-[#0D1B3E] text-white rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5 text-[#E8C547]" />
            <h3 className="font-black">Liberar assinaturas</h3>
          </div>
          <p className="text-xs text-white/70 mb-4">
            As assinaturas ficam bloqueadas até o pagamento da Tarifa Contrato Blindado (1 crédito).
          </p>

          {mostrarCompra || saldo === 0 ? (
            <div className="bg-white rounded-xl p-4 text-slate-900">
              <div className="text-sm font-bold text-[#1B2F6E] mb-3">Compre um pacote de créditos:</div>
              <CompraCreditos
                userTipo={sessao!.tipo}
                userId={sessao!.usuario.id}
                onSucesso={usarCredito}
              />
            </div>
          ) : saldo === null ? (
            <div className="text-xs text-white/60">Consultando seu saldo...</div>
          ) : (
            <button
              onClick={usarCredito}
              disabled={usandoCredito}
              className="w-full py-3 bg-[#E8C547] text-[#0D1B3E] rounded-xl font-black disabled:opacity-40"
            >
              {usandoCredito ? 'Liberando...' : `Você tem ${saldo} crédito${saldo! > 1 ? 's' : ''} — Usar 1 crédito e liberar assinaturas`}
            </button>
          )}
        </div>
      )}

      {/* AVISO PAGAMENTO PENDENTE (para quem não é o criador) */}
      {!concluido && !souCriador && contrato.status === 'liberado' && !contrato.pago && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
          <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <b>Aguardando liberação do pagamento.</b> Quem criou o contrato precisa liberar as
            assinaturas. Enquanto isso, você já pode validar seu WhatsApp e anexar suas fotos acima.
          </div>
        </div>
      )}

      {/* ASSINATURA */}
      {!concluido && minhaParte && contrato.status === 'liberado' && (
        minhaParte.assinado ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-1" />
            <div className="font-bold text-green-800 text-sm">Você já assinou!</div>
            <div className="text-xs text-green-700">Aguardando a assinatura de {outraParte?.nome || 'a outra parte'}.</div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-[#1B2F6E] p-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-[#1B2F6E]" />
              <h3 className="font-black text-[#1B2F6E]">3️⃣ Assinar contrato</h3>
            </div>

            <label className="flex gap-2.5 items-start text-xs text-muted-foreground mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aceite}
                onChange={e => setAceite(e.target.checked)}
                className="mt-0.5"
                disabled={!contrato.pago}
              />
              <span>
                Li e aceito todas as cláusulas deste contrato. Estou ciente de que minha assinatura
                será registrada com IP, data/hora, localização e dispositivo, nos termos da Lei 14.063/2020.
              </span>
            </label>

            <input
              value={docConfirmado}
              onChange={e => setDocConfirmado(e.target.value)}
              placeholder={`Confirme seu ${minhaParte.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'} (só números)`}
              disabled={!contrato.pago}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-[#1B2F6E] disabled:bg-slate-50"
            />

            <button
              onClick={assinar}
              disabled={!contrato.pago || assinando || !minhaParte.telefone_validado}
              className="w-full py-4 bg-green-600 text-white rounded-xl font-black text-lg disabled:opacity-40"
            >
              {assinando ? 'Registrando assinatura...' : '✍️ ASSINAR'}
            </button>

            {!contrato.pago && (
              <div className="text-[11px] text-center text-muted-foreground mt-2">
                🔒 Aguardando liberação do pagamento
              </div>
            )}
            {contrato.pago && !minhaParte.telefone_validado && (
              <div className="text-[11px] text-center text-muted-foreground mt-2">
                Valide seu WhatsApp (passo 1) para poder assinar
              </div>
            )}
          </div>
        )
      )}

      {/* RASCUNHO */}
      {contrato.status === 'rascunho' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
          Este contrato ainda está em rascunho — o criador precisa concluir e liberar o link.
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-black text-[#1B2F6E] uppercase tracking-wide border-b border-border pb-1 mb-2">
        {titulo}
      </div>
      {children}
    </div>
  );
}

function ItemLinha({ k, v, destaque = false }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className={`text-sm text-right ${destaque ? 'font-bold text-green-700' : ''}`}>{v}</div>
    </div>
  );
}
