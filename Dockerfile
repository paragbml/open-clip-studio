FROM node:20-bullseye-slim

# Install system dependencies: Python 3, pip, ffmpeg, fonts for subtitles
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    ffmpeg \
    fontconfig \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/requirements.txt ./server/

# Install Node dependencies and Python dependencies
RUN npm ci --prefix client && npm install --omit=dev
RUN pip3 install --no-cache-dir -r server/requirements.txt

# Copy source code
COPY . .

# Build frontend client for production serving
RUN npm --prefix client run build

# Ensure uploads, exports, previews have write permissions
RUN mkdir -p server/uploads/previews server/exports server/samples server/assets/sfx \
    && chmod -R 777 server/uploads server/exports server/samples

# Default port (7860 is default for Hugging Face Spaces; can be overridden via PORT env var)
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

CMD ["node", "server/server.js"]
