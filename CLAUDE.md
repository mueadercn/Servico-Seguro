# Serviço Seguro — Contexto do Projeto

Marketplace de serviços locais com IA, WhatsApp, contratos digitais e biometria.
Cidade piloto: **Santa Maria, RS**.

---

## Infraestrutura

| Camada | Tecnologia | URL |
|---|---|---|
| Frontend | React + Vite + TailwindCSS | Netlify: https://classy-cucurucho-4e3455.netlify.app/ |
| Backend | Node.js + Express | Railway: https://servi-o-seguro-production.up.railway.app |
| WhatsApp | Evolution API v2.3.7 | Railway: https://evolution-api-production-5d17.up.railway.app |
| Banco | Supabase (Postgres) | https://mejzfpivpbdhcmfepfdh.supabase.co |

**Instância Evolution API:** `Servico-Seguro` (atenção ao S maiúsculo — usado exatamente assim na env var `EVOLUTION_INSTANCE`)
**Número WhatsApp da plataforma:** `555591598658` (+55 55 9159-8658)
**Painel Admin:** `/admin` — login `admin@admin.com` / senha `admin123`

### Variáveis de ambiente (Railway backend)
```
SUPABASE_URL=https://mejzfpivpbdhcmfepfdh.supabase.co
SUPABASE_SERVICE_KEY=[service_role]
SUPABASE_ANON_KEY=eyJ...
OPENAI_API_KEY=[chave válida, GPT-4o-mini]
EVOLUTION_API_URL=https://evolution-api-production-5d17.up.railway.app
EVOLUTION_API_KEY=servico-seguro-2026
EVOLUTION_INSTANCE=Servico-Seguro
WHATSAPP_NUMBER=555591598658
ADMIN_WHATSAPP=555591598658
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://classy-cucurucho-4e3455.netlify.app
```

### Webhook Evolution API (configurado via API, não pela UI)
```
POST https://evolution-api-production-5d17.up.railway.app/webhook/set/Servico-Seguro
Headers: apikey: servico-seguro-2026

Body:
{
  "webhook": {
    "url": "https://servi-o-seguro-production.up.railway.app/api/whatsapp/webhook",
    "enabled": true,
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": ["MESSAGES_UPSERT","MESSAGES_UPDATE","CONNECTION_UPDATE","SEND_MESSAGE","CONTACTS_UPDATE","CHATS_UPDATE"]
  }
}
```
⚠️ `webhook_by_events` DEVE ser `false` — se `true`, a Evolution muda a URL para `/webhook/MESSAGES_UPSERT` etc e quebra.

---

## Estrutura do projeto

### Backend (`backend/src/`)
- `index.js` — Express, monta todas as rotas
- `routes/whatsapp.js` — **arquivo mais crítico**. Webhook da Evolution API, todo o roteamento de mensagens (cliente vs prestador vs admin), anamnese, ping-pong, cancelamentos
- `routes/orcs.js` — CRUD de ORCs
- `routes/contratos.js` — geração, PDF (pdfkit), assinatura com hash SHA-256
- `routes/ia.js` — endpoints de chat/anamnese expostos via API
- `routes/auth.js` — login/cadastro prestador e contratante
- `routes/admin.js` — dashboard, biometria, categorias, comissões
- `services/whatsapp.js` — wrapper da Evolution API + todos os templates de mensagem
- `services/ia.js` — OpenAI GPT-4o-mini, 16 prompts por categoria (com fallback do Supabase, editável no Admin)
- `services/pdf.js` — geração de PDF do contrato
- `jobs/index.js` — 5 cron jobs automáticos (ver seção Jobs)

