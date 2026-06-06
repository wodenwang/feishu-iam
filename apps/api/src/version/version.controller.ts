import { Controller, Get } from "@nestjs/common";

const FALLBACK_VERSION = "0.16.2-dev";

type VersionResponse = {
  name: "feishu-iam-api";
  version: string;
  commit: string;
  node_env: string;
};

@Controller()
export class VersionController {
  @Get("version")
  version(): VersionResponse {
    return {
      name: "feishu-iam-api",
      version: process.env.APP_VERSION ?? FALLBACK_VERSION,
      commit: process.env.GIT_COMMIT ?? "local",
      node_env: process.env.NODE_ENV ?? "development",
    };
  }
}
