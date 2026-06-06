import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App as SupertestApp } from "supertest/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VersionController } from "../src/version/version.controller";

describe("VersionController", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VersionController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("默认开发版本为 1.0.0-dev", async () => {
    const hadOriginalVersion = Object.prototype.hasOwnProperty.call(
      process.env,
      "APP_VERSION",
    );
    const originalVersion = process.env.APP_VERSION;

    try {
      delete process.env.APP_VERSION;

      const response = await request(app.getHttpServer() as SupertestApp)
        .get("/version")
        .expect(200);

      expect(response.body).toEqual({
        name: "feishu-iam-api",
        version: "1.0.0-dev",
        commit: process.env.GIT_COMMIT ?? "local",
        node_env: process.env.NODE_ENV ?? "development",
      });
    } finally {
      if (hadOriginalVersion) {
        process.env.APP_VERSION = originalVersion;
      } else {
        delete process.env.APP_VERSION;
      }
    }
  });
});
