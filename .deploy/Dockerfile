FROM node:18-alpine as build

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
COPY .npmrc ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

FROM node:18-alpine as deploy

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules/
COPY --from=build /app/dist         ./dist/
COPY --from=build /app/package.json ./package.json

CMD ["node", "dist/main"]
