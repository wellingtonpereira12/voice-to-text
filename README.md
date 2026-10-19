# 🎙️ VoxScript — Gravador de Voz e Transcritor em Texto

Aplicação web moderna para gravação de voz no navegador com conversão em texto em tempo real, seleção de dispositivo de microfone com medidor de volume (VU meter), visualizador de ondas sonoras, reprodutor do áudio gravado e botão de cópia rápida para a área de transferência.

---

## ✨ Funcionalidades Principais

1. **Gravação de Áudio e Voz:**
   - Captura de áudio diretamente pelo navegador via `MediaRecorder` e `Web Audio API`.
   - Botão intuitivo com animações pulsantes e contador de tempo decorrido.
   - Opção de pausar e retomar a gravação a qualquer momento.

2. **Transcrição de Voz em Texto ao Clicar em "Parar":**
   - Reconhecimento de fala via Web Speech API nativa com prévia em tempo real.
   - Ao finalizar a fala e apertar o botão **"Parar Gravação"**, o áudio é processado e o texto finalizado é exibido pronto para uso.
   - Suporte a múltiplos idiomas: Português (Brasil - `pt-BR`), Inglês (`en-US`), Espanhol (`es-ES`), Francês (`fr-FR`), etc.
   - Modo de adição configurável: anexar às gravações anteriores ou substituir texto.

3. **Escolher Microfone:**
   - Botão dedicado para listar e selecionar qual microfone usar (`audioinput`).
   - Medidor de volume em tempo real (VU meter) com barras coloridas para testar o microfone antes de iniciar a gravação.
   - Salva a escolha do microfone no `localStorage`.

4. **Copiar Texto com Um Clique:**
   - Botão de cópia rápida com feedback visual animado e notificação flutuante (toast).
   - Ferramenta para baixar a transcrição como arquivo `.txt`.
   - Leitor em voz alta integrado (Text-to-Speech).
   - Estatísticas em tempo real: contagem de caracteres, palavras e tempo estimado de leitura.

5. **Histórico da Sessão & Player de Áudio:**
   - Player para reouvir e baixar o áudio gravado (`.webm`).
   - Gaveta de histórico com gravações salvas na sessão atual.

---

## 🐳 Executando com Docker

O projeto já conta com estrutura Docker otimizada com multi-stage build:

```bash
# Construir a imagem e subir o container em segundo plano
docker compose up -d --build

# Verificar se o container está saudável
docker ps --filter name=voice-to-text

# Acessar logs do serviço
docker logs -f voice-to-text
```

A aplicação ficará disponível em: `http://localhost:3080` (ou na porta configurada).

---

## 💻 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (Vite)
npm run dev

# Gerar build de produção
npm run build

# Iniciar servidor Node.js com o build de produção
npm start
```

---

## 🚀 CI/CD com GitHub Actions e Deploy na VPS

O workflow configurado em `.github/workflows/deploy.yml` realiza o ciclo completo:
1. Faz o checkout do código e instala dependências no runner do GitHub.
2. Executa a compilação de produção (`npm run build`).
3. Conecta à sua VPS via SSH e atualiza o repositório em `/root/voice-to-text`.
4. Executa `docker compose up -d --build`.
5. Valida a inicialização através do endpoint de saúde `/api/health`.

### Secrets do Repositório GitHub:
- `VPS_HOST`: IP do servidor (ex: `187.127.17.88`)
- `VPS_USER`: Usuário SSH (`root`)
- `VPS_PASSWORD`: Senha do SSH
- `VPS_PORT`: Porta SSH (`22`)

---

## 🔒 Dica sobre Permissões de Microfone e HTTPS

Por padrão de segurança dos navegadores modernos (Google Chrome, Edge, Safari), o acesso ao microfone (`getUserMedia`) requer um **Contexto Seguro**:
- `http://localhost:3080` ou `http://127.0.0.1:3080` funciona nativamente sem SSL para testes locais.
- Ao acessar remotamente pela internet através de domínio ou IP público, recomenda-se configurar um proxy reverso no Nginx com certificado SSL (Let's Encrypt / Certbot), ou adicionar o IP à lista de origens seguras em `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
