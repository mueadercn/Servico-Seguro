interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "h-10", showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo-escudo.png"
        alt="Serviço Seguro"
        className={className}
        style={{ width: 'auto', display: 'block' }}
      />
      {showText && (
        <span className="text-xl font-bold">
          <span className="text-primary">Serviço</span>
          <span className="text-success">Seguro</span>
        </span>
      )}
    </div>
  );
}
