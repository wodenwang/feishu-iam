import crypto from 'node:crypto';
import http from 'node:http';

const port = Number(process.env.PORT ?? 4200);
const iamBaseUrl = process.env.IAM_BASE_URL ?? 'http://127.0.0.1:4100';
const iamAppKey = process.env.IAM_APP_KEY;
const iamApiSecret = process.env.IAM_API_SECRET;
const demoAuthMode = process.env.DEMO_AUTH_MODE ?? 'mock';

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/' || request.url?.startsWith('/?')) {
      sendHtml(response, 200, homePage());
      return;
    }

    if (request.url?.startsWith('/login')) {
      await handleLogin(request, response);
      return;
    }

    if (request.url === '/customers') {
      await handleCustomers(request, response);
      return;
    }

    if (request.url === '/403') {
      sendHtml(response, 403, layout('无权限', '<h1>403</h1><p>当前飞书用户没有 demo.customer:view 权限。</p><p><a href="/">返回</a></p>'));
      return;
    }

    sendHtml(response, 404, layout('未找到', '<h1>404</h1>'));
  } catch (error) {
    sendHtml(response, 500, layout('服务错误', `<h1>服务错误</h1><pre>${escapeHtml(error.message)}</pre>`));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`third-party demo listening at http://127.0.0.1:${port}`);
});

async function handleLogin(request, response) {
  if (demoAuthMode !== 'mock') {
    throw new Error('v0.1.2 demo only supports DEMO_AUTH_MODE=mock');
  }

  const url = new URL(request.url, 'http://127.0.0.1');
  const user = url.searchParams.get('user') === 'denied' ? 'denied' : 'allowed';
  const feishuUserId = user === 'allowed' ? 'ou_demo_customer_allowed' : 'ou_demo_customer_denied';
  const name = user === 'allowed' ? '有客户权限用户' : '无客户权限用户';
  const login = await fetch(`${iamBaseUrl}/api/dev/feishu/mock-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ feishuUserId, name, email: `${feishuUserId}@example.com` }),
  });
  if (!login.ok) {
    throw new Error(`mock login failed: ${login.status} ${await login.text()}`);
  }
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  response.statusCode = 302;
  response.setHeader('set-cookie', `${cookie}; HttpOnly; Path=/; SameSite=Lax`);
  response.setHeader('location', '/customers');
  response.end();
}

async function handleCustomers(request, response) {
  const sessionCookie = readCookie(request.headers.cookie ?? '', 'iam_session');
  if (!sessionCookie) {
    response.statusCode = 302;
    response.setHeader('location', '/');
    response.end();
    return;
  }
  const permissions = await queryPermissions(`iam_session=${sessionCookie}`);
  if (!permissions.includes('demo.customer:view')) {
    response.statusCode = 302;
    response.setHeader('location', '/403');
    response.end();
    return;
  }

  sendHtml(
    response,
    200,
    layout(
      '客户列表',
      '<h1>客户列表</h1><table><thead><tr><th>客户</th><th>状态</th></tr></thead><tbody><tr><td>飞书 IAM Demo 客户</td><td>可查看</td></tr></tbody></table><p><a href="/">切换用户</a></p>',
    ),
  );
}

async function queryPermissions(cookie) {
  if (!iamAppKey || !iamApiSecret) {
    throw new Error('IAM_APP_KEY and IAM_API_SECRET are required');
  }
  const path = '/api/application/me/permissions';
  const result = await fetch(`${iamBaseUrl}${path}`, {
    method: 'GET',
    headers: {
      cookie,
      ...sign({ method: 'GET', path, appKey: iamAppKey, apiSecret: iamApiSecret }),
    },
  });
  if (!result.ok) {
    throw new Error(`permission query failed: ${result.status} ${await result.text()}`);
  }
  const json = await result.json();
  return json.permissionCodes ?? [];
}

function sign({ method, path, appKey, apiSecret, body = '' }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = sha256Hex(body);
  const canonical = [method.toUpperCase(), path, '', timestamp, nonce, bodyHash].join('\n');
  const signingKey = sha256Hex(apiSecret);
  return {
    'x-fiam-app-key': appKey,
    'x-fiam-timestamp': timestamp,
    'x-fiam-nonce': nonce,
    'x-fiam-body-sha256': bodyHash,
    'x-fiam-signature': crypto.createHmac('sha256', signingKey).update(canonical).digest('hex'),
  };
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readCookie(cookieHeader, name) {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')[1];
}

function homePage() {
  return layout(
    '飞书 IAM 第三方 Demo',
    '<h1>飞书 IAM 第三方 Demo</h1><p>使用 mock 飞书用户验证权限查询。</p><p><a class="button" href="/login?user=allowed">有权限用户进入</a><a class="button secondary" href="/login?user=denied">无权限用户进入</a></p>',
  );
}

function layout(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; color: #1f1f1f; }
    main { max-width: 760px; margin: 48px auto; background: #fff; border: 1px solid #d9d9d9; padding: 24px; }
    h1 { margin-top: 0; font-size: 22px; }
    .button { display: inline-block; margin-right: 12px; padding: 8px 14px; background: #1677ff; color: #fff; text-decoration: none; border-radius: 4px; }
    .secondary { background: #595959; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #d9d9d9; padding: 8px 10px; text-align: left; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function sendHtml(response, statusCode, html) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(html);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

