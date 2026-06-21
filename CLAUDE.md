# Serviço Seguro — Contexto do Projeto

Marketplace de serviços locais com IA, WhatsApp, contratos digitais e biometria.
Cidade piloto: **Santa Maria, RS**.

> 📁 Documentação detalhada por assunto está em `docs/`. Este arquivo só tem o
> que é necessário em qualquer tarefa. Quando for trabalhar em algo específico,
> peça para ler o doc relevante (veja a tabela no final deste arquivo).

---

## Infraestrutura

| Camada | Tecnologia | URL |
|---|---|---|
| Frontend | React + Vite + TailwindCSS | Netlify: https://classy-cucurucho-4e3455.netlify.app/ |
| Backend | Node.js + Express | Railway: https://servi-o-seguro-production.up.railway.app |
| WhatsApp | Evolution API v2.3.7 | Railway: https://evolution-api-production-5d17.up.railway.app |
| Banco | Supabase (Postgres) | https://mejzfpivpbdhcmfepfdh.supabase.co |

**Instância Evolution API:** `Servico-Seguro` (atenção ao S maiúsculo — usado exatamente assim na env var `EVOLUTION_INSTANCE`)
**Número WhatsApp da plataforma:** `555591598658` (+55 55 9159-8658) — **12 dígitos**: 55 (DDI) + 55 (DDD) + 9159-8658 (8 dígitos locais, sem o 9 extra). Não confundir com `5555915986589` (13 dígitos, errado).
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
- `jobs/index.js` — 5 cron jobs automáticos (ver `docs/regras-whatsapp.md`)

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

## Regra geral de código (backend)

`Record<string, string>` e outras anotações TypeScript **não funcionam** em arquivos `.js` do
backend — quebram o build no Railway (Node puro não entende). Sempre usar JS puro em
`backend/src/**/*.js`.

---

## Pendências conhecidas (estado da última sessão)

- [ ] Implementar o chat de negociação — ver `docs/feature-chat-negociacao.md` (não iniciado)
- [ ] Confirmar se telefones de prestadores de teste estão no formato completo
      (ex: Emanuel Correa estava cadastrado como `5597309687`, faltando dígitos)
- [ ] Avaliar se ainda vale manter o ping-pong de horário via WhatsApp como fallback
      para quem não quiser usar o chat, ou se será totalmente substituído
- [ ] Repassar imagem enviada pelo cliente durante a anamnese para o prestador
      (hoje só confirma recebimento e segue com a próxima pergunta da IA, mas
      a imagem em si não é encaminhada — precisaria de rota de forwarding)

---

## Documentação por assunto (ler sob demanda, não automaticamente)

| Arquivo | Quando ler |
|---|---|
| `docs/regras-whatsapp.md` | Tarefa envolve `routes/whatsapp.js`, `services/whatsapp.js`, identificação de remetente, disponibilidade/horários, múltiplos ORCs ou cron jobs |
| `docs/feature-chat-negociacao.md` | Se for implementar o chat web de negociação (próxima feature grande, ainda não começada) |
| `docs/bugs-resolvidos.md` | Se for mexer em áreas que já tiveram bug (câmera/biometria, filtro de cidade no Supabase, UUID truncado, template strings) — para não reintroduzir o erro |

Peça explicitamente: *"leia docs/X.md antes de começar"* quando a tarefa exigir.
