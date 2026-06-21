# Chat de negociação — documentação do que existe hoje

> Status: **implementado e em produção**, montado em `/api/chat`
> (`backend/src/routes/chat.js`, registrado em `index.js`).
> Este arquivo documenta o comportamento real do código atual — não um plano.

---

## Como o chat nasce (gatilho real, em `routes/whatsapp.js`)

```
Anamnese via WhatsApp termina (IA responde "ANAMNESE_CONCLUIDA")
        ↓
ORC é criado com status "ANAMNESE CONCLUÍDA"
        ↓
criarChatParaOrc(orc.id) é chamado (função exportada por routes/chat.js,
importada direto em whatsapp.js)
        ↓
Token aleatório gerado: crypto.randomBytes(16).toString('hex')
        ↓
Linha criada em chat_negociacao vinculada ao orc_id
        ↓
Dois links são montados a partir do mesmo token, diferenciados por query param:
  {FRONTEND_URL}/chat/{token}?papel=cliente
  {FRONTEND_URL}/chat/{token}?papel=prestador
        ↓
Cliente recebe o link dele por WhatsApp logo após a confirmação do ORC
Prestador recebe o link dele junto com a notificação de novo pedido
```

Se `criarChatParaOrc` falhar, o erro é capturado e logado — o fluxo de WhatsApp
**não quebra** por causa disso, só não envia o link do chat.

---

## Endpoints existentes (`/api/chat/...`)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/:token` | Retorna o chat + dados do ORC + dados do prestador (join) |
| GET | `/:token/mensagens` | Lista mensagens do chat, ordenadas por `criado_em` |
| POST | `/:token/mensagens` | Insere mensagem (`remetente`, `tipo`, `conteudo` obrigatórios). Bloqueia se chat já `finalizado` |
| PATCH | `/:token/status` | Atualiza status livre entre `conversando` / `aguardando_orcamento` / `orcamento_enviado` (qualquer valor fora disso é rejeitado) |
| POST | `/:token/finalizar` | Confirma finalização por `papel` (`cliente` ou `prestador`). Quando AMBOS confirmam, status vira `finalizado` automaticamente |
| POST | `/:token/upload` | Recebe base64 + mimeType, salva no Supabase Storage (bucket `chat-arquivos`), retorna URL pública. Aceita áudio (`webm`/`ogg`) e imagem (default `jpg`) |
| POST | `/:token/contrato` | Gera o contrato a partir do chat (ver seção abaixo) |
| POST | `/:token/contrato/assinar` | Assina o contrato (ver seção abaixo) |

---

## Regra de finalização (trava de segurança)

- Cada lado confirma separadamente: `finalizado_cliente` e `finalizado_prestador` são booleans independentes
- O status só muda para `finalizado` no momento em que o **segundo** lado confirma
  (a rota checa o estado atual antes do update — não é um contador simples)
- Chat finalizado bloqueia novas mensagens (`POST /:token/mensagens` retorna erro 400)

---

## Geração de contrato pelo chat (`POST /:token/contrato`)

Isso é uma **segunda via de geração de contrato**, além do fluxo tradicional em
`routes/contratos.js` / página `/contrato`. Pontos importantes:

- Só funciona se o chat já estiver com `status = 'finalizado'` — senão retorna erro
  pedindo confirmação dupla antes
- Campos recebidos: `valor` e `tipo` são obrigatórios; `prazo`, `garantia`, `pagamento`
  têm default (`"A combinar"`, `"90 dias"`, `"A combinar"`)
- Evita duplicar: se já existe contrato pra aquele `orc_id`, retorna o existente
  (`existente: true`) em vez de criar outro
- Hash SHA-256 gerado a partir de `{ orc_id, valor, tipo, timestamp }` — **atenção:**
  esse hash é calculado sobre esses 4 campos, não sobre o documento PDF final
  (diferente de como `services/pdf.js` pode estar gerando hash no fluxo tradicional —
  vale comparar os dois se for usar o hash como prova de integridade em ambos os casos)
- Ao gerar, atualiza `orcs.status` para `'CONTRATO GERADO'`
- Registra evento em `custodia_log` com `acao: 'CONTRATO_GERADO'`, `agente: 'chat'`

## Assinatura pelo chat (`POST /:token/contrato/assinar`)

- Recebe `papel` (`cliente`/`prestador`) e `ip`
- Grava `assinado_cliente`/`assinado_prestador` + timestamp + IP de cada lado, separadamente
- Registra cada assinatura em `custodia_log` (`acao: ASSINATURA_CLIENTE` / `ASSINATURA_PRESTADOR`)
- Quando **ambos** os lados assinaram, `orcs.status` vira `'CONTRATO ASSINADO'`
- Retorna `ambosAssinaram: true/false` na resposta — o frontend usa isso pra saber
  se já pode mostrar tela de "contrato concluído"

---

## Tabelas Supabase usadas (já existem em produção)

```sql
chat_negociacao (id, orc_id, link_token, status, finalizado_cliente,
                  finalizado_prestador, criado_em)

chat_mensagens (id, chat_id, remetente, tipo, conteudo, criado_em)

-- usadas também pelo fluxo de contrato via chat:
contratos (..., orc_id, tipo, valor, prazo, pagamento, garantia, hash_documento,
           assinado_cliente, assinado_cliente_em, ip_cliente,
           assinado_prestador, assinado_prestador_em, ip_prestador, ...)

custodia_log (id, orc_id, acao, agente, ip, dados, ...)
```

Bucket de Storage: `chat-arquivos` (áudio e foto enviados pelo chat).

---

## O que ainda não foi confirmado/checado

- [ ] Se o frontend (`Chat.tsx`) já está implementado e usando todos esses endpoints,
      ou se algum existe só no backend ainda sem tela correspondente
- [ ] Se está usando Supabase Realtime pras mensagens aparecerem ao vivo (mencionado
      como plano original — não verificado no código do backend, que é só REST)
- [ ] Se o hash do contrato gerado pelo chat é compatível/consistente com o hash
      gerado pelo fluxo tradicional em `routes/contratos.js`
- [ ] Detector automático de valor mencionado no chat (ex: "fica R$ 800" preencher
      sozinho o formulário) — não há sinal disso no `chat.js`, então provavelmente
      não foi implementado ainda

