FROM node:lts-alpine

RUN apk update \
	&& apk add git

ENV NODE_ENV=production

ENV STORAGE_DIR=/app/storage
ENV INPUT_DIR=/app/uploads 

WORKDIR /app

COPY . .

RUN npm install --production && npm run package

CMD [ "node", "--enable-source-maps", "dist/index.js" ]
