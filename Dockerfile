FROM node:22-bookworm-slim

# Install ffmpeg and CA certificates for msedge-tts & WAV transcoding
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for faster rebuilds
COPY package.json package-lock.json* bun.lock* ./
RUN npm install

# Copy application source and build the PWA frontend
COPY . .
RUN npm run build

# Hugging Face Spaces & Cloud Run compatible port/permissions
ENV NODE_ENV=production
ENV PORT=7860
RUN chmod -R a+rX /app

EXPOSE 7860

CMD ["npx", "tsx", "server.ts"]
