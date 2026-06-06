import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Req, UseFilters, UseGuards } from '@nestjs/common';
import { PermissionCatalogService } from '../permission/permission-catalog.service';
import { PermissionErrorFilter } from '../permission/permission-error.filter';
import { PermissionDomainError, type PermissionAuditContext } from '../permission/permission.types';
import type { DeveloperApiRequest } from './developer-api.guard';
import { DeveloperApiGuard } from './developer-api.guard';
import { OauthErrorFilter } from './oauth-error.filter';
import { getOauthRequestId } from './oauth-request-context';
import { OauthDomainError } from './oauth.types';

type CatalogCreateBody = {
  key: string;
  name: string;
  description?: string;
};

type CatalogUpdateBody = {
  key?: string;
  name?: string;
  description?: string | null;
};

@Controller('/api/v1/developer')
@UseGuards(DeveloperApiGuard)
@UseFilters(OauthErrorFilter, PermissionErrorFilter)
export class DeveloperPermissionController {
  constructor(@Inject(PermissionCatalogService) private readonly catalog: PermissionCatalogService) {}

  @Get('/permission-points')
  async listPermissionPoints(@Req() request: DeveloperApiRequest) {
    return this.listPermissionPointsForApp(request);
  }

  @Get('/apps/:appKey/permission-points')
  async listAppPermissionPoints(@Req() request: DeveloperApiRequest, @Param('appKey') appKey: string) {
    return this.listPermissionPointsForApp(request, appKey);
  }

  @Post('/permission-points')
  async createPermissionPoint(@Req() request: DeveloperApiRequest, @Body() body: unknown) {
    return this.createPermissionPointForApp(request, body);
  }

  @Post('/apps/:appKey/permission-points')
  async createAppPermissionPoint(
    @Req() request: DeveloperApiRequest,
    @Param('appKey') appKey: string,
    @Body() body: unknown
  ) {
    return this.createPermissionPointForApp(request, body, appKey);
  }

  @Patch('/permission-points/:pointId')
  async updatePermissionPoint(
    @Req() request: DeveloperApiRequest,
    @Param('pointId') pointId: string,
    @Body() body: unknown
  ) {
    return this.updatePermissionPointForApp(request, pointId, body);
  }

  @Patch('/apps/:appKey/permission-points/:pointId')
  async updateAppPermissionPoint(
    @Req() request: DeveloperApiRequest,
    @Param('appKey') appKey: string,
    @Param('pointId') pointId: string,
    @Body() body: unknown
  ) {
    return this.updatePermissionPointForApp(request, pointId, body, appKey);
  }

  @Post('/permission-points/:pointId/disable')
  async disablePermissionPoint(@Req() request: DeveloperApiRequest, @Param('pointId') pointId: string) {
    return this.disablePermissionPointForApp(request, pointId);
  }

  @Post('/apps/:appKey/permission-points/:pointId/disable')
  async disableAppPermissionPoint(
    @Req() request: DeveloperApiRequest,
    @Param('appKey') appKey: string,
    @Param('pointId') pointId: string
  ) {
    return this.disablePermissionPointForApp(request, pointId, appKey);
  }

  @Get('/permission-groups')
  async listPermissionGroups(@Req() request: DeveloperApiRequest) {
    return this.listPermissionGroupsForApp(request);
  }

  @Get('/apps/:appKey/permission-groups')
  async listAppPermissionGroups(@Req() request: DeveloperApiRequest, @Param('appKey') appKey: string) {
    return this.listPermissionGroupsForApp(request, appKey);
  }

  @Post('/permission-groups')
  async createPermissionGroup(@Req() request: DeveloperApiRequest, @Body() body: unknown) {
    return this.createPermissionGroupForApp(request, body);
  }

