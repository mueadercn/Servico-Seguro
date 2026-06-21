# Feature planejada: Chat de negociação web (ainda NÃO implementada)

> Ler este arquivo só quando for de fato começar a construir essa feature.
> Status: **não iniciada**. É o próximo passo grande do projeto.

---

## Motivo da mudança de estratégia

O ping-pong de agendamento 100% via WhatsApp+IA estava gerando muitos pontos de falha
(interpretação ambígua, múltiplas idas e voltas, dependência pesada da Evolution API).
Decisão: **substituir o ping-pong de agendamento por um chat web dedicado**, mantendo a
anamnese inicial via WhatsApp (essa parte funciona bem e deve ser preservada — ver
`docs/regras-whatsapp.md`).

---

## Novo fluxo desenhado (a implementar)

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

---

## Decisões já tomadas sobre esse chat

- **Sem expiração de link** enquanto o ORC estiver ativo
- **Supabase Storage** para guardar áudio e foto (já estão no ecossistema)
- **Sem cadastro para conversar** — só na hora de fechar contrato é que pede
  dados completos (nome, CPF, endereço, email, senha)
- Qualquer parte pode mudar o status livremente (sem regra de permissão por papel)
- Sugestão (não confirmada): detector de valor mencionado no chat ("fica R$ 800")
  oferece preencher automaticamente o campo do formulário final

---

## Estrutura técnica sugerida (não criada ainda)

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
