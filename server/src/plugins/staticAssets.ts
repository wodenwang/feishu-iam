import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

export async function registerStaticAssets(app: FastifyInstance, assetsDir: string): Promise<void> {
  const rootDir = path.resolve(assetsDir);

  app.get('/assets/*', async (request, reply) => {
    const filePath = resolveAssetPath(rootDir, request.url);
    if (!filePath) {
      return sendNotFound(reply, request.id);
    }
    return sendFile(reply, filePath, request.id);
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.method !== 'GET' || request.url.startsWith('/api')) {
      return sendNotFound(reply, request.id);
    }

    const requestedFilePath = resolveAssetPath(rootDir, request.url);
    const filePath = (requestedFilePath ? await findExistingFile(requestedFilePath) : null) ?? path.join(rootDir, 'index.html');
    return sendFile(reply, filePath, request.id);
  });
}

function resolveAssetPath(rootDir: string, url: string): string | null {
  const pathname = new URL(url, 'http://local').pathname;
  const decodedPathname = decodeURIComponent(pathname);
  const relativePath = path.normalize(decodedPathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const filePath = path.resolve(rootDir, relativePath || 'index.html');

  if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${path.sep}`)) {
    return null;
  }

  return filePath;
}

async function findExistingFile(filePath: string): Promise<string | null> {
  const fileStat = await stat(filePath).catch(() => null);
  return fileStat?.isFile() ? filePath : null;
}

async function sendFile(reply: FastifyReply, filePath: string, requestId: string) {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return sendNotFound(reply, requestId);
  }

  const contentType = MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
  reply.header('content-type', contentType);
  return reply.send(createReadStream(filePath));
}

function sendNotFound(reply: FastifyReply, requestId: string) {
  return reply.code(404).send({
    requestId,
    code: 'NOT_FOUND',
    message: '资源不存在',
  });
}
