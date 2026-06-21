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

1. **Follow-up pós-visita** — a cada 6h
2. **Verificar sem resposta** — a cada 6h:
   - Prestador sem responder 2h → envia 1 lembrete (`lembrete_enviado=true` evita duplicar)
   - Sem responder mais 2h após o lembrete (4h total) → status `SEM RESPOSTA PRESTADOR`, avisa admin
   - Sessões de anamnese abandonadas há 48h → deletadas
3. **Contratos expirados** — diário às 9h
4. **Limpeza de dados antigos** — semanal
5. **Lembrete diário aos prestadores** — 8h, lista todos os ORCs pendentes agrupados por prestador

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