  @Post('/apps/:appKey/permission-groups')
  async createAppPermissionGroup(
    @Req() request: DeveloperApiRequest,
    @Param('appKey') appKey: string,
    @Body() body: unknown
  ) {
    return this.createPermissionGroupForApp(request, body, appKey);
  }

  @Patch('/permission-groups/:groupId')
  async updatePermissionGroup(
    @Req() request: DeveloperApiRequest,
    @Param('groupId') groupId: string,
    @Body() body: unknown
  ) {
    return this.updatePermissionGroupForApp(request, groupId, body);
  }

  @Patch('/apps/:appKey/permission-groups/:groupId')
  async updateAppPermissionGroup(
    @Req() request: DeveloperApiRequest,
    @Param('appKey') appKey: string,
    @Param('groupId') groupId: string,
    @Body() body: unknown
  ) {
    return this.updatePermissionGroupForApp(request, groupId, body, appKey);
  }

  @Post('/permission-groups/:groupId/disable')
  async disablePermissionGroup(@Req() request: DeveloperApiRequest, @Param('groupId') groupId: string) {
    return this.disablePermissionGroupForApp(request, groupId);
  }

  @Post('/apps/:appKey/permission-groups/:groupId/disable')
  async disableAppPermissionGroup(
    @Req() request: DeveloperApiRequest,
    @Param('appKey') appKey: string,
    @Param('groupId') groupId: string
  ) {
    return this.disablePermissionGroupForApp(request, groupId, appKey);
  }

  @Put('/permission-groups/:groupId/points')
  async replacePermissionGroupPoints(
    @Req() request: DeveloperApiRequest,
    @Param('groupId') groupId: string,
    @Body() body: unknown
  ) {
    return this.replacePermissionGroupPointsForApp(request, groupId, body);
  }

  @Put('/apps/:appKey/permission-groups/:groupId/points')
  async replaceAppPermissionGroupPoints(
    @Req() request: DeveloperApiRequest,
    @Param('appKey') appKey: string,
    @Param('groupId') groupId: string,
    @Body() body: unknown
  ) {
    return this.replacePermissionGroupPointsForApp(request, groupId, body, appKey);
  }

  private async listPermissionPointsForApp(request: DeveloperApiRequest, appKey?: string) {
    return { items: await this.catalog.listPermissionPoints(resolveDeveloperAppKey(request, appKey)) };
  }

  private async createPermissionPointForApp(request: DeveloperApiRequest, body: unknown, appKey?: string) {
    return this.catalog.createPermissionPoint(
      resolveDeveloperAppKey(request, appKey),
      readCatalogCreateBody(body, 'PERMISSION_POINT_BODY_INVALID', '权限点请求体不合法'),
      buildDeveloperAuditContext(request)
    );
  }

  private async updatePermissionPointForApp(
    request: DeveloperApiRequest,
    pointId: string,
    body: unknown,
    appKey?: string
  ) {
    return this.catalog.updatePermissionPoint(
      resolveDeveloperAppKey(request, appKey),
      pointId,
      readCatalogUpdateBody(body, 'PERMISSION_POINT_BODY_INVALID', '权限点请求体不合法'),
      buildDeveloperAuditContext(request)
    );
  }

  private async disablePermissionPointForApp(request: DeveloperApiRequest, pointId: string, appKey?: string) {
    return this.catalog.setPermissionPointStatus(
      resolveDeveloperAppKey(request, appKey),
      pointId,
      'disabled',
      buildDeveloperAuditContext(request)
    );
  }

  private async listPermissionGroupsForApp(request: DeveloperApiRequest, appKey?: string) {
    return { items: await this.catalog.listPermissionGroups(resolveDeveloperAppKey(request, appKey)) };
  }

  private async createPermissionGroupForApp(request: DeveloperApiRequest, body: unknown, appKey?: string) {
    return this.catalog.createPermissionGroup(
      resolveDeveloperAppKey(request, appKey),
      readCatalogCreateBody(body, 'PERMISSION_GROUP_BODY_INVALID', '权限组请求体不合法'),
      buildDeveloperAuditContext(request)
    );
  }

