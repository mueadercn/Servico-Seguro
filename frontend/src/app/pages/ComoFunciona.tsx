import { Link } from 'react-router';
import { ArrowLeft, Shield, FileText, Star, Smartphone, Zap, CheckCircle2, Users, Clock, ChevronRight } from 'lucide-react';
import { Logo } from '../components/Logo';

export function ComoFunciona() {
  return (
    <div className="min-h-screen bg-white">

      {/* HEADER */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Logo className="h-8" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-16">

        {/* HERO */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-success/10 text-success text-xs font-bold px-4 py-1.5 rounded-full mb-5 uppercase tracking-wider">
            🛡️ Serviço Seguro
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
            Serviços profissionais<br />do jeito que deveriam ser
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
            Conectamos quem precisa de serviço com quem faz — com confiança, contrato e sem dor de cabeça.
          </p>
        </div>

        {/* DOR DO CONTRATANTE */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">👤</div>
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Para quem contrata</div>
              <h2 className="text-2xl font-bold text-primary">Chega de incerteza</h2>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {[
              { dor: 'Contratar alguém desconhecido e torcer para dar certo', solucao: 'Todos os profissionais passam por verificação de identidade antes de aparecer na plataforma' },
              { dor: 'Combinar na hora e o profissional sumir depois', solucao: 'Tudo documentado na plataforma: conversa, orçamento e contrato com validade jurídica' },
              { dor: 'Pagar e o serviço ficar pela metade', solucao: 'Contrato com cláusulas de garantia e prazo — você tem respaldo legal se algo der errado' },
            ].map((item, i) => (
              <div key={i} className="grid md:grid-cols-2 gap-4">
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                  <p className="text-sm text-red-700">{item.dor}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-success mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sm text-green-700">{item.solucao}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-primary rounded-2xl p-6 text-white">
            <h3 className="font-bold text-lg mb-3">Como contratamos em 4 passos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { n: '1', t: 'Busca', d: 'Encontre o profissional por categoria ou nome' },
                { n: '2', t: 'Orçamento', d: 'Nosso sistema coleta as informações e qualifica o pedido automaticamente' },
                { n: '3', t: 'Agenda', d: 'Confirme o horário diretamente pelo WhatsApp' },
                { n: '4', t: 'Contrato', d: 'Assine digitalmente e tenha tudo documentado' },
              ].map(s => (
                <div key={s.n} className="text-center">
                  <div className="w-10 h-10 rounded-xl bg-success flex items-center justify-center font-bold text-lg mx-auto mb-2">{s.n}</div>
                  <div className="font-semibold text-sm mb-1">{s.t}</div>
                  <div className="text-white/60 text-xs leading-relaxed">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DIVISOR */}
        <div className="border-t border-slate-100 mb-20" />

        {/* DOR DO PRESTADOR */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-xl">👷</div>
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Para profissionais</div>
              <h2 className="text-2xl font-bold text-primary">Uma máquina de orçamentos qualificados</h2>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {[
              { dor: 'Perder tempo com clientes que somem depois do orçamento', solucao: 'O sistema filtra e qualifica o cliente antes de chegar até você — só chega quem está sério' },
              { dor: 'Fazer serviço sem garantia de receber o combinado', solucao: 'Contrato digital que protege você juridicamente em caso de calote ou disputa' },
              { dor: 'Não conseguir comprovar sua qualidade para novos clientes', solucao: 'Avaliações verificadas que constroem sua reputação e te destacam na plataforma' },
            ].map((item, i) => (
              <div key={i} className="grid md:grid-cols-2 gap-4">
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                  <p className="text-sm text-red-700">{item.dor}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-success mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sm text-green-700">{item.solucao}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-success rounded-2xl p-6 text-white">
            <h3 className="font-bold text-lg mb-4">O que você ganha na plataforma</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { ic: '⚙️', t: 'Atendimento Automatizado', d: 'Nunca perca um lead — o sistema atende no WhatsApp enquanto você trabalha' },
                { ic: '📋', t: 'Leads qualificados', d: 'Receba resumos prontos do que o cliente precisa, sem precisar perguntar tudo de novo' },
                { ic: '🛡️', t: 'Proteção jurídica', d: 'Contrato que te protege de clientes que querem fugir do combinado' },
              ].map(f => (
                <div key={f.t} className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl mb-2">{f.ic}</div>
                  <div className="font-semibold text-sm mb-1">{f.t}</div>
                  <div className="text-white/70 text-xs leading-relaxed">{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONTRATOS */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-primary mb-2">Contratos que valem de verdade</h2>
            <p className="text-muted-foreground text-sm">Lei 14.063/2020 — Assinatura eletrônica com validade jurídica</p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛡️</span>
                <span className="font-bold text-primary text-lg">Contrato Digital de Prestação de Serviços</span>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-success text-white">Validade jurídica plena</span>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Válido em qualquer instância judicial · Lei 14.063/2020</p>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">O que comprova a autenticidade</p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {[
                'Registro completo da conversa de negociação',
                'Número de telefone verificado das partes',
                'Endereço IP + geolocalização no momento da assinatura',
                'Timestamp imutável de cada ação',
                'Hash SHA-256 do documento (prova de integridade)',
                'CPF confirmado pelo signatário',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="text-center">
          <h2 className="text-2xl font-bold text-primary mb-3">Pronto para começar?</h2>
          <p className="text-muted-foreground mb-8 text-sm">Santa Maria RS · Profissionais verificados · Contratos digitais</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/"
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-7 py-3.5 rounded-xl font-bold hover:bg-primary/90 transition-colors">
              Buscar profissional <ChevronRight className="h-4 w-4" />
            </Link>
            <Link to="/auth?tipo=prestador"
              className="inline-flex items-center justify-center gap-2 border border-border text-foreground px-7 py-3.5 rounded-xl font-bold hover:bg-slate-50 transition-colors">
              Cadastrar como profissional
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
