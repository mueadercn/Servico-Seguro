// Logo do Contrato Blindado: escudo com chave central.
export function LogoBlindado({ size = 40, dark = false }: { size?: number; dark?: boolean }) {
  const escudo = dark ? '#1B2F6E' : '#FFFFFF';
  const borda = '#E8C547';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Escudo */}
      <path
        d="M32 4L54 12V28C54 43 45 54.5 32 60C19 54.5 10 43 10 28V12L32 4Z"
        fill={escudo}
        stroke={borda}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Chave: cabeça (anel) + haste + dentes */}
      <circle cx="32" cy="24" r="7" stroke={dark ? '#E8C547' : '#1B2F6E'} strokeWidth="4" fill="none" />
      <path
        d="M32 31V46M32 38H38M32 43H36"
        stroke={dark ? '#E8C547' : '#1B2F6E'}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
