import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Runs against a production build with its own throwaway database and
// upload folder, so tests never touch development data.
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `rm -rf data/e2e && npx prisma migrate deploy && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "file:../data/e2e/e2e.db",
      UPLOAD_DIR: "data/e2e/uploads",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
