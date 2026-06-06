import type { AdminMe } from "../admin-types";
import type { OpenApplicationRecordsOptions } from "../features/applications/ApplicationDetailSheet";
import { ApplicationDetailWorkspace } from "../features/applications/ApplicationDetailPage";

export function ApplicationDetailPage(props: {
  admin: AdminMe;
  onManagePermissions: (appKey: string) => void;
  onOpenRecords: (applicationId: string, options?: OpenApplicationRecordsOptions) => void;
}) {
  return <ApplicationDetailWorkspace {...props} />;
}
