import crypto from 'node:crypto';

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function signApplicationApiRequest(input: {
  method: string;
  path: string;
  appKey: string;
  apiSecret: string;
  body?: string;
  timestamp?: string;
  nonce?: string;
}) {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const nonce = input.nonce ?? crypto.randomUUID();
  const bodyHash = sha256Hex(input.body ?? '');
  const url = new URL(input.path, 'http://feishu-iam.local');
  const canonical = [
    input.method.toUpperCase(),
    url.pathname,
    normalizeQuery(url.searchParams),
    timestamp,
    nonce,
    bodyHash,
  ].join('\n');
  const signingKey = sha256Hex(input.apiSecret);
  const signature = crypto.createHmac('sha256', signingKey).update(canonical).digest('hex');

  return {
    'content-type': 'application/json',
    'x-fiam-app-key': input.appKey,
    'x-fiam-timestamp': timestamp,
    'x-fiam-nonce': nonce,
    'x-fiam-body-sha256': bodyHash,
    'x-fiam-signature': signature,
  };
}

function normalizeQuery(searchParams: URLSearchParams): string {
  return [...searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }
      return leftKey.localeCompare(rightKey);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

