import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(__dirname, '../src/feishu');
const contactPathPattern = /\/contact\/v3\/[^`'"]+/g;
const allowedContactPathPatterns = [
  /^\/contact\/v3\/departments\/\$\{[\s\S]+\}\/children$/,
  /^\/contact\/v3\/users\/find_by_department$/
];
const forbiddenWriteMethodPattern = /method:\s*['"](?:PATCH|PUT|DELETE)['"]/;
const postMethodPattern = /method:\s*['"]POST['"]/;

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return listTsFiles(path);
    }
    return path.endsWith('.ts') ? [path] : [];
  });
}

function extractFunctionCalls(content: string, functionName: string): string[] {
  const calls: string[] = [];
  const needle = `${functionName}(`;
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const start = content.indexOf(needle, searchFrom);
    if (start === -1) {
      break;
    }

    let depth = 0;
    let end = -1;
    for (let index = start + functionName.length; index < content.length; index += 1) {
      const char = content[index];
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }

    if (end === -1) {
      break;
    }

    calls.push(content.slice(start, end));
    searchFrom = end;
  }

  return calls;
}

function findWriteMethodViolations(file: string, content: string): string[] {
  const fileViolations: string[] = [];

  if (forbiddenWriteMethodPattern.test(content)) {
    fileViolations.push(`${file} uses PATCH/PUT/DELETE HTTP method`);
  }

  const fetchCalls = extractFunctionCalls(content, 'fetch');
  if (fetchCalls.some((call) => call.includes('/contact/v3/') && postMethodPattern.test(call))) {
    fileViolations.push(`${file} uses POST with contact endpoint`);
  }

  const postJsonCalls = extractFunctionCalls(content, 'postJson');
  if (postJsonCalls.some((call) => call.includes('/contact/v3/'))) {
    fileViolations.push(`${file} uses postJson with contact endpoint`);
  }

  return fileViolations;
}

describe('飞书客户端只读约束', () => {
  it('feishu 模块只允许白名单内的通讯录只读接口', () => {
    const violations = listTsFiles(sourceRoot).flatMap((file) => {
      const content = readFileSync(file, 'utf8');
      const contactPaths = content.match(contactPathPattern) ?? [];
      return contactPaths
        .filter((path) => !allowedContactPathPatterns.some((pattern) => pattern.test(path)))
        .map((path) => `${file} uses non-readonly contact endpoint ${path}`);
    });

    expect(violations).toEqual([]);
  });

  it('feishu 模块不包含通讯录写 HTTP 方法', () => {
    const violations = listTsFiles(sourceRoot).flatMap((file) => {
      const content = readFileSync(file, 'utf8');
      return findWriteMethodViolations(file, content);
    });

    expect(violations).toEqual([]);
  });

  it('检测 postJson 通讯录调用即使没有显式 method 也属于违规', () => {
    const content = `
      async function unsafe() {
        await this.postJson('/contact/v3/users/find_by_department', { department_id: '0' });
        await this.postJson('/auth/v3/tenant_access_token/internal', { app_id: 'id' });
      }
    `;

    expect(findWriteMethodViolations('fixture.ts', content)).toEqual([
      'fixture.ts uses postJson with contact endpoint'
    ]);
  });
});
