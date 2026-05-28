# Serviço Seguro — Plataforma de Serviços Profissionais

## Estrutura do Projeto

```
servico-seguro/
├── frontend/     React + Vite + TailwindCSS
├── backend/      Node.js + Express
└── README.md
```

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js + Express |
| Banco de dados | Supabase (PostgreSQL) |
| WhatsApp | Evolution API |
| IA | OpenAI GPT-4o-mini |
| PDF | pdfkit |
| Hospedagem Frontend | Netlify / Vercel |
| Hospedagem Backend | VPS (Railway / Render) |

## Como rodar

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Preencha o .env com suas credenciais
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Preencha o .env
npm run dev
```

## Variáveis de Ambiente

### Backend (.env)
```
PORT=3001
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key
OPENAI_API_KEY=sk-...
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-chave
EVOLUTION_INSTANCE=servico-seguro
WHATSAPP_NUMBER=5555999990000
FRONTEND_URL=https://seu-site.netlify.app
```

### Frontend (.env)
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_API_URL=https://seu-backend.railway.app
```
