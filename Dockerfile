FROM node:18 as build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM node:18-alpine as production

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules/
COPY --from=build /app/dist ./dist/

CMD ["node", "dist/index.js"]