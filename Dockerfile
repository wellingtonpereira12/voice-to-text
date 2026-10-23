FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3080

# Instala python3, pip, ffmpeg e flac para o serviço de transcrição do servidor
RUN apk add --no-cache python3 py3-pip ffmpeg flac
RUN pip install --break-system-packages SpeechRecognition

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 3080

CMD ["node", "server/index.js"]