### Frontend (`frontend/src/app/pages/`)
- `Home.tsx` — minimalista: cidade + busca + categorias + serviços recentes + modal de serviço (WhatsApp/Chat)
- `Busca.tsx` — lista **serviços** (não prestadores) com filtros de qualidade
- `Auth.tsx` — login/cadastro prestador e contratante
- `ProviderDashboard.tsx` — portal do prestador, upload de foto de perfil
- `ClientDashboard.tsx` — portal do contratante
- `Orcamento.tsx` — chat web com IA (alternativa ao WhatsApp)
- `Contrato.tsx` — fluxo completo: cadastro → biometria (opcional) → dados do contrato → assinatura → concluído
- `Biometria.tsx` — captura de selfie + documento via câmera (corrigido bug de travamento)
- `Admin.tsx` — painel com Kanban de leads, prestadores, serviços, modais de cadastro manual
- `AdminPrompts.tsx` — editor visual dos 16 prompts de IA por categoria
- `ComoFunciona.tsx` — página institucional (dores → soluções)
- `routes.tsx` — todas as rotas

---

## REGRA DE OURO: ORC só é criado após anamnese concluída

Esse foi um ponto de correção importante na conversa anterior. Fluxo correto:

```
Cliente clica "Via WhatsApp" no site
        ↓
Mensagem com #SERVICO:uuid|#PRESTADOR:uuid|#CAT:categoria
        ↓
Backend cria SESSÃO TEMPORÁRIA (tabela sessoes_whatsapp) — NÃO cria ORC ainda
        ↓
IA conduz anamnese (uma pergunta por vez, nunca duas)
        ↓
IA responde literalmente "ANAMNESE_CONCLUIDA"
        ↓
Sistema gera resumo (IA) → CRIA o ORC completo → deleta a sessão
        ↓
Notifica prestador automaticamente (já sabe quem é, veio no #PRESTADOR do link)
        ↓
Ping-pong de horário começa
```

**Por quê:** evita poluir o banco com ORCs de gente que desistiu no meio da conversa.

---

## Identificação de quem está falando no WhatsApp (ordem de checagem)

A ordem importa e já causou bugs quando invertida:

```
1. Tem sessão de anamnese ativa? → trata como cliente em anamnese
2. Tem ORC ativo vinculado a esse telefone (como cliente)? → handleOrcAtivo
3. O telefone bate com algum prestador cadastrado? → handleOrcAtivo (lado prestador)
4. Mensagem tem #SERVICO:uuid? → inicia nova sessão
5. Nenhum dos acima → manda mensagem de orientação (1x a cada 24h, tabela mensagens_orientacao)
```

Filtros aplicados antes de tudo:
- Mensagens de grupos (`@g.us`) → ignoradas
- Broadcast/status → ignoradas
- Mensagens do próprio número da plataforma (`WHATSAPP_NUMBER`) → ignoradas (evita loop)
- `fromMe: true` → ignoradas

---

## Regras de disponibilidade (importante — já causou bug feio)

- **Cliente** informa apenas **dia da semana + turno** (manhã/tarde/noite). NUNCA horário específico.
  Se o cliente digitar "8:30", a IA deve corrigir e pedir o turno.
- **Prestador** informa **dia + horário exato** (ex: "segunda às 14h").
- Antes de repassar qualquer horário entre as partes, a IA **sempre pede confirmação explícita**
  ("Confirmo: Segunda às 14h para João? 1. Sim 2. Outro horário").
- **NUNCA inventar horários de exemplo nas mensagens automáticas** — isso já confundiu o usuário
  achando que eram dados reais (bug corrigido).

---

## Fluxo do prestador com múltiplos ORCs abertos

Se o prestador tem mais de 1 ORC pendente, qualquer mensagem ambígua dele dispara a lista:

```
👷 Olá, Emanuel! Você tem 2 pedidos aguardando:

1️⃣ ORC-2026-001 — Elétrica residencial
   👤 João Silva
   📅 Disponível: terça manhã

2️⃣ ORC-2026-002 — Reforma banheiro
   👤 Maria Costa
   📅 Disponível: quarta tarde

Responda com o número e horário. Ex: "1 - terça às 14h"
Sem disponibilidade? Responda "Cancelar 1" ou "Cancelar ORC-2026-001"
```

