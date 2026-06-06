import type { AdminMe } from '../admin-types';
import { ApplicationManagementView } from '../features/applications/ApplicationManagementView';
import type { OpenApplicationRecordsOptions } from '../features/applications/ApplicationDetailSheet';

export function ApplicationManagementPage(props: {
  admin: AdminMe;
  initialAppKey?: string | null;
  onManagePermissions: (appKey: string) => void;
  onOpenRecords: (applicationId: string, options?: OpenApplicationRecordsOptions) => void;
}) {
  return <ApplicationManagementView {...props} />;
}
