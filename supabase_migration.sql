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


-- =====================================================
-- MIGRAÇÃO 4: Níveis do prestador (BRONZE / PRATA / OURO)
-- Sobe de nível conforme serviços concluídos (orcs com
-- status 'SERVIÇO CONCLUÍDO' = contratos assinados/finalizados).
-- Recalculado automaticamente por trigger. Rodar no SQL Editor.
-- =====================================================

ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS nivel text NOT NULL DEFAULT 'BRONZE';

-- Faixas (ajuste os limites aqui se quiser): OURO >= 30, PRATA >= 10, senão BRONZE
CREATE OR REPLACE FUNCTION calc_nivel_prestador(qtd bigint)
RETURNS text AS $$
BEGIN
  IF qtd >= 30 THEN RETURN 'OURO';
  ELSIF qtd >= 10 THEN RETURN 'PRATA';
  ELSE RETURN 'BRONZE';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Recalcula o nível do prestador afetado quando um orc muda
CREATE OR REPLACE FUNCTION atualizar_nivel_prestador()
RETURNS trigger AS $$
DECLARE
  pid uuid;
  qtd bigint;
BEGIN
  pid := COALESCE(NEW.prestador_id, OLD.prestador_id);
  IF pid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT count(*) INTO qtd
    FROM orcs
   WHERE prestador_id = pid AND status = 'SERVIÇO CONCLUÍDO';
  UPDATE prestadores SET nivel = calc_nivel_prestador(qtd) WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nivel_prestador ON orcs;
CREATE TRIGGER trg_nivel_prestador
AFTER INSERT OR UPDATE OF status OR DELETE ON orcs
FOR EACH ROW EXECUTE FUNCTION atualizar_nivel_prestador();

-- Backfill: calcula o nível atual de todos os prestadores
UPDATE prestadores p
SET nivel = calc_nivel_prestador((
  SELECT count(*) FROM orcs o
   WHERE o.prestador_id = p.id AND o.status = 'SERVIÇO CONCLUÍDO'
));


-- =====================================================
-- MIGRAÇÃO 5: Pré-popular prompts de IA por categoria
-- Os prompts ficam visíveis e editáveis em /admin/prompts.
-- O REGRAS_BASE é sempre adicionado pelo backend — aqui
-- ficam apenas as perguntas específicas de cada categoria.
-- ON CONFLICT DO NOTHING: não sobrescreve edições do admin.
-- =====================================================

INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES
('system_prompt_geral',
'Para facilitar a análise do profissional, informe, se possível:

🔧 Qual serviço você precisa?
📍 Onde o serviço será realizado? (bairro ou endereço aproximado)
📐 Consegue descrever melhor o que precisa ser feito?
⏰ É urgente ou tem prazo desejado?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos ou qualquer referência que ajude o profissional.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_eletrica',
'Para facilitar a análise do profissional, informe, se possível:

⚡ Qual serviço deseja realizar? (ex: instalação, reparo, tomada, disjuntor, iluminação)
🏠 O local é residência, apartamento, comércio ou empresa?
📍 Qual o bairro ou endereço aproximado?
⏰ É urgente? Há risco de curto ou sem energia em algum cômodo?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do local ou do quadro de energia.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_encanamento',
'Para facilitar a análise do profissional, informe, se possível:

🚿 Qual serviço deseja? (ex: vazamento, entupimento, instalação, troca de torneira/vaso)
🏠 O local é residência, apartamento, comércio ou empresa?
📍 Qual o bairro ou endereço aproximado?
💧 O vazamento está visível? Há dano em parede, teto ou piso?
⏰ É urgente? Há água acumulando ou risco de dano maior?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do local com problema.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_gesso',
'Para facilitar a análise do profissional, informe, se possível:

🪨 Qual serviço deseja? (ex: forro, sanca, drywall, moldura, reparo)
🏠 Em quais cômodos será o serviço?
📐 Tem ideia da área aproximada em m²?
🎨 Já tem referências ou modelo em mente?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do ambiente e referências do que deseja.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_pintura',
'Para facilitar a análise do profissional, informe, se possível:

🎨 O serviço é interno, externo ou ambos?
🏠 Quais cômodos ou áreas serão pintadas?
📐 Tem ideia da área aproximada em m²?
🖌️ Vai precisar de massa corrida, textura ou apenas tinta?
🎨 Já tem cor ou tinta escolhida, ou precisa de indicação?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do ambiente atual.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_construcao',
'Para facilitar a análise do profissional, informe, se possível:

🏗️ Qual serviço deseja? (ex: reforma, ampliação, demolição, alvenaria, fundação)
📐 Tem ideia da área envolvida em m²?
🧱 Os materiais serão fornecidos por você ou pelo profissional?
📋 Tem projeto, planta ou referências do que deseja?
📅 Qual o prazo desejado para início ou conclusão?
📍 Qual o bairro ou endereço aproximado?
📷 Se possível, envie fotos do local.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_acabamentos',
'Para facilitar a análise do profissional, informe, se possível:

🧱 Qual serviço deseja? (ex: revestimento, piso, rejunte, rodapé, textura, detalhes finais)
🏠 Em quais cômodos ou áreas?
📐 Tem ideia da área aproximada em m²?
🎨 Já tem o material escolhido ou precisa de indicação?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do ambiente e referências do acabamento desejado.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_marcenaria',
'Para facilitar a análise do profissional, informe, se possível:

🪵 Qual serviço deseja? (ex: móvel planejado, armário, bancada, reparo, marcenaria geral)
🏠 Em qual cômodo ou ambiente?
📐 Tem as medidas do espaço disponível?
🪵 Tem preferência de material? (MDF, madeira maciça, compensado...)
🎨 Tem referências de cor, estilo ou modelo em mente?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do espaço e referências do que deseja.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_serralheria',
'Para facilitar a análise do profissional, informe, se possível:

🔩 Qual serviço deseja? (ex: portão, grade, estrutura metálica, guarda-corpo, reparo)
🏠 O local é residência, comércio ou empresa?
📐 Tem as medidas ou dimensões aproximadas?
🔧 Tem preferência de material? (ferro, alumínio, aço inox...)
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do local e referências do que deseja.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_vidros',
'Para facilitar a análise do profissional, informe, se possível:

🪟 Qual serviço deseja? (ex: box, janela, porta de vidro, espelho, reparo, substituição)
🏠 O local é residência, apartamento, comércio ou empresa?
📐 Tem as medidas ou dimensões aproximadas?
🔧 O serviço é instalação nova ou substituição/reparo de algo existente?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do local e do que precisa ser feito.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_seguranca',
'Para facilitar a análise do profissional, informe, se possível:

🔐 Qual serviço deseja? (ex: câmeras, alarme, controle de acesso, cerca elétrica, interfone)
🏠 O local é residência, apartamento, comércio ou empresa?
📍 Qual o bairro ou endereço aproximado?
📐 Quantos pontos ou câmeras aproximadamente você precisa?
⏰ É urgente?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do local onde será instalado.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_tecnologia',
'Para facilitar a análise do profissional, informe, se possível:

💻 Qual serviço deseja? (ex: rede, suporte, formatação, instalação, automação, câmeras IP)
🖥️ Qual equipamento ou sistema está envolvido?
🏠 O local é residência, apartamento, comércio ou empresa?
⏰ É urgente? O equipamento está sem funcionar?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos ou print do problema.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_limpeza',
'Para facilitar a análise do profissional, informe, se possível:

🧹 Qual serviço deseja? (ex: limpeza residencial, pós-obra, vidros, dedetização, fossa)
🏠 O local é residência, apartamento, comércio ou empresa?
📐 Qual o tamanho aproximado do espaço em m²?
🔄 A limpeza será única ou recorrente? (se recorrente, qual a frequência desejada?)
🐾 Tem animais de estimação no local?
🧴 Prefere que o profissional leve os produtos ou você fornecerá?
📅 Quais dias e horários você tem disponibilidade?
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_jardinagem',
'Para facilitar a análise do profissional, informe, se possível:

🌳 Qual serviço deseja? (ex: poda, paisagismo, manutenção, plantio, irrigação, gramado)
🏠 O local é residência, comércio ou empresa?
📐 Qual o tamanho aproximado da área em m²?
🔄 O serviço será único ou recorrente? (se recorrente, qual a frequência?)
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do jardim ou área.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_piscinas',
'Para facilitar a análise do profissional, informe, se possível:

🏊 Qual serviço deseja? (ex: limpeza, manutenção, reforma, construção, deck, área gourmet)
📐 Qual o tamanho aproximado da piscina ou área em m²?
🔄 O serviço será único ou recorrente?
🏠 O local é residência, condomínio ou clube?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos da piscina ou área externa.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_fretes',
'Para facilitar a análise do profissional, informe, se possível:

🚚 Qual serviço deseja? (ex: mudança completa, frete, carreto, montagem de móveis)
📍 Qual o endereço de origem e destino?
📦 O que precisa ser transportado? (quantidade de móveis, caixas, eletrodomésticos...)
🏢 Os locais têm elevador ou escadas? Quantos andares?
📅 Qual a data desejada para o serviço?
📷 Se possível, envie fotos dos itens que serão transportados.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_automotivo',
'Para facilitar a análise do profissional, informe, se possível:

🚗 Qual serviço deseja? (ex: mecânica, elétrica, funilaria, higienização, troca de peças)
🚘 Qual o veículo? (marca, modelo e ano aproximado)
🔧 Qual o problema ou o que precisa ser feito?
📍 O serviço será no seu endereço ou levará o veículo à oficina?
⏰ É urgente? O veículo está parado?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do problema ou do veículo.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_pets',
'Para facilitar a análise do profissional, informe, se possível:

🐾 Qual serviço deseja? (ex: banho e tosa, consulta veterinária, adestramento, hospedagem, passeio)
🐶 Qual o animal? (espécie, raça e porte aproximado)
🏠 O serviço será no seu endereço ou você levará o animal?
💉 O animal tem alguma necessidade especial, alergia ou condição de saúde?
📅 Quais dias e horários você tem disponibilidade?
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_saude',
'Para facilitar a análise do profissional, informe, se possível:

💪 Qual serviço deseja? (ex: fisioterapia, personal trainer, nutrição, massagem, estética)
🏠 O atendimento será no seu endereço ou em consultório/estúdio?
👤 O serviço é para você ou para outra pessoa? (informe a faixa etária, se quiser)
🩺 Tem alguma condição de saúde, restrição ou objetivo específico que o profissional deva saber?
⏰ É urgente ou tem preferência de prazo para início?
📅 Quais dias e horários você tem disponibilidade?
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_educacao',
'Para facilitar a análise do profissional, informe, se possível:

📚 Qual serviço deseja? (ex: aulas particulares, reforço escolar, idiomas, música, curso)
👤 As aulas são para você ou para outra pessoa? (informe a faixa etária e série/nível, se quiser)
🏠 O atendimento será presencial (no seu endereço ou outro local) ou online?
🎯 Qual o objetivo ou dificuldade principal?
⏰ Quantas horas por semana aproximadamente?
📅 Quais dias e horários você tem disponibilidade?
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_eventos',
'Para facilitar a análise do profissional, informe, se possível:

🎉 Qual serviço deseja? (ex: decoração, buffet, fotografia, DJ, animação, organização)
👥 Qual o tipo de evento e o número aproximado de convidados?
📍 Qual o local do evento? (já definido ou precisa de indicação?)
📅 Qual a data do evento?
💰 Tem um orçamento aproximado em mente?
📷 Se possível, envie referências do estilo ou tema desejado.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_locacoes',
'Para facilitar a análise do profissional, informe, se possível:

🏠 O que deseja locar? (ex: imóvel residencial, comercial, equipamento, estrutura para evento)
📍 Qual a localização desejada ou onde o item será usado?
📅 Qual o período ou prazo desejado?
💰 Tem um valor de referência em mente?
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_empresarial',
'Para facilitar a análise do profissional, informe, se possível:

🏢 Qual serviço deseja? (ex: manutenção predial, limpeza comercial, consultoria, infraestrutura)
🏠 Qual o tipo de estabelecimento? (escritório, loja, galpão, indústria...)
📍 Qual o bairro ou endereço aproximado?
📐 Qual o porte aproximado? (tamanho da área, número de funcionários, etc.)
⏰ É urgente ou tem prazo definido?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do local.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_rural',
'Para facilitar a análise do profissional, informe, se possível:

🚜 Qual serviço deseja? (ex: terraplanagem, cerca, irrigação, limpeza de terreno, plantio)
📍 Qual a localização da propriedade?
📐 Qual o tamanho aproximado da área em hectares ou m²?
🔧 Tem maquinário disponível ou precisa que o profissional traga?
📅 Qual o prazo desejado para início ou conclusão?
📷 Se possível, envie fotos da área.
📝 Alguma informação importante que o profissional deva saber?', now()),

('system_prompt_predial',
'Para facilitar a análise do profissional, informe, se possível:

🏘️ Qual serviço deseja? (ex: zeladoria, reparo geral, pintura predial, portão, áreas comuns)
🏢 Qual o tipo de edificação? (residencial, comercial, condomínio, número de andares...)
📍 Qual o bairro ou endereço aproximado?
🔧 O serviço é pontual ou de manutenção recorrente?
⏰ É urgente?
📅 Quais dias e horários você tem disponibilidade?
📷 Se possível, envie fotos do que precisa ser feito.
📝 Alguma informação importante que o profissional deva saber?', now())

ON CONFLICT (chave) DO NOTHING;