- Prestador pode responder por número (`"1 - terça às 14h"`) ou por código ORC
- Prestador pode cancelar via `"Cancelar 1"` ou `"Cancelar ORC-XXX"` — mas SÓ funciona se o ORC
  ainda não tiver sido respondido (status em `cancelaveis`)
- Job diário (8h, timezone America/Sao_Paulo) reenvia essa lista automaticamente
- Mensagens aleatórias/sem relação são **ignoradas silenciosamente** (a IA classifica intenção
  como "outro" ou certeza < 30% → não responde nada, evita spam)

Cliente tem fluxo simétrico: pode ver `mostrarOrcsCliente()` com todos os ORCs e cancelar os que
ainda estão "aguardando profissional" (não pode cancelar os já em "visita agendada" em diante —
ficam no histórico).

---

## Jobs automáticos (`jobs/index.js`)

1. **Follow-up pós-visita** — a cada 6h
2. **Verificar sem resposta** — a cada 6h:
   - Prestador sem responder 2h → envia 1 lembrete (`lembrete_enviado=true` evita duplicar)
   - Sem responder mais 2h após o lembrete (4h total) → status `SEM RESPOSTA PRESTADOR`, avisa admin
   - Sessões de anamnese abandonadas há 48h → deletadas
3. **Contratos expirados** — diário às 9h
4. **Limpeza de dados antigos** — semanal
5. **Lembrete diário aos prestadores** — 8h, lista todos os ORCs pendentes agrupados por prestador

---

## Tabelas Supabase criadas além do schema original

```sql
-- Sessão temporária de anamnese (antes do ORC existir)
CREATE TABLE sessoes_whatsapp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone text NOT NULL UNIQUE,
  servico_id uuid, prestador_id uuid, servico_nome text, categoria_nome text,
  historico jsonb DEFAULT '[]', nome_cliente text,
  criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now()
);

-- Anti-spam: 1 mensagem de orientação por número a cada 24h
CREATE TABLE mensagens_orientacao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone text NOT NULL UNIQUE,
  criado_em timestamptz DEFAULT now()
);

-- Colunas extras em orcs
ALTER TABLE orcs ADD COLUMN IF NOT EXISTS lembrete_enviado boolean DEFAULT false;
ALTER TABLE orcs ADD COLUMN IF NOT EXISTS servico_nome text;
```

RLS desativado em `sessoes_whatsapp` e `mensagens_orientacao` (backend acessa com service key).

Tabela `configuracoes` guarda os 16 prompts de IA editáveis: chaves no padrão
`system_prompt_geral`, `system_prompt_eletrica`, `system_prompt_encanamento`, etc.
Editável visualmente em `/admin` → Configurações (componente `AdminPrompts.tsx`).

---

## Contrato digital — dois tipos

| Tipo | Uso | Exige |
|---|---|---|
| Carta Aceite | Serviços até ~R$1.500 | 1 clique, válida em Juizados Especiais |
| Contrato Seguro | Maior proteção | CPF confirmado + biometria, válido em qualquer instância |

Base legal: Lei 14.063/2020 (assinatura eletrônica). Cada assinatura registra IP, timestamp e
hash SHA-256 do documento (imutabilidade).

**Fluxo de dados do cliente para o contrato:** cadastro completo (nome, CPF, endereço, email,
senha) só é pedido **na hora de gerar o contrato**, não antes — para não fricionar a anamnese.
Página `/contrato?orc=ID` detecta se o usuário está logado/tem CPF e pula etapas conforme o caso.
Biometria nessa etapa é **opcional** (botão "Pular por agora").

Dados do **prestador** são puxados automaticamente do cadastro já existente — nunca precisa
preencher de novo.

---

## EM ANDAMENTO — próxima feature a construir (não iniciada ainda)

### Motivo da mudança de estratégia
O ping-pong de agendamento 100% via WhatsApp+IA estava gerando muitos pontos de falha
(interpretação ambígua, múltiplas idas e voltas, dependência pesada da Evolution API).
Decisão: **substituir o ping-pong de agendamento por um chat web dedicado**, mantendo a
anamnese inicial via WhatsApp (essa parte funciona bem e deve ser preservada).

