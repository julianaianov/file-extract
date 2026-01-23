# syntax=docker/dockerfile:1.7

# 1) Instala dependências (com dev) para fazer o build
FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=development
RUN corepack enable
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# 2) Build da aplicação Next.js no modo standalone
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Garante que a pasta data exista no build (não é empacotada, mas previne erros)
RUN mkdir -p /app/data
RUN --mount=type=cache,target=/root/.npm \
    npm run build

# 3) Runtime enxuto: copia somente o necessário do build standalone
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Usuário não-root para segurança
RUN useradd -m nextjs

# Copia artefatos do modo standalone
COPY --from=builder /app/.next/standalone ./ 
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Diretórios persistentes (montados como volume no compose)
RUN mkdir -p /app/data && chown -R nextjs:nextjs /app
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]


