import { Controller, Get, Header, Res } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'express';

const ADMIN_WEB_DIST_DIR = resolveAdminWebDistDir();
const ADMIN_WEB_INDEX = join(ADMIN_WEB_DIST_DIR, 'index.html');

@Controller()
export class AdminWebController {
  @Get(['/', '/admin', '/admin/*'])
  @Header('content-type', 'text/html; charset=utf-8')
  getIndex(@Res() response: Response): void {
    if (!existsSync(ADMIN_WEB_INDEX)) {
      response.status(503).send(renderMissingAdminWebPage());
      return;
    }

    response.status(200).send(readFileSync(ADMIN_WEB_INDEX, 'utf8'));
  }
}

export function getAdminWebDistDir(): string {
  return ADMIN_WEB_DIST_DIR;
}

function renderMissingAdminWebPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>Feishu IAM 管理后台未构建</title></head>
  <body><h1>Feishu IAM 管理后台未构建</h1><p>请先运行管理端构建或使用 Docker Compose 镜像。</p></body>
</html>`;
}

function resolveAdminWebDistDir(): string {
  const configuredDistDir = process.env.FEISHU_IAM_ADMIN_WEB_DIST_DIR?.trim();
  if (configuredDistDir) {
    return configuredDistDir;
  }

  const defaultDistDir = join(process.cwd(), 'apps/admin-web/dist');
  const candidates = [defaultDistDir, join(process.cwd(), '../admin-web/dist')];
  return candidates.find((candidate) => existsSync(join(candidate, 'index.html'))) ?? defaultDistDir;
}
