require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Routes
const orcRoutes = require('./routes/orcs');
const contratoRoutes = require('./routes/contratos');
const whatsappRoutes = require('./routes/whatsapp');
const iaRoutes = require('./routes/ia');
const configRoutes = require('./routes/config');

// Jobs (cron)
const { iniciarJobs } = require('./jobs');

const app = express();
const PORT = process.env.PORT || 3001;

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Serviço Seguro API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// ── ROTAS ─────────────────────────────────────────────────────
app.use('/api/orcs', orcRoutes);
app.use('/api/contratos', contratoRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ia', iaRoutes);
app.use('/api/config', configRoutes);

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡️  Serviço Seguro API rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL ? '✅ configurado' : '❌ não configurado'}`);
  console.log(`   OpenAI:   ${process.env.OPENAI_API_KEY ? '✅ configurado' : '❌ não configurado'}`);
  console.log(`   WhatsApp: ${process.env.EVOLUTION_API_URL ? '✅ configurado' : '❌ não configurado'}\n`);

  // Iniciar jobs automáticos
  iniciarJobs();
});

module.exports = app;
