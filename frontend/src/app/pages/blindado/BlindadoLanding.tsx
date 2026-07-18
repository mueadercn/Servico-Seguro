import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { ShieldCheck, MessageCircle, Camera, MapPin, FileCheck2, Fingerprint, ArrowRight } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { LogoBlindado } from '../../components/blindado/LogoBlindado';
import { getSessaoBlindado, formatarCentavos } from './util';

export function BlindadoLanding() {
  const navigate = useNavigate();
  const sessao = getSessaoBlindado();
  const [pacotes, setPacotes] = useState<any[]>([]);

  useEffect(() => {
    apiCall('/api/blindado/pagamentos/pacotes')
      .then(d => setPacotes(d.pacotes || []))
      .catch(() => {});
  }, []);

  function criarContrato() {
    if (sessao) navigate('/blindado/novo');
    else navigate('/auth');
  }

  const evidencias = [
    { icon: MessageCircle, titulo: 'WhatsApp validado', desc: 'As duas partes confirmam o telefone com código de verificação.' },
    { icon: Camera, titulo: 'Selfie + documento', desc: 'Fotos anexadas pelas partes saem na página de evidências do PDF.' },
    { icon: MapPin, titulo: 'Geolocalização', desc: 'Cidade e coordenadas registradas no momento da assinatura.' },
    { icon: Fingerprint, titulo: 'IP e dispositivo', desc: 'Endereço IP e identificação do aparelho de cada assinante.' },
    { icon: FileCheck2, titulo: 'Hash SHA-256', desc: 'Impressão digital criptográfica que prova a integridade do documento.' },
    { icon: ShieldCheck, titulo: 'Lei 14.063/2020', desc: 'Assinatura eletrônica com validade jurídica em todo o Brasil.' },
  ];

  return (
    <div>
      {/* HERO */}
      <section className="bg-[#0D1B3E] text-white">
        <div className="max-w-5xl mx-auto px-4 pt-14 pb-16 text-center">
          <div className="flex justify-center mb-5">
            <LogoBlindado size={80} />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight">
            Formalize qualquer acordo.<br />
            <span className="text-[#E8C547]">Com prova de verdade.</span>
          </h1>
          <p className="mt-4 text-white/70 max-w-2xl mx-auto text-sm sm:text-base">
            Contratos entre duas pessoas quaisquer, assinados em minutos pelo celular —
            protegidos por validação de WhatsApp, geolocalização, fotos, IP e hash criptográfico.
            Só uma das partes precisa ter conta.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={criarContrato}
              className="px-8 py-4 bg-[#E8C547] text-[#0D1B3E] rounded-xl font-black text-lg hover:bg-[#E8C547]/90 transition-colors flex items-center justify-center gap-2"
            >
              Criar contrato <ArrowRight className="h-5 w-5" />
            </button>
            <Link
              to="/blindado/acesso"
              className="px-8 py-4 border border-white/30 rounded-xl font-bold hover:bg-white/10 transition-colors"
            >
              Já assinei um contrato
            </Link>
          </div>
          <div className="mt-6 text-xs text-white/50">
            A partir de <b className="text-[#E8C547]">R$ 4,90</b> por contrato — pague só quando for assinar.
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-black text-[#1B2F6E] text-center mb-10">Como funciona</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            ['1', 'Monte o contrato', 'Descreva o serviço, valor, prazo e forma de pagamento. Valide seu WhatsApp e anexe fotos se quiser. Tudo grátis.'],
            ['2', 'Envie o link', 'A outra parte recebe o link no WhatsApp, revisa tudo, valida o telefone dela e anexa os documentos dela. Sem precisar de conta.'],
            ['3', 'Paguem e assinem', 'Com 1 crédito você libera as assinaturas. Cada um assina com 1 clique e o PDF sai com todas as evidências.'],
          ].map(([n, titulo, desc]) => (
            <div key={n} className="bg-white rounded-2xl border border-border p-6">
              <div className="w-10 h-10 rounded-full bg-[#1B2F6E] text-[#E8C547] font-black flex items-center justify-center text-lg mb-4">
                {n}
              </div>
              <div className="font-bold text-[#1B2F6E] mb-1">{titulo}</div>
              <div className="text-sm text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* EVIDÊNCIAS */}
      <section className="bg-white border-y border-border">
        <div className="max-w-5xl mx-auto px-4 py-14">
          <h2 className="text-2xl font-black text-[#1B2F6E] text-center mb-2">
            Um verdadeiro cofre de evidências
          </h2>
          <p className="text-center text-muted-foreground text-sm mb-10 max-w-xl mx-auto">
            Cada contrato registra automaticamente um conjunto de provas digitais que fortalecem
            sua segurança jurídica.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {evidencias.map(({ icon: Icon, titulo, desc }) => (
              <div key={titulo} className="flex gap-3 p-4 rounded-xl bg-slate-50">
                <Icon className="h-6 w-6 text-[#1B2F6E] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-[#1B2F6E]">{titulo}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-black text-[#1B2F6E] text-center mb-2">Tarifa Contrato Blindado</h2>
        <p className="text-center text-muted-foreground text-sm mb-10">
          R$ 9,90 por contrato — e quanto maior o pacote, menor o preço por contrato.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {pacotes.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-border p-4 text-center">
              <div className="text-3xl font-black text-[#1B2F6E]">{p.qtd}</div>
              <div className="text-[11px] text-muted-foreground mb-2">
                contrato{p.qtd > 1 ? 's' : ''}
              </div>
              <div className="font-bold">{formatarCentavos(p.valor_centavos)}</div>
              <div className="text-[10px] text-muted-foreground">
                {formatarCentavos(Math.round(p.valor_centavos / p.qtd))}/un
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <button
            onClick={criarContrato}
            className="px-8 py-4 bg-[#1B2F6E] text-white rounded-xl font-black hover:bg-[#1B2F6E]/90 transition-colors"
          >
            Começar agora — é grátis até a assinatura
          </button>
        </div>
      </section>
    </div>
  );
}
