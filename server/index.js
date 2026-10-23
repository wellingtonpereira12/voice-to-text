import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Redirecionamento automático do IP/HTTP para o domínio seguro HTTPS (https://voz.pampo.tech)
app.use((req, res, next) => {
  const host = req.headers.host || '';
  // Se for acessado pelo IP ou diretamente na porta 3080 pelo navegador, redireciona para HTTPS
  if (host.includes('187.127.17.88') || host.endsWith(':3080')) {
    if (req.url === '/api/health') return next();
    return res.redirect(301, 'https://voz.pampo.tech' + req.url);
  }
  next();
});

// Endpoint de Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'voz',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime())
  });
});

// Endpoint de Transcrição Robusta no Servidor via Python + SpeechRecognition / FFmpeg
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio, language = 'pt-BR' } = req.body;
    if (!audio) {
      return res.status(400).json({ success: false, error: 'Nenhum áudio enviado' });
    }

    const tempFile = path.join(__dirname, `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`);
    const buffer = Buffer.from(audio, 'base64');
    fs.writeFileSync(tempFile, buffer);

    const scriptPath = path.join(__dirname, 'transcribe.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    execFile(pythonCmd, [scriptPath, tempFile, language], (error, stdout, stderr) => {
      // Limpeza do arquivo temporário
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch (e) {}

      if (error) {
        console.error('Aviso na transcrição Python:', stderr || error.message);
        // Mesmo se der erro no python, retorna formato amigável
        return res.json({ success: false, text: '', error: stderr || error.message });
      }

      const text = stdout ? stdout.trim() : '';
      res.json({ success: true, text });
    });
  } catch (err) {
    console.error('Erro no endpoint /api/transcribe:', err);
    res.status(500).json({ success: false, error: err.message });
  }
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
