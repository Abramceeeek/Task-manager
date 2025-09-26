FROM node:18-alpine

WORKDIR /app

RUN mkdir -p data

COPY package*.json ./
# Use npm install to avoid lockfile mismatch issues in CI/containers
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
