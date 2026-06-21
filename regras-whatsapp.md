# Regras do WhatsApp (`routes/whatsapp.js`, `services/whatsapp.js`, `jobs/index.js`)

> Ler este arquivo só quando a tarefa envolver roteamento de mensagens, anamnese,
> disponibilidade/horários, múltiplos ORCs do prestador ou os cron jobs.

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

> Reestruturado em 21/06/2026: o ping-pong de horário por texto saiu de cena,
> follow-up agora gira em torno da atividade do **chat de negociação**
> (ver `docs/feature-chat-negociacao.md`).

1. **Follow-up pós-visita** — diário, 9h. Sem alteração: avisa cliente e prestador
   no dia seguinte a uma visita agendada (`status = VISITA AGENDADA`).
2. **Follow-up de chats** — a cada 4h. Por chat ainda não `finalizado`:
   - Chat criado e ninguém mandou a 1ª mensagem em `followup_chat_nunca_iniciado_horas`
     (padrão 6h) → avisa cliente e prestador, reforçando o link
   - Alguém mandou mensagem e a outra parte não respondeu em
     `followup_chat_sem_resposta_horas` (padrão 6h) → avisa só quem está devendo resposta
   - Em ambos os casos, no máximo 1 lembrete a cada `followup_chat_intervalo_lembrete_horas`
     (padrão 24h) por chat, controlado pela coluna `ultimo_lembrete_em`
3. **Follow-up de contratos** — diário, 14h:
   - Chat `finalizado` há mais de `followup_contrato_finalizado_tolerancia_horas`
     (padrão 2h) sem contrato gerado → alerta o **admin** via WhatsApp (não o cliente/prestador)
   - Contrato gerado há mais de `followup_assinatura_horas` (padrão 24h) com assinatura
     pendente → lembra **cliente e/ou prestador**, individualmente, conforme quem falta assinar
4. **Limpeza de sessões abandonadas** — a cada 6h: sessões de anamnese
   (`sessoes_whatsapp`) sem atividade há 48h são deletadas. (Antes vivia dentro do
   job de "sem resposta"; antes disso o job de limpeza semanal existia mas não fazia nada.)

Todos os limiares de tempo do follow-up são lidos da tabela `configuracoes`
(mesma tabela dos prompts de IA), com fallback pro valor padrão se a chave
não existir. Editável via `PUT /api/config/:chave`.

### ⚠️ Pendência conhecida
O job de **lembrete diário de prestadores** (lista numerada, "responda 1 - terça às 14h")
foi removido porque dependia de o prestador responder em texto livre interpretado
pela IA — isso não existe mais agora que a negociação acontece no chat com botões.
Se ainda for necessário um resumo diário do que está pendente, ele deveria ser
reconstruído como uma lista de **links de chat**, sem pedir resposta em texto.

---

## Tabelas Supabase usadas por este fluxo

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
