import { SystemSettingsView } from "../features/settings/SystemSettingsView";
import type {
  FeishuDetailState,
  SystemApiState,
  SystemSettingsViewProps,
} from "../features/settings/SystemSettingsView";

export type { FeishuDetailState, SystemApiState };

export function SystemSettingsPage(props: SystemSettingsViewProps) {
  return <SystemSettingsView {...props} />;
}
