import type { OrvalConfig } from "orval";

const config: OrvalConfig = {
  fxtwitter: {
    input: {
      target: "./openapi/fxtwitter.status-only.openapi.json",
    },
    output: {
      target: "./src/fxtwitter/generated/fxtwitter.ts",
      schemas: {
        path: "./src/fxtwitter/generated/model",
        type: "zod",
      },
      client: "fetch",
      mode: "tags",
      baseUrl: "https://api.fxtwitter.com",
    },
    override: {
      fetch: {
        runtimeValidation: true,
        includeHttpResponseReturnType: false,
      },
      zod: {
        generateReusableSchemas: true,
      },
    },
  },
  vxtwitter: {
    input: {
      target: "./openapi/vxtwitter.openapi.yaml",
    },
    output: {
      target: "./src/vxtwitter/generated/vxtwitter.ts",
      schemas: {
        path: "./src/vxtwitter/generated/model",
        type: "zod",
      },
      client: "fetch",
      mode: "tags",
      baseUrl: "https://api.vxtwitter.com",
    },
    override: {
      fetch: {
        runtimeValidation: true,
        includeHttpResponseReturnType: false,
      },
      zod: {
        generateReusableSchemas: true,
      },
    },
  },
};

export default config;
