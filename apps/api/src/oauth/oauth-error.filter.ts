import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { FeishuClientError } from '../feishu/feishu.types';
import { getOauthRequestId } from './oauth-request-context';
import { OauthDomainError } from './oauth.types';

type StableOauthErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
};

@Catch(OauthDomainError, FeishuClientError)
export class OauthErrorFilter implements ExceptionFilter {
  catch(exception: OauthDomainError | FeishuClientError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = getOauthRequestId(request);
    const stableError = toStableOauthError(exception);

    if (shouldRenderHtmlError(request.path)) {
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      response.status(stableError.status).type('html').send(renderHtmlError(stableError.message, requestId));
      return;
    }

    const body: StableOauthErrorResponse = {
      error: {
        code: stableError.code,
        message: stableError.message,
        request_id: requestId
      }
    };

    response.status(stableError.status).json(body);
  }
}

function toStableOauthError(exception: OauthDomainError | FeishuClientError): {
  code: string;
  message: string;
  status: number;
} {
  if (exception instanceof OauthDomainError) {
    return {
      code: exception.code,
      message: exception.message,
      status: exception.status
    };
  }

  return {
    code: 'OAUTH_FEISHU_CLIENT_ERROR',
    message: '飞书登录服务暂时不可用，请稍后重试',
    status: 500
  };
}

function shouldRenderHtmlError(path: string): boolean {
  return path === '/oauth/authorize' || path === '/oauth/feishu/callback' || path === '/api/auth/feishu/callback';
}

function renderHtmlError(message: string, requestId: string | undefined): string {
  const safeMessage = escapeHtml(message);
  const safeRequestId = escapeHtml(requestId ?? 'unknown');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>无法完成登录</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #172033; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
    section { width: min(100%, 640px); padding: 28px; background: #fff; border: 1px solid #dde1e7; border-radius: 8px; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06); box-sizing: border-box; }
    h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.25; }
    p { margin: 10px 0; line-height: 1.7; }
    dl { display: grid; gap: 12px; margin: 20px 0; }
    dt { color: #64748b; font-size: 13px; }
    dd { margin: 4px 0 0; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    button { border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 8px 12px; cursor: pointer; min-height: 40px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .note { color: #64748b; font-size: 13px; }
    @media (max-width: 390px) { main { align-items: start; padding: 16px; } section { padding: 20px; } h1 { font-size: 20px; } }
  </style>
</head>
<body>
  <main aria-label="Feishu IAM 问题提示">
    <section>
      <p class="note">Feishu IAM</p>
      <h1>无法完成登录</h1>
      <p>${safeMessage}</p>
      <p>请返回原系统重新发起登录；如果问题持续出现，只需复制 request id 反馈给接入系统负责人或 Feishu IAM 管理员。</p>
      <dl>
        <div><dt>request id</dt><dd id="request-id">${safeRequestId}</dd></div>
        <div><dt>错误摘要</dt><dd>OAuth 登录失败</dd></div>
      </dl>
      <div class="actions">
        <button type="button" onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('request-id').textContent || '')">复制 request id</button>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
