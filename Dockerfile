# Sin ARG ni ENV de claves: la credencial llega en tiempo de ejecucion (secreto de Render,
# o Managed Identity + federacion en Azure). Nunca dentro de la imagen.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY tsconfig.json ./
EXPOSE 3000
USER node
CMD ["./node_modules/.bin/tsx", "server/index.ts"]
