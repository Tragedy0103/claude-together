FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY server.ts tsconfig.json ./

EXPOSE 3456

CMD ["npx", "tsx", "server.ts"]
