-- =====================================================
-- MIGRAÇÃO: Tags + 22 Categorias — Serviço Seguro
-- Rodar no Supabase SQL Editor (https://supabase.com/dashboard)
-- =====================================================

-- 1. Adicionar coluna tags na tabela servicos
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Criar tabela tags_sugeridas
CREATE TABLE IF NOT EXISTS tags_sugeridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid REFERENCES categorias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tags_sugeridas_cat ON tags_sugeridas(categoria_id) WHERE ativo = true;

-- 3. Inserir as 22 categorias (ignora se já existe por nome)
INSERT INTO categorias (nome, icone, ativa)
SELECT v.nome, v.icone, true
FROM (VALUES
  ('Construção e Reforma',    '🏗️'),
  ('Acabamentos',              '🧱'),
  ('Marcenaria e Móveis',     '🪵'),
  ('Serralheria',              '🔩'),
  ('Vidros e Esquadrias',     '🪟'),
  ('Instalações',              '⚡'),
  ('Segurança',                '🔐'),
  ('Tecnologia',               '💻'),
  ('Limpeza e Conservação',   '🧹'),
  ('Jardinagem e Paisagismo', '🌳'),
  ('Piscinas e Áreas Externas','🏊'),
  ('Fretes e Mudanças',       '🚚'),
  ('Serviços Automotivos',    '🚗'),
  ('Pets',                     '🐾'),
  ('Saúde e Bem-Estar',       '💪'),
  ('Educação',                 '📚'),
  ('Eventos e Experiências',  '🎉'),
  ('Locações',                 '🏠'),
  ('Serviços Empresariais',   '🏢'),
  ('Serviços Rurais',         '🚜'),
  ('Manutenção Predial',      '🏘️'),
  ('Outros Serviços',         '📋')
) AS v(nome, icone)
WHERE NOT EXISTS (SELECT 1 FROM categorias c WHERE c.nome = v.nome);

-- 4. Inserir tags sugeridas por categoria
-- (Apaga tags existentes da categoria antes de reinserir para evitar duplicatas)

-- Construção e Reforma
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Construção e Reforma' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'pedreiro','mestre de obras','servente','azulejista','gesseiro','pintor',
  'impermeabilizador','aplicador de textura','reforma residencial','reforma comercial',
  'reforma de cozinha','reforma de banheiro','ampliação','construção de casas',
  'construção de sobrados','construção de galpões','steel frame','wood frame',
  'construção container','construção modular','edícula'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Acabamentos
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Acabamentos' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'porcelanato','cerâmica','piso laminado','piso vinílico','piso industrial',
  'piso drenante','colocador de pisos','revestidor','polidor de pisos',
  'fachadas','pedras decorativas','revestimentos internos'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Marcenaria e Móveis
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Marcenaria e Móveis' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'marceneiro','montador de móveis','designer de interiores','cozinhas planejadas',
  'closets','dormitórios','home office','painéis','decks','pergolados','móveis planejados'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Serralheria
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Serralheria' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'serralheiro','soldador','portões','grades','corrimãos','mezaninos',
  'coberturas metálicas','galpões metálicos','estruturas metálicas'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Vidros e Esquadrias
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Vidros e Esquadrias' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'vidraceiro','esquadrista','box','espelhos','sacadas','fechamento de sacadas',
  'portas','janelas','fachadas de vidro'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Instalações
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Instalações' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'eletricista','encanador','técnico em climatização','instalador solar',
  'instalação elétrica','quadro elétrico','padrão de entrada','automação residencial',
  'encanamento','rede de esgoto','caixa d''água','bombas','central de gás',
  'instalação de gás','ar-condicionado','exaustores','ventilação',
  'energia solar','limpeza de placas','manutenção elétrica','hidráulica'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Segurança
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Segurança' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'técnico em segurança eletrônica','câmeras','CFTV','alarmes','cercas elétricas',
  'controle de acesso','portões eletrônicos','fechaduras digitais','monitoramento'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Tecnologia
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Tecnologia' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'técnico de informática','técnico de redes','especialista em automação',
  'cabeamento estruturado','redes wi-fi','redes corporativas','montagem de computadores',
  'manutenção de computadores','formatação','casa inteligente','automação comercial'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Limpeza e Conservação
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Limpeza e Conservação' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'faxineira','diarista','dedetizador','limpeza residencial','faxina pesada',
  'limpeza pós-obra','limpeza de sofás','limpeza de colchões','limpeza de tapetes',
  'limpeza de fachadas','limpeza de vidros','dedetização','descupinização','desratização'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Jardinagem e Paisagismo
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Jardinagem e Paisagismo' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'jardineiro','paisagista','corte de grama','podas','paisagismo','irrigação',
  'jardinagem de condomínios'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Piscinas e Áreas Externas
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Piscinas e Áreas Externas' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'construção de piscinas','limpeza de piscina','aquecimento de piscina',
  'manutenção de piscina','decks','pergolados','quiosques'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Fretes e Mudanças
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Fretes e Mudanças' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'transportador','montador de móveis','mudança residencial','mudança comercial',
  'carreto','frete','içamento'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Serviços Automotivos
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Serviços Automotivos' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'mecânico','eletricista automotivo','funileiro','revisão','suspensão','freios',
  'motor','bateria','alternador','som automotivo','polimento','higienização',
  'vitrificação','funilaria','pintura automotiva','recuperação'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Pets
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Pets' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'banho e tosa','veterinário domiciliar','adestramento','pet sitter',
  'hotel para pets','passeador de cães'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Saúde e Bem-Estar
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Saúde e Bem-Estar' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'personal trainer','nutricionista','fisioterapia domiciliar','massoterapia',
  'pilates domiciliar','cuidador de idosos'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Educação
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Educação' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'professor particular','tutor','instrutor','aulas particulares','reforço escolar',
  'inglês','espanhol','música','violão','piano','informática'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Eventos e Experiências
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Eventos e Experiências' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'fotógrafo','filmmaker','decorador','chef','cerimonialista',
  'casamentos','cerimonial','buffet','fotografia','filmagem',
  'decoração de festas','recreação infantil','DJ','banda',
  'congressos','convenções','feiras'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Locações
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Locações' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'cabanas','chalés','casas de temporada','salões de festa','andaimes','geradores',
  'ferramentas','tendas','mesas e cadeiras','sonorização'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Serviços Empresariais
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Serviços Empresariais' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'reformas corporativas','redes corporativas','segurança eletrônica',
  'automação comercial','consultoria operacional'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Serviços Rurais
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Serviços Rurais' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'terraplanagem','cercas','silos','açudes','irrigação rural',
  'galpões rurais','limpeza de terrenos'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Manutenção Predial
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Manutenção Predial' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'zeladoria','pintura predial','limpeza predial','impermeabilização',
  'fachadas','portões','interfones'
]) AS t(t)
ON CONFLICT DO NOTHING;

-- Outros Serviços
WITH cat AS (SELECT id FROM categorias WHERE nome = 'Outros Serviços' LIMIT 1)
INSERT INTO tags_sugeridas (categoria_id, nome) SELECT cat.id, t FROM cat, unnest(ARRAY[
  'serviço personalizado','sob consulta'
]) AS t(t)
ON CONFLICT DO NOTHING;


-- =====================================================
-- MIGRAÇÃO 2: Banner + Slug Personalizado — Prestadores
-- Rodar no Supabase SQL Editor
-- =====================================================

ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS bio_curta text;

-- Slug único (case-insensitive, só permite a-z0-9-)
CREATE UNIQUE INDEX IF NOT EXISTS idx_prestadores_slug ON prestadores (slug)
  WHERE slug IS NOT NULL;


-- =====================================================
-- MIGRAÇÃO 3: Evidências digitais no contrato
-- (geolocalização, user-agent e telefone das partes)
-- Rodar no Supabase SQL Editor
-- =====================================================

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS ua_cliente text;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS ua_prestador text;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS geo_cliente jsonb;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS geo_prestador jsonb;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS tel_cliente text;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS tel_prestador text;
