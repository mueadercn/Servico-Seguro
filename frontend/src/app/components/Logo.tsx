import { ImageWithFallback } from './figma/ImageWithFallback';
import logoImg from '../../imports/WhatsApp_Image_2026-05-24_at_20.09.06.jpeg';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "h-10", showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <ImageWithFallback
        src={logoImg}
        alt="Serviço Seguro"
        className={className}
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
