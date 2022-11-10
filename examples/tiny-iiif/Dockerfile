FROM node:16-slim
ENV IIIF_IMAGE_PATH=/data
COPY --chown=node:node . /var/app
USER node
WORKDIR /var/app
RUN npm i --omit=dev
CMD ./index.js
EXPOSE 3000
HEALTHCHECK CMD curl http://localhost:3334/auth/whoami
