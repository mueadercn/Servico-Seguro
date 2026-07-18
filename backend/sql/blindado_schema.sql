-- ============================================================
-- CONTRATO BLINDADO — SCHEMA
-- Rodar manualmente no Supabase SQL Editor (uma única vez).
-- Depois: criar bucket PRIVADO "blindado-anexos" em Storage.
-- ============================================================

-- 1. Contratos
create table if not exists blindado_contratos (
  id              uuid primary key default gen_random_uuid(),
  codigo          text unique not null,            -- ex.: 'BLD-4F8A2C'
  token           text unique not null,            -- credencial de acesso por link
  criador_tipo    text not null check (criador_tipo in ('prestador','contratante')),
  criador_id      uuid not null,                   -- id em prestadores/usuarios
  status          text not null default 'rascunho'
                  check (status in ('rascunho','liberado','assinado','cancelado')),
  pago            boolean not null default false,  -- gate das assinaturas
  pago_em         timestamptz,
  servico_desc    text,
  valor           numeric(12,2),
  prazo           text,
  pagamento       text,                            -- texto livre
  garantia        text,
  dados_snapshot  jsonb,                           -- congelado na liberação
  hash_documento  text,                            -- SHA-256 do snapshot
  liberado_em     timestamptz,
  assinado_em     timestamptz,                     -- quando AMBOS assinaram
  criado_em       timestamptz not null default now()
);
create index if not exists idx_blindado_contratos_criador on blindado_contratos (criador_tipo, criador_id);
create index if not exists idx_blindado_contratos_token on blindado_contratos (token);

-- 2. Partes (sempre 2 linhas por contrato)
create table if not exists blindado_partes (
  id                   uuid primary key default gen_random_uuid(),
  contrato_id          uuid not null references blindado_contratos(id) on delete cascade,
  papel                text not null check (papel in ('criador','convidado')),
  papel_contratual     text not null check (papel_contratual in ('contratante','prestador')),
  tipo_pessoa          text not null default 'pf' check (tipo_pessoa in ('pf','pj')),
  nome                 text not null,
  cpf_cnpj             text not null,              -- só dígitos
  data_referencia      date,                       -- nascimento (PF) ou constituição (PJ)
  telefone             text,                       -- só dígitos, com DDI
  telefone_validado    boolean not null default false,
  telefone_validado_em timestamptz,
  selfie_path          text,                       -- path no bucket privado (não URL)
  documento_path       text,
  assinado             boolean not null default false,
  assinado_em          timestamptz,
  ip                   text,
  user_agent           text,
  geo_lat              double precision,
  geo_lng              double precision,
  geo_accuracy         double precision,
  geo_cidade           text,
  geo_uf               text,
  geo_pais             text,
  criado_em            timestamptz not null default now(),
  unique (contrato_id, papel)
);
create index if not exists idx_blindado_partes_contrato on blindado_partes (contrato_id);
create index if not exists idx_blindado_partes_doc on blindado_partes (cpf_cnpj, data_referencia);

-- 3. OTP de validação de telefone
create table if not exists blindado_otp (
  id           uuid primary key default gen_random_uuid(),
  parte_id     uuid not null references blindado_partes(id) on delete cascade,
  telefone     text not null,
  codigo_hash  text not null,                      -- sha256 do código; nunca texto puro
  expira_em    timestamptz not null,
  tentativas   int not null default 0,
  usado        boolean not null default false,
  criado_em    timestamptz not null default now()
);
create index if not exists idx_blindado_otp_parte on blindado_otp (parte_id, usado);

-- 4. Saldo de créditos
create table if not exists blindado_creditos (
  user_tipo     text not null check (user_tipo in ('prestador','contratante')),
  user_id       uuid not null,
  saldo         int not null default 0 check (saldo >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (user_tipo, user_id)
);

-- 5. Ledger de transações de crédito
create table if not exists blindado_credito_transacoes (
  id           uuid primary key default gen_random_uuid(),
  user_tipo    text not null,
  user_id      uuid not null,
  tipo         text not null check (tipo in ('compra','debito','ajuste')),
  quantidade   int not null,                       -- + compra, -1 débito
  contrato_id  uuid references blindado_contratos(id),
  pagamento_id uuid,
  criado_em    timestamptz not null default now()
);
create index if not exists idx_blindado_transacoes_user on blindado_credito_transacoes (user_tipo, user_id);

-- 6. Pagamentos Stripe
create table if not exists blindado_pagamentos (
  id                       uuid primary key default gen_random_uuid(),
  user_tipo                text not null,
  user_id                  uuid not null,
  stripe_payment_intent_id text unique not null,
  pacote_id                text not null,           -- 'p1','p3','p5','p10','p20','p50'
  quantidade               int not null,
  valor_centavos           int not null,
  status                   text not null default 'pendente'
                           check (status in ('pendente','pago','falhou','expirado')),
  criado_em                timestamptz not null default now(),
  pago_em                  timestamptz
);
create index if not exists idx_blindado_pagamentos_user on blindado_pagamentos (user_tipo, user_id);

-- 7. Funções atômicas de crédito (evitam race condition)
create or replace function blindado_debitar_credito(
  p_user_tipo text, p_user_id uuid, p_contrato_id uuid
) returns boolean language plpgsql security definer as $$
declare v_saldo int;
begin
  select saldo into v_saldo from blindado_creditos
   where user_tipo = p_user_tipo and user_id = p_user_id for update;
  if v_saldo is null or v_saldo < 1 then return false; end if;
  update blindado_creditos set saldo = saldo - 1, atualizado_em = now()
   where user_tipo = p_user_tipo and user_id = p_user_id;
  insert into blindado_credito_transacoes (user_tipo, user_id, tipo, quantidade, contrato_id)
  values (p_user_tipo, p_user_id, 'debito', -1, p_contrato_id);
  return true;
end $$;

create or replace function blindado_creditar(
  p_user_tipo text, p_user_id uuid, p_qtd int, p_pagamento_id uuid
) returns void language plpgsql security definer as $$
begin
  insert into blindado_creditos (user_tipo, user_id, saldo)
  values (p_user_tipo, p_user_id, p_qtd)
  on conflict (user_tipo, user_id)
  do update set saldo = blindado_creditos.saldo + p_qtd, atualizado_em = now();
  insert into blindado_credito_transacoes (user_tipo, user_id, tipo, quantidade, pagamento_id)
  values (p_user_tipo, p_user_id, 'compra', p_qtd, p_pagamento_id);
end $$;

-- 8. RLS: negar tudo para anon/authenticated.
--    O backend usa a SERVICE_KEY (bypassa RLS); o frontend nunca acessa
--    essas tabelas diretamente. Nenhuma policy criada de propósito.
alter table blindado_contratos enable row level security;
alter table blindado_partes enable row level security;
alter table blindado_otp enable row level security;
alter table blindado_creditos enable row level security;
alter table blindado_credito_transacoes enable row level security;
alter table blindado_pagamentos enable row level security;
