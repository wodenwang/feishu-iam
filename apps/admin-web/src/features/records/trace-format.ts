export function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    admin_auth: "后台认证/授权",
    admin_change: "后台变更",
    oauth_authorize: "OAuth authorize",
    oauth_login: "飞书登录",
    token_exchange: "换取 token",
    userinfo: "userinfo",
    permission_query: "权限查询",
    feishu_sync: "飞书同步",
    oauth_token_context: "token 上下文",
  };
  return labels[stage] ?? stage;
}

export function resultLabel(result: string): string {
  if (result === "success") return "成功";
  if (result === "failed") return "失败";
  if (result === "running") return "运行中";
  if (result === "revoked") return "已撤销";
  return result;
}