### Novo fluxo desenhado (a implementar)

```
1. Anamnese pelo WhatsApp (MANTÉM — já funciona)
        ↓
2. ORC criado → status ANAMNESE CONCLUÍDA
        ↓
3. Sistema gera link único do chat (token, não precisa expirar)
        ↓
4. WhatsApp envia o link pro cliente E pro prestador (mensagem simples, sem
   aguardar resposta interpretada por IA — só o link)
        ↓
5. Ambos entram em /chat/:token — SEM LOGIN, o link em si é o acesso
        ↓
6. Chat minimalista: texto, áudio, foto. Header mostra:
   "João Silva ↔ Emanuel Correa" + nome do serviço + ORC
   + aviso "🔒 Esta conversa fica registrada e pode ser usada no contrato"
        ↓
7. Botões de status — QUALQUER uma das partes pode mudar livremente:
   💬 Conversando → 📋 Aguardando orçamento → 💰 Orçamento enviado
        ↓
8. Botão "✅ Finalizar negociação" — precisa do clique de AMBAS as partes
   (trava de segurança, registra timestamp de cada confirmação)
        ↓
9. Quando os dois confirmam → painel lateral desliza com formulário mínimo:
   valor, prazo, garantia, forma de pagamento
        ↓
10. Gera contrato reaproveitando o fluxo já pronto de /contrato (cadastro
    completo do cliente se ainda não tiver, depois assinatura)
```

### Decisões já tomadas sobre esse chat
- **Sem expiração de link** enquanto o ORC estiver ativo
- **Supabase Storage** para guardar áudio e foto (já estão no ecossistema)
- **Sem cadastro para conversar** — só na hora de fechar contrato é que pede
  dados completos (nome, CPF, endereço, email, senha)
- Qualquer parte pode mudar o status livremente (sem regra de permissão por papel)
- Sugestão (não confirmada): detector de valor mencionado no chat ("fica R$ 800")
  oferece preencher automaticamente o campo do formulário final

### Estrutura técnica sugerida (não criada ainda)
```sql
CREATE TABLE chat_negociacao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orc_id uuid REFERENCES orcs(id),
  link_token text UNIQUE NOT NULL,
  status text DEFAULT 'conversando', -- conversando | aguardando_orcamento | orcamento_enviado | finalizado
  finalizado_cliente boolean DEFAULT false,
  finalizado_prestador boolean DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE chat_mensagens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id uuid REFERENCES chat_negociacao(id),
  remetente text, -- 'cliente' | 'prestador'
  tipo text, -- 'texto' | 'audio' | 'imagem'
  conteudo text, -- texto ou URL do Supabase Storage
  criado_em timestamptz DEFAULT now()
);
```

Página nova a criar: `frontend/src/app/pages/Chat.tsx`, rota `/chat/:token`.
Usar Supabase Realtime para mensagens aparecerem ao vivo (já no ecossistema, sem custo extra).

**Isso ainda não foi codificado** — é o próximo passo de implementação.

---

## Bugs já resolvidos (não reintroduzir)

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

---

## Pendências conhecidas (estado da última sessão)

- [ ] Implementar o chat de negociação (seção "EM ANDAMENTO" acima) — não iniciado
- [ ] Confirmar se telefones de prestadores de teste estão no formato completo
      (ex: Emanuel Correa estava cadastrado como `5597309687`, faltando dígitos)
- [ ] Avaliar se ainda vale manter o ping-pong de horário via WhatsApp como fallback
      para quem não quiser usar o chat, ou se será totalmente substituído
- [ ] Repassar imagem enviada pelo cliente durante a anamnese para o prestador
      (hoje só confirma recebimento e segue com a próxima pergunta da IA, mas
      a imagem em si não é encaminhada — precisaria de rota de forwarding)
