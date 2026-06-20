import { Link } from 'react-router';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-slate-200 mb-4">404</div>
        <h1 className="text-3xl font-bold mb-4">Página não encontrada</h1>
        <p className="text-muted-foreground mb-8">
          Desculpe, a página que você está procurando não existe ou foi movida.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Home className="h-5 w-5" />
            Ir para o Início
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border rounded-lg hover:bg-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
