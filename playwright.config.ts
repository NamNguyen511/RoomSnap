import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Chromium's fake camera plays an MJPEG file; a single JPEG is a valid one,
// so the live-camera test "sees" the fixture living room.
const fakeCameraDir = path.resolve("node_modules/.cache/roomsnap");
const fakeCameraVideo = path.join(fakeCameraDir, "living-room.mjpeg");
mkdirSync(fakeCameraDir, { recursive: true });
copyFileSync(path.resolve("e2e/fixtures/living-room.jpg"), fakeCameraVideo);

const cameraArgs = [
  "--use-fake-ui-for-media-stream", // grant the camera without a prompt
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-video-capture=${fakeCameraVideo}`,
];

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
  projects: [
    {
      // The headless browser has no WebGPU here, so this covers the
      // processor path that phones without WebGPU take.
      name: "default",
      use: { launchOptions: { args: cameraArgs } },
    },
    {
      // The detection test again with a (software) WebGPU adapter, to cover
      // the graphics-chip path. Emulated WebGPU takes about a minute per
      // image, too slow for the live-camera test.
      name: "webgpu",
      grep: /YOLO-World model finds room objects/,
      use: {
        launchOptions: {
          args: [
            ...cameraArgs,
            "--enable-unsafe-webgpu",
            "--enable-features=Vulkan",
            "--use-angle=swiftshader",
            "--use-webgpu-adapter=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
  ],
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
