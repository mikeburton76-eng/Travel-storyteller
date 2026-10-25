FROM node:22-bookworm-slim AS node
FROM python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libseccomp2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY requirements-voice.txt ./
RUN python -m pip install --no-cache-dir -r requirements-voice.txt
COPY . .
RUN npm run prepare:voice && useradd --uid 10001 --create-home storyteller && chown -R storyteller:storyteller /app
USER storyteller
ENV VOICE_PYTHON=/usr/local/bin/python
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
