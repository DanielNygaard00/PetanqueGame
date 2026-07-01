import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations("migrations");
  return {
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            d1Databases: ["DB"],
            bindings: { JWT_SECRET: "test-secret" },
          },
          singleWorker: true,
        },
      },
      provide: {
        d1Migrations: migrations,
      },
    },
  };
});
