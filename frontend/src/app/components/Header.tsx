import { Link, useNavigate } from 'react-router';
import { Menu, User, LogOut } from 'lucide-react';
import { Logo } from './Logo';
import { getPrestador, getContratante, logout } from '../../lib/supabase';

export function Header() {
  const prestador = getPrestador();
  const contratante = getContratante();
  const user = prestador || contratante;
  const portalUrl = prestador ? '/prestador' : '/contratante';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/"><Logo className="h-9" /></Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link to="/#categorias" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Categorias</Link>
          <Link to="/#como" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Como funciona</Link>
          <Link to="/auth?tipo=prestador" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sou Profissional</Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to={portalUrl}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors">
                <User className="h-4 w-4" />
                {user.nome?.split(' ')[0]}
              </Link>
              <button onClick={logout}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/auth"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors">
                <User className="h-4 w-4" />Entrar
              </Link>
              <Link to="/auth?tipo=prestador"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">
                Cadastrar
              </Link>
            </>
          )}
          <button className="md:hidden p-2 hover:bg-accent rounded-lg">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
