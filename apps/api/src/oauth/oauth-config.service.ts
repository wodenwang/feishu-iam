import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type ApplicationClient,
  type ApplicationEnvironment,
  type ApplicationRedirectUri,
} from "@prisma/client";
import { ApplicationService } from "../permission/application.service";
import { AuditLogService } from "../permission/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  ClientSecretVault,
  type EncryptedClientSecret,
} from "./client-secret-vault";
import { createOauthSecret, hashOauthSecret } from "./oauth-crypto";
import { SecurityEventService } from "./security-event.service";
import {
  OauthDomainError,
  type OauthAuditContext,
  type OauthEntityStatus,
} from "./oauth.types";
import { assertEnvironmentKey, assertRedirectUri } from "./oauth.validators";

type CreateEnvironmentInput = {
  environmentKey: string;
  name: string;
};

type CreateRedirectUriInput = {
  redirectUri: string;
};

type CreateClientInput = {
  name: string;
};

type CreateOauthCredentialInput = {
  name?: string;
};

type ClientSecretMaterialField =
  | "clientSecretHash"
  | "clientSecretCiphertext"
  | "clientSecretIv"
  | "clientSecretAuthTag"
  | "clientSecretAlgorithm";

type SafeApplicationClient = Omit<ApplicationClient, ClientSecretMaterialField>;

type OauthConfigClient = Pick<
  Prisma.TransactionClient,
  | "application"
  | "applicationEnvironment"
  | "applicationRedirectUri"
  | "applicationClient"
  | "auditLog"
  | "securityEvent"
>;

const SYSTEM_ACTOR = {
  actorType: "platform_token",
  actorId: "platform-admin-token",
  source: "platform_api",
};

