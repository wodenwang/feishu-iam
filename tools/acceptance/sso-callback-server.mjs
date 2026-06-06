#!/usr/bin/env node

import http from 'node:http';
import { readFileSync } from 'node:fs';

const envPath = process.env.ACCEPTANCE_ENV_FILE ?? '.env.acceptance.local';
const env = loadEnv(envPath);

const baseUrl = trimTrailingSlash(env.FEISHU_IAM_BASE_URL ?? 'http://localhost:3000');
const appKey = requireEnv('APP_KEY');
const clientId = requireEnv('CLIENT_ID');
const clientSecret = requireEnv('CLIENT_SECRET');
const redirectUri = requireEnv('REDIRECT_URI');
const expectedState = requireEnv('STATE');
const platformAdminToken = env.PLATFORM_ADMIN_TOKEN ?? process.env.PLATFORM_ADMIN_TOKEN;
const roleId = env.ROLE_ID ?? process.env.ROLE_ID;
const port = Number(env.CALLBACK_SERVER_PORT ?? new URL(redirectUri).port ?? 3999);
const authorizeUrl = requireEnv('AUTHORIZE_URL');

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://localhost:${port}`);
    if (url.pathname === '/') {
      sendHtml(response, 200, renderIndex());
      return;
    }

    if (url.pathname !== new URL(redirectUri).pathname) {
      sendHtml(response, 404, renderPage('未找到页面', `<p>当前验收服务只处理 <code>${escapeHtml(new URL(redirectUri).pathname)}</code>。</p>`));
      return;
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code) {
      sendHtml(response, 400, renderPage('回调缺少 code', '<p>Feishu IAM 没有返回授权码。</p>'));
      return;
    }
    if (state !== expectedState) {
      sendHtml(response, 400, renderPage('state 校验失败', '<p>回调 state 与本地验收配置不一致。</p>'));
      return;
    }

    const token = await postForm('/oauth/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });
    const accessToken = token.access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new Error('token 响应缺少 access_token');
    }

    const userinfo = await getJson('/oauth/userinfo', accessToken);
    const roleBinding = await maybeBindAcceptanceRole(userinfo);
    const permissions = await getJson(`/api/v1/apps/${encodeURIComponent(appKey)}/me/permissions`, accessToken);
    const revoke = await postForm('/oauth/revoke', {
      token: accessToken,
      client_id: clientId,
      client_secret: clientSecret
    });

    sendHtml(response, 200, renderSuccess({
      token: redactTokenResponse(token),
      userinfo,
      roleBinding,
      permissions,
      revoke
    }));
  } catch (error) {
    sendHtml(response, 500, renderPage('验收请求失败', `<pre>${escapeHtml(formatError(error))}</pre>`));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Feishu IAM SSO callback server listening on http://127.0.0.1:${port}`);
  console.log(`Open this URL to start acceptance: ${authorizeUrl}`);
});

async function getJson(path, accessToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  return readJsonResponse(response);
}

async function postForm(path, values) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(values)
  });
  return readJsonResponse(response);
}

async function maybeBindAcceptanceRole(userinfo) {
  if (!platformAdminToken || !roleId || typeof userinfo.user_id !== 'string') {
    return {
      updated: false,
      reason: '未配置 PLATFORM_ADMIN_TOKEN 或 ROLE_ID，跳过自动角色绑定'
    };
  }

  const response = await fetch(`${baseUrl}/api/v1/platform/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/subjects`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${platformAdminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subjects: [{ type: 'feishu_user', id: userinfo.user_id }]
    })
  });
  await readJsonResponse(response);

  return {
    updated: true,
    subject_type: 'feishu_user',
    subject_id: userinfo.user_id
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.response = body;
    throw error;
  }

  return body;
}

function renderIndex() {
  return renderPage('Feishu IAM SSO 真实验收', `
    <p>本地回调服务已启动。点击下面链接会跳转到 Feishu IAM，再由 Feishu IAM 跳转飞书登录。</p>
    <p><a href="${escapeHtml(authorizeUrl)}">开始 SSO 验收登录</a></p>
    <dl>
      <dt>应用</dt><dd><code>${escapeHtml(appKey)}</code></dd>
      <dt>client</dt><dd><code>${escapeHtml(clientId)}</code></dd>
      <dt>回调地址</dt><dd><code>${escapeHtml(redirectUri)}</code></dd>
    </dl>
  `);
}

function renderSuccess(result) {
  return renderPage('验收成功', `
    <p>已完成授权码换 token、userinfo、权限查询和 token revoke。页面不会展示 access token 或 client secret。</p>
    <h2>token 响应</h2>
    <pre>${escapeHtml(JSON.stringify(result.token, null, 2))}</pre>
    <h2>userinfo</h2>
    <pre>${escapeHtml(JSON.stringify(result.userinfo, null, 2))}</pre>
    <h2>验收角色绑定</h2>
    <pre>${escapeHtml(JSON.stringify(result.roleBinding, null, 2))}</pre>
    <h2>permissions</h2>
    <pre>${escapeHtml(JSON.stringify(result.permissions, null, 2))}</pre>
    <h2>revoke</h2>
    <pre>${escapeHtml(JSON.stringify(result.revoke, null, 2))}</pre>
  `);
}

function renderPage(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 40px; color: #17202a; line-height: 1.6; }
    main { max-width: 920px; }
    a { color: #155eef; }
    code, pre { background: #f5f7fa; border: 1px solid #d8dee8; border-radius: 6px; }
    code { padding: 2px 6px; }
    pre { padding: 12px; overflow: auto; }
    dt { font-weight: 700; margin-top: 12px; }
    dd { margin-left: 0; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${body}
  </main>
</body>
</html>`;
}

function sendHtml(response, status, html) {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8'
  });
  response.end(html);
}

function loadEnv(file) {
  const result = {};
  const content = readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function requireEnv(key) {
  const value = env[key] ?? process.env[key];
  if (!value) {
    throw new Error(`${envPath} 缺少 ${key}`);
  }
  return value;
}

function trimTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function redactTokenResponse(token) {
  return {
    ...token,
    access_token: typeof token.access_token === 'string' ? '<redacted>' : token.access_token
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatError(error) {
  if (error instanceof Error) {
    const details = error.response ? `\n${JSON.stringify(error.response, null, 2)}` : '';
    return `${error.message}${details}`;
  }
  return String(error);
}
