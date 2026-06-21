# Bugs já resolvidos — não reintroduzir

> Ler este arquivo ao mexer em áreas que já tiveram esses problemas, para não
> reintroduzir o mesmo erro.

- `Record<string, string>` e outras anotações TypeScript em arquivos `.js` do backend quebram
  o build no Railway (Node puro não entende). Sempre usar JS puro em `backend/src/**/*.js`.
- Strings com quebra de linha literal dentro de template strings (`` `texto\ntexto` `` escrito
  com Enter de verdade em vez de `\n`) quebram o parser do Node — sempre usar `\n` escapado.
- Câmera da biometria travava por `video.play()` não ser chamado explicitamente após
  `srcObject = stream`. Corrigido com `setTimeout` + `.play().catch()`.
- Filtro de cidade em joins do Supabase (`.eq('prestadores.cidade', cidade)`) removia linhas
  com campo nulo — sempre filtrar cidade no JS depois de buscar, não na query do Supabase.
- Mensagem do WhatsApp enviando só os 8 primeiros caracteres do UUID do serviço
  (`servicoAberto.id.substring(0,8)`) — sempre usar o UUID completo.

## Numeração/formatação que já causou confusão

- Número da plataforma: `555591598658` — **12 dígitos**: 55 (DDI) + 55 (DDD) + 9159-8658 (8 dígitos
  locais, sem o 9 extra). Não confundir com `5555915986589` (13 dígitos, errado).
