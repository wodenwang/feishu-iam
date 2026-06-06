import { Controller, Get, Header, Query } from '@nestjs/common';

@Controller('/acceptance/oauth')
export class OauthAcceptanceController {
  @Get('/callback')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'no-store')
  callback(@Query('code') code: unknown, @Query('state') state: unknown): string {
    const normalizedCode = firstStringQueryValueOrEmpty(code);
    const normalizedState = firstStringQueryValueOrEmpty(state);

    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Feishu IAM OAuth 验收回调</title>
    <style>
      body { margin: 0; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f7f6; color: #18212f; }
      main { max-width: 760px; margin: 0 auto; padding: 24px; background: #fff; border: 1px solid #d9e1ea; border-top: 4px solid #168a60; border-radius: 8px; }
      h1 { margin: 0 0 16px; font-size: 22px; }
      p { color: #526172; line-height: 1.6; }
      dl { display: grid; gap: 12px; }
      dt { font-weight: 800; }
      dd { margin: 0; padding: 12px; border: 1px solid #d9e1ea; border-radius: 6px; background: #f8fafb; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    </style>
  </head>
  <body>
    <main>
      <h1>Feishu IAM OAuth 验收回调</h1>
      <p>本页面只显示授权码和 state，供验收人员手工调用 /oauth/token。页面不保存授权码，不发 token，不展示 client secret。</p>
      <dl>
        <dt>code</dt>
        <dd>${escapeHtml(normalizedCode)}</dd>
        <dt>state</dt>
        <dd>${escapeHtml(normalizedState)}</dd>
      </dl>
    </main>
  </body>
</html>`;
  }
}

function firstStringQueryValueOrEmpty(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string') ?? '';
  }

  return '';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
