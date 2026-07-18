import { Link, Outlet } from 'react-router';
import { LogoBlindado } from '../../components/blindado/LogoBlindado';
import { getSessaoBlindado } from './util';

export function BlindadoLayout() {
  const sessao = getSessaoBlindado();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-[#0D1B3E] text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/blindado" className="flex items-center gap-2.5">
            <LogoBlindado size={36} />
            <div>
              <div className="font-black text-base leading-tight">Contrato Blindado</div>
              <div className="text-[10px] text-[#E8C547] tracking-wide uppercase">
                Evidências digitais para seus acordos
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/blindado/acesso"
              className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors hidden sm:block"
            >
              Acessar contrato
            </Link>
            {sessao ? (
              <Link
                to="/blindado/painel"
                className="px-4 py-2 bg-[#E8C547] text-[#0D1B3E] rounded-lg font-bold hover:bg-[#E8C547]/90 transition-colors"
              >
                Meu painel
              </Link>
            ) : (
              <Link
                to="/auth"
                className="px-4 py-2 bg-[#E8C547] text-[#0D1B3E] rounded-lg font-bold hover:bg-[#E8C547]/90 transition-colors"
              >
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[#0D1B3E] text-white/60 text-xs">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LogoBlindado size={20} />
            <span>Contrato Blindado — uma ferramenta <Link to="/" className="underline hover:text-white">Serviço Seguro</Link></span>
          </div>
          <div>Assinatura eletrônica nos termos da Lei 14.063/2020</div>
        </div>
      </footer>
    </div>
  );
}
