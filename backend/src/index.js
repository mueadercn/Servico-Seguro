require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Routes
const authRoutes = require('./routes/auth');
const orcRoutes = require('./routes/orcs');
const contratoRoutes = require('./routes/contratos');
const whatsappRoutes = require('./routes/whatsapp');
const iaRoutes = require('./routes/ia');
const configRoutes = require('./routes/config');
const prestadoresRoutes = require('./routes/prestadores');
const usuariosRoutes = require('./routes/usuarios');
const servicosRoutes = require('./routes/servicos');
const adminRoutes = require('./routes/admin');

// Jobs
const { iniciarJobs } = require('./jobs');

const app = express();
const PORT = process.env.PORT || 3001;

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Serviço Seguro API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    routes: [
      '/api/auth', '/api/orcs', '/api/contratos', '/api/whatsapp',
      '/api/ia', '/api/config', '/api/prestadores', '/api/usuarios',
      '/api/servicos', '/api/admin'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// ── ROTAS ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/orcs', orcRoutes);
app.use('/api/contratos', contratoRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ia', iaRoutes);
app.use('/api/config', configRoutes);
app.use('/api/prestadores', prestadoresRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/servicos', servicosRoutes);
app.use('/api/admin', adminRoutes);

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡️  Serviço Seguro API rodando na porta ${PORT}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`   OpenAI:   ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
  console.log(`   WhatsApp: ${process.env.EVOLUTION_API_URL ? '✅' : '❌'}\n`);
  iniciarJobs();
});

module.exports = app;
