import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { ApplicationClient } from "@prisma/client";
import type { Request } from "express";
import { DeveloperCredentialService } from "../oauth/developer-credential.service";
import { IntegrationPromptService } from "../oauth/integration-prompt.service";
import { OauthConfigService } from "../oauth/oauth-config.service";
import { OauthErrorFilter } from "../oauth/oauth-error.filter";
import type { OauthAuditContext } from "../oauth/oauth.types";
import { ApplicationService } from "../permission/application.service";
import { PermissionErrorFilter } from "../permission/permission-error.filter";
import { AdminErrorFilter } from "./admin-error.filter";
import { AdminPermissionService } from "./admin-permission.service";
import { getAdminRequestId, readAdminContext } from "./admin-request-context";
import { AdminSessionGuard } from "./admin-session.guard";
import { AdminDomainError, type AdminContext } from "./admin.types";

type AdminOauthAuditContext = OauthAuditContext & {
  actorType: "admin_user";
  actorId: string;
  source: "admin_web";
};

type CreateEnvironmentBody = {
  environmentKey: string;
  name: string;
};

type CreateRedirectUriBody = {
  redirectUri: string;
};

type CreateClientBody = {
  name: string;
};

type ClientSecretMaterialField =
  | "clientSecretHash"
  | "clientSecretCiphertext"
  | "clientSecretIv"
  | "clientSecretAuthTag"
  | "clientSecretAlgorithm";

@Controller("/api/v1/admin/applications/:appKey")
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter, OauthErrorFilter, PermissionErrorFilter)
export class AdminOauthConfigController {
  constructor(
    @Inject(OauthConfigService)
    private readonly oauthConfig: OauthConfigService,
    @Inject(ApplicationService)
    private readonly applications: ApplicationService,
    @Inject(AdminPermissionService)
    private readonly permission: AdminPermissionService,
    @Inject(DeveloperCredentialService)
    private readonly developerCredentials: DeveloperCredentialService,
    @Inject(IntegrationPromptService)
    private readonly prompts: IntegrationPromptService,
  ) {}

