# INSANE server (C96, C100). No npm install: the server has no runtime dependencies.
# Node is pinned to the version the test suite runs on (.nvmrc); node:sqlite needs >= 22.5.
FROM node:22.23.3-slim

ENV NODE_ENV=production \
    PORT=8080 \
    DB_FILE=/var/data/insane.db \
    BACKUP_DIR=/var/data/backups \
    TRUST_PROXY=1

WORKDIR /app
COPY package.json .nvmrc ./
COPY server ./server
COPY app ./app
COPY tools/backup.sh tools/docker-entrypoint.sh ./tools/
RUN chmod 0755 tools/backup.sh tools/docker-entrypoint.sh \
 && mkdir -p /var/data \
 && chown node:node /var/data

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# Starts as root only to hand the (root-owned) Render disk to the node user, then drops privileges.
ENTRYPOINT ["/app/tools/docker-entrypoint.sh"]
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.js"]
