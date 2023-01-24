FROM node:18-alpine

WORKDIR /app

COPY package.json .
COPY yarn.lock .

RUN yarn --frozen-lockfile

COPY . .

RUN yarn build

CMD ["sh", "-c", "yarn start"]