@Injectable()
export class OauthConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationService,
    private readonly audit: AuditLogService,
    private readonly clientSecretVault: ClientSecretVault,
    private readonly securityEvents: SecurityEventService,
  ) {}

  async createEnvironment(
    appKey: string,
    input: CreateEnvironmentInput,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationEnvironment> {
    assertEnvironmentKey(input.environmentKey);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const application = await this.applications.getApplicationByKey(
          appKey,
          tx,
        );
        const created = await tx.applicationEnvironment.create({
          data: {
            id: randomUUID(),
            applicationId: application.id,
            environmentKey: input.environmentKey,
            name: input.name,
          },
        });

        await this.recordAudit(
          application.id,
          "application_environment",
          created.id,
          "create",
          undefined,
          created,
          tx,
          auditContext,
        );
        return created;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new OauthDomainError(
          "OAUTH_ENVIRONMENT_CONFLICT",
          "应用环境 key 已存在",
          409,
        );
      }
      throw error;
    }
  }

  async listEnvironments(appKey: string): Promise<ApplicationEnvironment[]> {
    const application = await this.applications.getApplicationByKey(appKey);
    return this.prisma.applicationEnvironment.findMany({
      where: {
        applicationId: application.id,
      },
      orderBy: {
        environmentKey: "asc",
      },
    });
  }

  async setEnvironmentStatus(
    appKey: string,
    environmentId: string,
    status: OauthEntityStatus,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationEnvironment> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(
        appKey,
        tx,
      );
      const current = await this.getEnvironment(
        application.id,
        environmentId,
        tx,
      );
      const updated = await tx.applicationEnvironment.update({
        where: {
          applicationId_id: {
            applicationId: application.id,
            id: environmentId,
          },
        },
        data: {
          status,
        },
      });

      await this.recordAudit(
        application.id,
        "application_environment",
        updated.id,
        "set_status",
        current,
        updated,
        tx,
        auditContext,
      );
      return updated;
    });
  }

  async createRedirectUri(
    appKey: string,
    input: CreateRedirectUriInput,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationRedirectUri>;
  async createRedirectUri(
    appKey: string,
    environmentId: string,
    input: CreateRedirectUriInput,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationRedirectUri>;
  async createRedirectUri(
    appKey: string,
    inputOrEnvironmentId: CreateRedirectUriInput | string,
    inputOrAuditContext?: CreateRedirectUriInput | OauthAuditContext,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationRedirectUri> {
    const input =
      typeof inputOrEnvironmentId === "string"
        ? (inputOrAuditContext as CreateRedirectUriInput)
        : inputOrEnvironmentId;
    const resolvedAuditContext =
      typeof inputOrEnvironmentId === "string"
        ? auditContext
        : (inputOrAuditContext as OauthAuditContext | undefined);

    return this.prisma.$transaction((tx) =>
      this.createRedirectUriInTransaction(
        appKey,
        input,
        tx,
        resolvedAuditContext,
      ),
    );
  }

  async createRedirectUriInTransaction(
    appKey: string,
    input: CreateRedirectUriInput,
    tx: Prisma.TransactionClient,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationRedirectUri> {
    assertRedirectUri(input.redirectUri);

    try {
      const application = await this.applications.getApplicationByKey(
        appKey,
        tx,
      );
      const created = await tx.applicationRedirectUri.create({
        data: {
          id: randomUUID(),
          applicationId: application.id,
          environmentId: null,
          redirectUri: input.redirectUri,
        },
      });

      await this.recordAudit(
        application.id,
        "application_redirect_uri",
        created.id,
        "create",
        undefined,
        created,
        tx,
        auditContext,
      );
      return created;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new OauthDomainError(
          "OAUTH_REDIRECT_URI_CONFLICT",
          "回调地址已存在",
          409,
        );
      }
      throw error;
    }
  }

  async listRedirectUris(
    appKey: string,
    environmentId?: string,
  ): Promise<ApplicationRedirectUri[]> {
    void environmentId;
    const application = await this.applications.getApplicationByKey(appKey);
    return this.prisma.applicationRedirectUri.findMany({
      where: {
        applicationId: application.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async disableRedirectUri(
    appKey: string,
    redirectUriId: string,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationRedirectUri> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(
        appKey,
        tx,
      );
      const current = await this.getRedirectUri(
        application.id,
        redirectUriId,
        tx,
      );
      const updated = await tx.applicationRedirectUri.update({
        where: {
          id: redirectUriId,
        },
        data: {
          status: "disabled",
        },
      });

      await this.recordAudit(
        application.id,
        "application_redirect_uri",
        updated.id,
        "disable",
        current,
        updated,
        tx,
        auditContext,
      );
      return updated;
    });
  }

  async createPrimaryOauthCredential(
    appKey: string,
    input: CreateOauthCredentialInput,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationClient & { clientSecret: string }> {
    return this.prisma.$transaction((tx) =>
      this.createPrimaryOauthCredentialInTransaction(
        appKey,
        input,
        tx,
        auditContext,
      ),
    );
  }

  async createPrimaryOauthCredentialInTransaction(
    appKey: string,
    input: CreateOauthCredentialInput,
    tx: Prisma.TransactionClient,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationClient & { clientSecret: string }> {
    const clientSecret = createOauthSecret("bics");
    const clientSecretHash = hashOauthSecret(clientSecret);
    const encryptedSecret = this.clientSecretVault.encrypt(clientSecret);

    try {
      const application = await this.applications.getApplicationByKey(
        appKey,
        tx,
      );
      await tx.applicationClient.updateMany({
        where: {
          applicationId: application.id,
          isPrimary: true,
          revokedAt: null,
        },
        data: {
          isPrimary: false,
        },
      });
      const created = await tx.applicationClient.create({
        data: {
          id: randomUUID(),
          applicationId: application.id,
          environmentId: null,
          clientId: createClientId(),
          clientSecretHash,
          clientSecretCiphertext: encryptedSecret.ciphertext,
          clientSecretIv: encryptedSecret.iv,
          clientSecretAuthTag: encryptedSecret.authTag,
          clientSecretAlgorithm: encryptedSecret.algorithm,
          name: input.name ?? "默认登录凭证",
          isPrimary: true,
        },
      });

      await this.recordAudit(
        application.id,
        "application_oauth_credential",
        created.id,
        "create",
        undefined,
        { ...removeClientSecretMaterial(created), secretShownOnce: true },
        tx,
        auditContext,
      );
      return {
        ...created,
        clientSecret,
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new OauthDomainError(
          "OAUTH_CLIENT_CONFLICT",
          "OAuth 凭证已存在",
          409,
        );
      }
      throw error;
    }
  }

  async createClient(
    appKey: string,
    environmentId: string,
    input: CreateClientInput,
    auditContext?: OauthAuditContext,
  ): Promise<ApplicationClient & { clientSecret: string }> {
    void environmentId;
    return this.createPrimaryOauthCredential(appKey, input, auditContext);
  }

  async listClients(
    appKey: string,
    environmentId?: string,
  ): Promise<SafeApplicationClient[]> {
    void environmentId;
    const application = await this.applications.getApplicationByKey(appKey);
    const clients = await this.prisma.applicationClient.findMany({
      where: {
        applicationId: application.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return clients.map(removeClientSecretMaterial);
  }

  async viewClientSecret(
    appKey: string,
    clientReference: string,
    auditContext?: OauthAuditContext,
  ): Promise<{ clientId: string; clientSecret: string }> {
    const viewed = await this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(
        appKey,
        tx,
      );
      const client = await this.getClient(application.id, clientReference, tx);
      const encryptedSecret = toEncryptedClientSecret(client);

      await this.recordAudit(
        application.id,
        "application_client",
        client.id,
        "view_secret",
        undefined,
        { clientId: client.clientId, secretViewed: true },
        tx,
        auditContext,
      );

      await this.securityEvents.record(
        {
          eventType: "secret_viewed",
          applicationId: application.id,
          clientId: client.clientId,
          result: "success",
          reasonCode: "CLIENT_SECRET_VIEWED",
          summary: "应用 client secret 被查看",
          ip: auditContext?.ip,
          userAgent: auditContext?.userAgent,
          requestId: auditContext?.requestId,
        },
        tx,
      );

      return {
        clientId: client.clientId,
        clientSecret: this.clientSecretVault.decrypt(encryptedSecret),
      };
    });

    return {
      clientId: viewed.clientId,
      clientSecret: viewed.clientSecret,
    };
  }

  async rotateClientSecret(
    appKey: string,
    clientReference: string,
    auditContext?: OauthAuditContext,
  ): Promise<{ clientId: string; clientSecret: string }> {
    return this.prisma.$transaction((tx) =>
      this.rotateClientSecretInTransaction(
        appKey,
        clientReference,
        tx,
        auditContext,
      ),
    );
  }

  async rotateClientSecretInTransaction(
    appKey: string,
    clientReference: string,
    tx: Prisma.TransactionClient,
    auditContext?: OauthAuditContext,
  ): Promise<{ clientId: string; clientSecret: string }> {
    const clientSecret = createOauthSecret("bics");
    const clientSecretHash = hashOauthSecret(clientSecret);
    const encryptedSecret = this.clientSecretVault.encrypt(clientSecret);

    const application = await this.applications.getApplicationByKey(appKey, tx);
    const current = await this.getClient(application.id, clientReference, tx);
    const updated = await tx.applicationClient.update({
      where: {
        applicationId_clientId: {
          applicationId: application.id,
          clientId: current.clientId,
        },
      },
      data: {
        clientSecretHash,
        clientSecretCiphertext: encryptedSecret.ciphertext,
        clientSecretIv: encryptedSecret.iv,
        clientSecretAuthTag: encryptedSecret.authTag,
        clientSecretAlgorithm: encryptedSecret.algorithm,
      },
    });

    await this.recordAudit(
      application.id,
      "application_client",
      updated.id,
      "rotate_secret",
      current,
      { ...updated, secretShownOnce: true },
      tx,
      auditContext,
    );

    await this.securityEvents.record(
      {
        eventType: "secret_rotated",
        applicationId: application.id,
        clientId: updated.clientId,
        result: "success",
        reasonCode: "CLIENT_SECRET_ROTATED",
        summary: "应用 client secret 已轮换",
        ip: auditContext?.ip,
        userAgent: auditContext?.userAgent,
        requestId: auditContext?.requestId,
      },
      tx,
    );

    return {
      clientId: updated.clientId,
      clientSecret,
    };
  }

  async setClientStatus(
    appKey: string,
    clientReference: string,
    status: OauthEntityStatus,
    auditContext?: OauthAuditContext,
  ): Promise<SafeApplicationClient> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(
        appKey,
        tx,
      );
      const current = await this.getClient(application.id, clientReference, tx);
      const updated = await tx.applicationClient.update({
        where: {
          applicationId_clientId: {
            applicationId: application.id,
            clientId: current.clientId,
          },
        },
        data: {
          status,
        },
      });

      await this.recordAudit(
        application.id,
        "application_client",
        updated.id,
        "set_status",
        current,
        updated,
        tx,
        auditContext,
      );
      return removeClientSecretMaterial(updated);
    });
  }

  private async getEnvironment(
    applicationId: string,
    environmentId: string,
    client: Pick<OauthConfigClient, "applicationEnvironment">,
  ): Promise<ApplicationEnvironment> {
    const environment = await client.applicationEnvironment.findFirst({
      where: {
        applicationId,
        id: environmentId,
      },
    });

    if (!environment) {
      throw new OauthDomainError(
        "OAUTH_ENVIRONMENT_NOT_FOUND",
        "应用环境不存在",
        404,
      );
    }

    return environment;
  }

  private async getRedirectUri(
    applicationId: string,
    redirectUriId: string,
    client: Pick<OauthConfigClient, "applicationRedirectUri">,
  ): Promise<ApplicationRedirectUri> {
    const redirectUri = await client.applicationRedirectUri.findFirst({
      where: {
        applicationId,
        id: redirectUriId,
      },
    });

    if (!redirectUri) {
      throw new OauthDomainError(
        "OAUTH_REDIRECT_URI_NOT_FOUND",
        "回调地址不存在",
        404,
      );
    }

    return redirectUri;
  }

  private async getClient(
    applicationId: string,
    clientReference: string,
    client: Pick<OauthConfigClient, "applicationClient">,
  ): Promise<ApplicationClient> {
    const applicationClient = await client.applicationClient.findFirst({
      where: {
        applicationId,
        OR: [{ id: clientReference }, { clientId: clientReference }],
      },
    });

    if (!applicationClient) {
      throw new OauthDomainError(
        "OAUTH_CLIENT_NOT_FOUND",
        "client 不存在",
        404,
      );
    }

    return applicationClient;
  }

  private async recordAudit(
    applicationId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    before: unknown,
    after: unknown,
    client: Prisma.TransactionClient,
    auditContext?: OauthAuditContext,
  ): Promise<void> {
    const actor = resolveAuditActor(auditContext);

    await this.audit.record(
      {
        ...actor,
        applicationId,
        resourceType,
        resourceId,
        action,
        before: redactClientSecretMaterial(before),
        after: redactClientSecretMaterial(after),
        result: "success",
        requestId: auditContext?.requestId,
        ip: auditContext?.ip,
        userAgent: auditContext?.userAgent,
      },
      client,
    );
  }
}

function resolveAuditActor(
  auditContext: OauthAuditContext | undefined,
): typeof SYSTEM_ACTOR {
  return {
    actorType: auditContext?.actorType ?? SYSTEM_ACTOR.actorType,
    actorId: auditContext?.actorId ?? SYSTEM_ACTOR.actorId,
    source: auditContext?.source ?? SYSTEM_ACTOR.source,
  };
}

function createClientId(): string {
  return `bic_${randomUUID().replaceAll("-", "")}`;
}

function removeClientSecretMaterial(
  client: ApplicationClient,
): SafeApplicationClient {
  const {
    clientSecretHash,
    clientSecretCiphertext,
    clientSecretIv,
    clientSecretAuthTag,
    clientSecretAlgorithm,
    ...safeClient
  } = client;
  void clientSecretHash;
  void clientSecretCiphertext;
  void clientSecretIv;
  void clientSecretAuthTag;
  void clientSecretAlgorithm;
  return safeClient;
}

function redactClientSecretMaterial(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const {
    clientSecretHash,
    clientSecretCiphertext,
    clientSecretIv,
    clientSecretAuthTag,
    clientSecretAlgorithm,
    ...rest
  } = value;
  void clientSecretHash;
  void clientSecretCiphertext;
  void clientSecretIv;
  void clientSecretAuthTag;
  void clientSecretAlgorithm;
  return rest;
}

function toEncryptedClientSecret(
  client: ApplicationClient,
): EncryptedClientSecret {
  if (
    !client.clientSecretCiphertext ||
    !client.clientSecretIv ||
    !client.clientSecretAuthTag ||
    client.clientSecretAlgorithm !== "aes-256-gcm"
  ) {
    throw new OauthDomainError(
      "OAUTH_CLIENT_SECRET_NOT_VIEWABLE",
      "历史 secret 不可查看，请轮换后查看新 secret",
      409,
    );
  }

  return {
    ciphertext: client.clientSecretCiphertext,
    iv: client.clientSecretIv,
    authTag: client.clientSecretAuthTag,
    algorithm: client.clientSecretAlgorithm,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
