import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3080;

app.use(cors());
app.use(express.json());

// Endpoint de Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'voice-to-text',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime())
  });
});

// Servir arquivos estáticos da pasta dist gerada pelo Vite
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback SPA (Single Page Application)
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Voz rodando na porta ${PORT}`);
});