  @Get("/redirect-uris")
  async listApplicationRedirectUris(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<{
    items: Awaited<ReturnType<OauthConfigService["listRedirectUris"]>>;
  }> {
    await this.assertCanManageApplication(appKey, request);
    return { items: await this.oauthConfig.listRedirectUris(appKey) };
  }

  @Post("/redirect-uris")
  async createApplicationRedirectUri(
    @Param("appKey") appKey: string,
    @Body() body: CreateRedirectUriBody,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<OauthConfigService["createRedirectUri"]>>> {
    const context = await this.assertCanManageApplication(appKey, request);
    return this.oauthConfig.createRedirectUri(
      appKey,
      body,
      buildAdminOauthAuditContext(request, context),
    );
  }

  @Post("/redirect-uris/:redirectUriId/disable")
  async disableApplicationRedirectUri(
    @Param("appKey") appKey: string,
    @Param("redirectUriId") redirectUriId: string,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<OauthConfigService["disableRedirectUri"]>>> {
    const context = await this.assertCanManageApplication(appKey, request);
    return this.oauthConfig.disableRedirectUri(
      appKey,
      redirectUriId,
      buildAdminOauthAuditContext(request, context),
    );
  }

  @Get("/clients")
  async listApplicationClients(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<{
    items: Awaited<ReturnType<OauthConfigService["listClients"]>>;
  }> {
    await this.assertCanManageApplication(appKey, request);
    return { items: await this.oauthConfig.listClients(appKey) };
  }

  @Get("/developer-credentials")
  async listDeveloperCredentials(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<{
    items: Awaited<ReturnType<DeveloperCredentialService["listCredentials"]>>;
  }> {
    await this.assertCanManageApplication(appKey, request);
    return { items: await this.developerCredentials.listCredentials(appKey) };
  }

  @Get("/integration-prompt")
  async getIntegrationPrompt(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<{ integrationPrompt: string }> {
    await this.assertCanManageApplication(appKey, request);
    const application = await this.applications.getApplicationByKey(appKey);
    const [redirectUris, clients] = await Promise.all([
      this.oauthConfig.listRedirectUris(appKey),
      this.oauthConfig.listClients(appKey),
    ]);
    const client =
      clients.find((item) => item.status === "active") ?? clients[0] ?? null;
    return {
      integrationPrompt: this.prompts.generateSafePrompt({
        baseIamUrl:
          process.env.FEISHU_IAM_PUBLIC_URL ??
          `http://localhost:${process.env.HOST_WEB_PORT ?? "8000"}`,
        appKey,
        applicationName: application.name,
        redirectUris: redirectUris.map(
          (redirectUri) => redirectUri.redirectUri,
        ),
        clientId: client?.clientId ?? "<请先创建 OAuth 登录凭证>",
      }),
    };
  }

  @Get("/environments")
  async listEnvironments(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<{
    items: Awaited<ReturnType<OauthConfigService["listEnvironments"]>>;
  }> {
    await this.assertCanManageApplication(appKey, request);
    return { items: await this.oauthConfig.listEnvironments(appKey) };
  }

  @Post("/environments")
  async createEnvironment(
    @Param("appKey") appKey: string,
    @Body() body: CreateEnvironmentBody,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<OauthConfigService["createEnvironment"]>>> {
    const context = await this.assertCanManageApplication(appKey, request);
    return this.oauthConfig.createEnvironment(
      appKey,
      body,
      buildAdminOauthAuditContext(request, context),
    );
  }

  @Get("/environments/:environmentId/redirect-uris")
  async listRedirectUris(
    @Param("appKey") appKey: string,
    @Param("environmentId") environmentId: string,
    @Req() request: Request,
  ): Promise<{
    items: Awaited<ReturnType<OauthConfigService["listRedirectUris"]>>;
  }> {
    await this.assertCanManageApplication(appKey, request);
    return {
      items: await this.oauthConfig.listRedirectUris(appKey, environmentId),
    };
  }

  @Post("/environments/:environmentId/redirect-uris")
  async createRedirectUri(
    @Param("appKey") appKey: string,
    @Param("environmentId") environmentId: string,
    @Body() body: CreateRedirectUriBody,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<OauthConfigService["createRedirectUri"]>>> {
    const context = await this.assertCanManageApplication(appKey, request);
    return this.oauthConfig.createRedirectUri(
      appKey,
      environmentId,
      body,
      buildAdminOauthAuditContext(request, context),
    );
  }

  @Get("/environments/:environmentId/clients")
  async listClients(
    @Param("appKey") appKey: string,
    @Param("environmentId") environmentId: string,
    @Req() request: Request,
  ): Promise<{
    items: Awaited<ReturnType<OauthConfigService["listClients"]>>;
  }> {
    await this.assertCanManageApplication(appKey, request);
    return { items: await this.oauthConfig.listClients(appKey, environmentId) };
  }

  @Post("/environments/:environmentId/clients")
  async createClient(
    @Param("appKey") appKey: string,
    @Param("environmentId") environmentId: string,
    @Body() body: CreateClientBody,
    @Req() request: Request,
  ): Promise<
    Omit<
      Awaited<ReturnType<OauthConfigService["createClient"]>>,
      ClientSecretMaterialField
    >
  > {
    const context = await this.assertCanManageApplication(appKey, request);
    const created = await this.oauthConfig.createClient(
      appKey,
      environmentId,
      body,
      buildAdminOauthAuditContext(request, context),
    );
    return removeClientSecretMaterial(created);
  }

  @Post("/clients/:clientId/rotate-secret")
  async rotateClientSecret(
    @Param("appKey") appKey: string,
    @Param("clientId") clientId: string,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<OauthConfigService["rotateClientSecret"]>>> {
    const context = await this.assertCanManageApplication(appKey, request);
    return this.oauthConfig.rotateClientSecret(
      appKey,
      clientId,
      buildAdminOauthAuditContext(request, context),
    );
  }

  @Post("/clients/:clientId/view-secret")
  async viewClientSecret(
    @Param("appKey") appKey: string,
    @Param("clientId") clientId: string,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<OauthConfigService["viewClientSecret"]>>> {
    const context = await this.assertCanManageApplication(appKey, request);
    return this.oauthConfig.viewClientSecret(
      appKey,
      clientId,
      buildAdminOauthAuditContext(request, context),
    );
  }

  @Post("/clients/:clientId/enable")
  async enableClient(
    @Param("appKey") appKey: string,
    @Param("clientId") clientId: string,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<OauthConfigService["setClientStatus"]>>> {
    const context = await this.assertCanManageApplication(appKey, request);
    return this.oauthConfig.setClientStatus(
      appKey,
      clientId,
      "active",
      buildAdminOauthAuditContext(request, context),
    );
  }

  @Post("/clients/:clientId/disable")
  async disableClient(
    @Param("appKey") appKey: string,
    @Param("clientId") clientId: string,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<OauthConfigService["setClientStatus"]>>> {
    const context = await this.assertCanManageApplication(appKey, request);
    return this.oauthConfig.setClientStatus(
      appKey,
      clientId,
      "disabled",
      buildAdminOauthAuditContext(request, context),
    );
  }

  private async assertCanManageApplication(
    appKey: string,
    request: Request,
  ): Promise<AdminContext> {
    const context = readRequiredAdminContext(request);
    const application = await this.applications.getApplicationByKey(appKey);
    this.permission.assertCanManageApplication(context, application.id);
    return context;
  }
}

function readRequiredAdminContext(request: Request): AdminContext {
  const context = readAdminContext(request);

  if (!context) {
    throw new AdminDomainError(
      "ADMIN_SESSION_REQUIRED",
      "需要登录 Feishu IAM 管理后台",
      401,
    );
  }

  return context;
}

function buildAdminOauthAuditContext(
  request: Request,
  context: AdminContext,
): AdminOauthAuditContext {
  return {
    actorType: "admin_user",
    actorId: context.adminUserId,
    source: "admin_web",
    requestId: getAdminRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header("user-agent") ?? null,
  };
}

function removeClientSecretMaterial<T extends Partial<ApplicationClient>>(
  client: T,
): Omit<T, ClientSecretMaterialField> {
  const {
    clientSecretHash,
    clientSecretCiphertext,
    clientSecretIv,
    clientSecretAuthTag,
    clientSecretAlgorithm,
    ...response
  } = client;
  void clientSecretHash;
  void clientSecretCiphertext;
  void clientSecretIv;
  void clientSecretAuthTag;
  void clientSecretAlgorithm;
  return response;
}