  private async updatePermissionGroupForApp(
    request: DeveloperApiRequest,
    groupId: string,
    body: unknown,
    appKey?: string
  ) {
    return this.catalog.updatePermissionGroup(
      resolveDeveloperAppKey(request, appKey),
      groupId,
      readCatalogUpdateBody(body, 'PERMISSION_GROUP_BODY_INVALID', '权限组请求体不合法'),
      buildDeveloperAuditContext(request)
    );
  }

  private async disablePermissionGroupForApp(request: DeveloperApiRequest, groupId: string, appKey?: string) {
    return this.catalog.setPermissionGroupStatus(
      resolveDeveloperAppKey(request, appKey),
      groupId,
      'disabled',
      buildDeveloperAuditContext(request)
    );
  }

  private async replacePermissionGroupPointsForApp(
    request: DeveloperApiRequest,
    groupId: string,
    body: unknown,
    appKey?: string
  ) {
    await this.catalog.replacePermissionGroupPoints(
      resolveDeveloperAppKey(request, appKey),
      groupId,
      readReplaceGroupPointsBody(body),
      buildDeveloperAuditContext(request)
    );
    return { ok: true };
  }
}

function getDeveloperCredential(request: DeveloperApiRequest) {
  if (!request.developerCredential) {
    throw new PermissionDomainError('DEVELOPER_CREDENTIAL_CONTEXT_MISSING', '开发者 API 凭证上下文缺失', 401);
  }

  return request.developerCredential;
}

function resolveDeveloperAppKey(request: DeveloperApiRequest, pathAppKey?: string): string {
  const credential = getDeveloperCredential(request);
  if (pathAppKey !== undefined && pathAppKey !== credential.appKey) {
    throw new OauthDomainError('DEVELOPER_PERMISSION_DENIED', '开发者 API 凭证无权管理该应用', 403);
  }

  return credential.appKey;
}

function buildDeveloperAuditContext(request: DeveloperApiRequest): PermissionAuditContext {
  const credential = getDeveloperCredential(request);
  return {
    actorType: 'application_developer_credential',
    actorId: credential.credentialId,
    source: 'developer_api',
    requestId: getOauthRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}

function readCatalogCreateBody(value: unknown, code: string, message: string): CatalogCreateBody {
  const body = readRecord(value, code, message);
  const key = readRequiredString(body.key, code, message);
  const name = readRequiredString(body.name, code, message);
  const description = readOptionalString(body.description, code, message);
  return description === undefined ? { key, name } : { key, name, description };
}

function readCatalogUpdateBody(value: unknown, code: string, message: string): CatalogUpdateBody {
  const body = readRecord(value, code, message);
  const output: CatalogUpdateBody = {};

  if (body.key !== undefined) {
    output.key = readRequiredString(body.key, code, message);
  }
  if (body.name !== undefined) {
    output.name = readRequiredString(body.name, code, message);
  }
  if (body.description !== undefined) {
    output.description = body.description === null ? null : readRequiredString(body.description, code, message);
  }

  return output;
}

function readReplaceGroupPointsBody(value: unknown): string[] {
  const body = readRecord(value, 'PERMISSION_GROUP_POINTS_BODY_INVALID', '权限组绑定请求体不合法');
  if (!isNonEmptyStringArray(body.pointIds)) {
    throw new PermissionDomainError('PERMISSION_GROUP_POINTS_BODY_INVALID', '权限组绑定请求体不合法', 422);
  }

  return body.pointIds.map((pointId) => pointId.trim());
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function readRecord(value: unknown, code: string, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PermissionDomainError(code, message, 422);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, code: string, message: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PermissionDomainError(code, message, 422);
  }

  return value.trim();
}

function readOptionalString(value: unknown, code: string, message: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readRequiredString(value, code, message);
}
