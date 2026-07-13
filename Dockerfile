FROM node:20-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && \
    npm install tsx

FROM node:20-slim AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends libaio1 curl ca-certificates unzip && \
    mkdir -p /opt/oracle && \
    curl -L "https://download.oracle.com/otn_software/linux/instantclient/2113000/instantclient-basic-linux.x64-21.13.0.0.0dbru.zip" -o /tmp/instantclient.zip && \
    unzip -q /tmp/instantclient.zip -d /opt/oracle && \
    mv /opt/oracle/instantclient_21_13 /opt/oracle/instantclient && \
    echo /opt/oracle/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf && \
    ldconfig && \
    rm /tmp/instantclient.zip && \
    apt-get remove -y --auto-remove curl unzip && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    ORACLE_CLIENT_PATH=/opt/oracle/instantclient

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

WORKDIR /app

COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules

COPY --chown=appuser:appgroup package.json tsconfig.json ./
COPY --chown=appuser:appgroup src ./src

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node_modules/.bin/tsx", "src/api/server.ts"]
