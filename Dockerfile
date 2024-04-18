FROM node:lts-alpine

RUN apk update \
	&& apk add git

ENV STORAGE_DIR=/app/storage
ENV INPUT_DIR=/app/uploads 

WORKDIR /app

COPY . .

RUN npm install
RUN npx ncc build bibliothek-cli.ts -m -t -s
RUN rm -rf node_modules

ENV NODE_ENV=production

CMD [ "node", "--enable-source-maps", "dist/index.js" ]
