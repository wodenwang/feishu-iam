import type { AdminMe } from '../admin-types';
import type { FeishuStatus } from '../api/feishu';
import type { ApiStatus } from '../api/status';
import { WorkspaceView } from '../features/workspace/WorkspaceView';

export function WorkspacePage(props: {
  admin: AdminMe;
  apiStatus?: ApiStatus;
  feishuStatus?: FeishuStatus;
  onNavigate: (href: string) => void;
}) {
  return (
    <WorkspaceView
      admin={props.admin}
      apiStatus={props.apiStatus}
      feishuStatus={props.feishuStatus}
      onNavigate={props.onNavigate}
    />
  );
}
