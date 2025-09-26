FROM node:20
WORKDIR /app
COPY frontend/package.json /app/package.json
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate && pnpm install || true
COPY frontend /app
EXPOSE 3000
CMD ["pnpm","dev","-p","3000","--host","0.0.0.0"]

