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
    console.log(`[API /api/transcribe] Nova requisição recebida (tamanho base64: ${audio ? audio.length : 0}, idioma: ${language})`);
    
    if (!audio) {
      return res.status(400).json({ success: false, error: 'Nenhum áudio enviado' });
    }

    const tempFile = path.join(__dirname, `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`);
    const buffer = Buffer.from(audio, 'base64');
    fs.writeFileSync(tempFile, buffer);
    console.log(`[API /api/transcribe] Áudio salvo em arquivo temporário (${buffer.length} bytes): ${tempFile}`);

    const scriptPath = path.join(__dirname, 'transcribe.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    execFile(pythonCmd, [scriptPath, tempFile, language], (error, stdout, stderr) => {
      // Limpeza do arquivo temporário
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch (e) {}

      if (error) {
        console.error('[API /api/transcribe] Erro ao executar script Python:', stderr || error.message);
        return res.json({ success: false, text: '', error: stderr || error.message });
      }

      if (stderr) {
        console.log('[API /api/transcribe] Log do Python:', stderr.trim());
      }

      const text = stdout ? stdout.trim() : '';
      console.log(`[API /api/transcribe] Transcrição concluída: "${text}"`);
      res.json({ success: true, text });
    });
  } catch (err) {
    console.error('[API /api/transcribe] Erro interno:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// Endpoint de Correção e Pontuação Inteligente via IA (Gemini ou Groq)
app.post('/api/ai-polish', async (req, res) => {
  try {
    const { text, apiKey, provider = 'gemini' } = req.body;
    if (!text || !text.trim()) {
      return res.json({ success: true, polishedText: '' });
    }

    const key = apiKey || DEFAULT_GEMINI_KEY || process.env.GROQ_API_KEY;

    if (!key) {
      return res.json({ success: false, needKey: true, error: 'Nenhuma chave de IA configurada.' });
    }

    console.log(`[API /api/ai-polish] Processando texto (${text.length} caracteres) via ${provider}...`);

    // Google Gemini API (Gemini 2.5 Flash / Flash Latest)
    if (provider === 'gemini' || key.startsWith('AIzaSy') || key.startsWith('AQ.')) {
      const prompt = `Você é um assistente especialista em transcrição e língua portuguesa brasileira.
Sua missão é pegar o texto falado que foi transcrito (que vem sem pontuação e desorganizado) e transformá-lo em um texto claro, natural e perfeitamente legível.

Regras fundamentais:
1. Adicione pontuação gramaticalmente correta (vírgulas, pontos finais, pontos de interrogação onde couber).
2. Divida em parágrafos coerentes quando o assunto mudar ou houver uma quebra natural de raciocínio.
3. Ajuste concordâncias e remova repetições involuntárias ou gaguejos da fala (como "tipo assim", "né", "ééé", "tá ligado", "sabe"), mantendo o tom natural.
4. Mantenha fielmente o sentido e as ideias originais do usuário. Não altere os fatos.
5. NUNCA responda à fala, NUNCA adicione introduções ou comentários seus como "Aqui está o texto revisado:".
Retorne ESTRITAMENTE o texto corrigido e formatado.

Texto falado a formatar:
"""${text}"""`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          }
        })
      });

      const data = await response.json();
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const polished = data.candidates[0].content.parts[0].text.trim();
        console.log(`[API /api/ai-polish] Sucesso Gemini: ${polished.length} caracteres.`);
        return res.json({ success: true, polishedText: polished });
      } else if (data?.error?.message) {
        console.error('[API /api/ai-polish] Erro Gemini API:', data.error.message);
        return res.json({ success: false, error: data.error.message });
      }
    }

    // Groq API (Llama 3.3 70B)
    if (provider === 'groq' || key.startsWith('gsk_')) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especialista em transcrição e língua portuguesa. Receba a fala transcrita, adicione pontuação (vírgulas, pontos, interrogações), parágrafos e correções gramaticais naturais. Não responda ao usuário, devolva apenas o texto revisado.'
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.2
        })
      });

      const data = await response.json();
      if (data?.choices?.[0]?.message?.content) {
        const polished = data.choices[0].message.content.trim();
        console.log(`[API /api/ai-polish] Sucesso Groq: ${polished.length} caracteres.`);
        return res.json({ success: true, polishedText: polished });
      } else if (data?.error?.message) {
        console.error('[API /api/ai-polish] Erro Groq API:', data.error.message);
        return res.json({ success: false, error: data.error.message });
      }
    }

    return res.json({ success: false, error: 'Provedor ou formato de chave não reconhecido.' });
  } catch (err) {
    console.error('[API /api/ai-polish] Erro interno:', err);
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
