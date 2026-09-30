import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

const PHOTO = path.join(__dirname, "fixtures", "living-room.jpg");
const PASSWORD = "correct-horse-battery";
// Things the model should find in the fixture photo.
const EXPECTED_LABELS = ["couch", "chair", "tv", "potted plant"];

const uniqueEmail = (name: string) => `${name}-${Date.now()}@example.com`;

/** Set E2E_SHOTS=<dir> to keep full-page screenshots for a visual check. */
async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/rooms$/);
}

// The app refuses software-emulated WebGPU adapters because they are slower
// than the processor, and that is the only kind the test browser has. In the
// "webgpu" project, present it as a real one so the WebGPU code path runs.
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name !== "webgpu") return;
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpu = (navigator as any).gpu;
    if (!gpu) return;
    const requestAdapter = gpu.requestAdapter.bind(gpu);
    gpu.requestAdapter = async (...args: unknown[]) => {
      const adapter = await requestAdapter(...args);
      if (adapter) {
        const info = adapter.info ?? {};
        Object.defineProperty(adapter, "info", {
          value: new Proxy(info, {
            get: (target, key) =>
              key === "isFallbackAdapter" ? false : target[key],
          }),
        });
        Object.defineProperty(adapter, "isFallbackAdapter", { value: false });
      }
      return adapter;
    };
  });
});

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/rooms");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("scan a room, edit, save, export, and keep it private", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("owner");
  await register(page, email);

  // Create a room (accented name exercises the PDF font and CSV encoding).
  await page.getByLabel("Room name").fill("Phòng khách");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name: "Phòng khách" })).toBeVisible();
  const roomUrl = page.url();

  // Capture and detect.
  await page.getByRole("link", { name: "New scan" }).click();
  await page.getByTestId("library-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("object-box").first()).toBeVisible({
    timeout: 90_000,
  });
  const detected = await page.getByTestId("object-row").allTextContents();
  console.log("Detected:", detected);
  expect(
    detected.some((row) => EXPECTED_LABELS.some((l) => row.startsWith(l))),
  ).toBe(true);
  const aiCount = detected.length;
  await expect(page.getByTestId("object-box")).toHaveCount(aiCount);

  // Add an object the model cannot find by drawing a box.
  await page.getByRole("button", { name: "Add object" }).click();
  const overlay = (await page.getByTestId("box-overlay").boundingBox())!;
  await page.mouse.move(overlay.x + overlay.width * 0.52, overlay.y + overlay.height * 0.33);
  await page.mouse.down();
  await page.mouse.move(overlay.x + overlay.width * 0.58, overlay.y + overlay.height * 0.76, { steps: 5 });
  await page.mouse.up();
  await page.getByLabel("Name of the new object").fill("lamp");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByTestId("object-row")).toHaveCount(aiCount + 1);
  await expect(
    page.getByTestId("object-row").filter({ hasText: "lamp" }),
  ).toContainText("added by hand");
  await shot(page, "review");

  // Save, then confirm it survives a reload.
  await page.getByRole("button", { name: "Save scan" }).click();
  await expect(page).toHaveURL(/\/scans\/[\w-]+$/);
  const scanUrl = page.url();
  const scanId = scanUrl.split("/").pop()!;
  await page.reload();
  await expect(page.getByTestId("object-row")).toHaveCount(aiCount + 1);
  await expect(page.getByTestId("object-box")).toHaveCount(aiCount + 1);

  // Edit the saved scan: remove the lamp again and save.
  await page.getByTestId("object-row").filter({ hasText: "lamp" }).click();
  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeHidden();
  await page.reload();
  await expect(page.getByTestId("object-row")).toHaveCount(aiCount);

  // Room page lists the scan; exports work.
  await page.goto(roomUrl);
  await expect(page.getByText(`${aiCount} object`)).toBeVisible();
  await shot(page, "room");

  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export CSV" }).click(),
  ]);
  const csv = await readFile(await csvDownload.path(), "utf8");
  const csvLines = csv.trim().split("\r\n");
  expect(csvLines[0]).toBe(
    "room,scan_id,scan_date,label,confidence,source,x,y,width,height",
  );
  expect(csvLines).toHaveLength(aiCount + 1);
  expect(csvLines[1]).toContain("Phòng khách");
  expect(csvLines[1]).toContain(scanId);

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toBe("phong-khach-inventory.pdf");
  const pdf = await readFile(await pdfDownload.path());
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(20_000);
  if (process.env.E2E_KEEP_PDF) await pdfDownload.saveAs(process.env.E2E_KEEP_PDF);

  // Logging out and back in shows the same data.
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong email or password")).toBeVisible();
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Phòng khách")).toBeVisible();
  await shot(page, "rooms");

  // Another account cannot see the room, the scan, its photo or its export.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await register(other, uniqueEmail("other"));
  await expect(other.getByText("Phòng khách")).toHaveCount(0);
  for (const url of [
    roomUrl,
    scanUrl,
    `/api/scans/${scanId}/image`,
    `/api/rooms/${roomUrl.split("/").pop()}/export.csv`,
  ]) {
    expect((await other.request.get(url)).status(), url).toBe(404);
  }
  const put = await other.request.put(`/api/scans/${scanId}`, {
    data: { objects: [] },
  });
  expect(put.status()).toBe(404);
  await otherContext.close();

  // The owner still can.
  expect((await page.request.get(`/api/scans/${scanId}/image`)).status()).toBe(200);
});

test("rejects uploads that are not images", async ({ page }) => {
  await register(page, uniqueEmail("uploader"));
  await page.getByLabel("Room name").fill("Office");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name: "Office" })).toBeVisible();
  const roomId = page.url().split("/").pop()!;

  const res = await page.request.post("/api/scans", {
    multipart: {
      roomId,
      width: "10",
      height: "10",
      modelName: "test",
      objects: "[]",
      image: {
        name: "photo.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("<script>alert(1)</script> definitely not a jpeg"),
      },
    },
  });
  expect(res.status()).toBe(415);
});

test("detects objects offline once the app has been used online", async ({
  page,
  context,
}) => {
  await register(page, uniqueEmail("offline"));
  await page.getByLabel("Room name").fill("Bedroom");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name: "Bedroom" })).toBeVisible();
  const scanPage = `${page.url()}/scan`;

  // First visit online, with the service worker in control: this caches the
  // page and, by running one detection, the model weights.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto(scanPage);
  await page.getByTestId("library-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("object-box").first()).toBeVisible({
    timeout: 90_000,
  });

  await context.setOffline(true);
  await page.reload();
  await page.getByTestId("library-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("object-box").first()).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("Automatic detection isn't available")).toHaveCount(0);

  // Saving needs the server, and says so.
  await page.getByRole("button", { name: "Save scan" }).click();
  await expect(page.getByText("You're offline. Reconnect to save this scan.")).toBeVisible();

  // Back online, the same scan saves without retaking the photo.
  await context.setOffline(false);
  await page.getByRole("button", { name: "Save scan" }).click();
  await expect(page).toHaveURL(/\/scans\/[\w-]+$/);

  // Deleting the scan also removes its photo from the offline cache.
  const photoUrl = new URL(`/api/scans/${page.url().split("/").pop()}/image`, page.url()).href;
  const photoIsCached = () =>
    page.evaluate(async (url) => (await caches.match(url)) !== undefined, photoUrl);
  await expect.poll(photoIsCached).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete scan" }).click();
  await expect(page.getByRole("heading", { name: "Bedroom" })).toBeVisible();
  await expect.poll(photoIsCached).toBe(false);

  // Logging out drops this account's cached pages and photos, but keeps the
  // model so the next sign-in doesn't download it again.
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  expect(await page.evaluate(() => caches.keys())).toContain("detection-model");
  const privateUrls = () =>
    page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(request.url);
      }
      // Built assets under /_next/ are the app's own code, not account data.
      return urls.filter((u) => !u.includes("/_next/") && /\/(rooms|scans)/.test(u));
    });
  await expect.poll(privateUrls).toEqual([]);
});

test("the Open Images model can be chosen and is remembered", async ({ page }) => {
  await register(page, uniqueEmail("oiv7"));
  await page.getByLabel("Room name").fill("Study");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("link", { name: "New scan" }).click();

  await page.getByLabel("Detection model").selectOption("yolov8n-oiv7");
  const started = Date.now();
  await page.getByTestId("library-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("object-box").first()).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("Automatic detection isn't available")).toHaveCount(0);
  const detected = await page.getByTestId("object-row").allTextContents();
  console.log(`Open Images detected in ${Date.now() - started} ms:`, detected);
  // Scene and people labels are filtered out.
  expect(detected.some((row) => /^(house|person|furniture)\d/.test(row))).toBe(false);
  await shot(page, "review-oiv7");

  await page.getByRole("button", { name: "Save scan" }).click();
  await expect(page).toHaveURL(/\/scans\/[\w-]+$/);
  await expect(page.getByTestId("object-row")).toHaveCount(detected.length);

  // The choice sticks for the next scan.
  await page.goBack();
  await page.reload();
  await expect(page.getByLabel("Detection model")).toHaveValue("yolov8n-oiv7");
});

test("the YOLOv8 model finds the furniture and the plants", async ({ page }) => {
  await register(page, uniqueEmail("yolo"));
  await page.getByLabel("Room name").fill("Lounge");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("link", { name: "New scan" }).click();

  await page.getByLabel("Detection model").selectOption("yolov8n-coco");
  const started = Date.now();
  await page.getByTestId("library-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("object-box").first()).toBeVisible({
    timeout: 90_000,
  });
  const detected = await page.getByTestId("object-row").allTextContents();
  console.log(`YOLOv8 detected in ${Date.now() - started} ms:`, detected);
  for (const label of EXPECTED_LABELS) {
    expect(detected.some((row) => row.startsWith(label)), label).toBe(true);
  }
  await shot(page, "review-yolov8n");

  await page.getByRole("button", { name: "Save scan" }).click();
  await expect(page).toHaveURL(/\/scans\/[\w-]+$/);
  await expect(page.getByTestId("object-row")).toHaveCount(detected.length);
});

test("the app can be installed", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => navigator.serviceWorker.ready);

  // Ask Chrome itself whether it would offer to install the app.
  const cdp = await page.context().newCDPSession(page);
  const manifest = await cdp.send("Page.getAppManifest");
  expect(manifest.errors).toEqual([]);
  expect(manifest.url).toContain("/manifest.webmanifest");
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);

  const parsed = JSON.parse(manifest.data ?? "{}");
  expect(parsed.display).toBe("standalone");
  for (const icon of parsed.icons) {
    expect((await page.request.get(icon.src)).status(), icon.src).toBe(200);
  }
});

// The preview runs whichever model is selected, so it matches the saved scan.
for (const model of ["coco-ssd", "yolov8n-coco"]) {
  test(`live camera shows ${model} boxes while aiming and captures a scan`, async ({ page }, testInfo) => {
    await register(page, uniqueEmail("live"));
    await page.getByLabel("Room name").fill("Den");
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByRole("link", { name: "New scan" }).click();
    await page.getByLabel("Detection model").selectOption(model);
    // The page says where the model runs. Only the "webgpu" project gives the
    // browser a WebGPU adapter; the standard model uses WebGL either way.
    const onGpu = model === "coco-ssd" || testInfo.project.name === "webgpu";
    await expect(page.getByTestId("model-backend")).toContainText(
      onGpu ? "graphics chip" : "processor",
      { timeout: 60_000 },
    );

    let started = Date.now();
    await page.getByRole("button", { name: "Open live camera" }).click();
    await expect(page.getByTestId("live-box").first()).toBeVisible({
      timeout: 90_000,
    });
    console.log(`[${model}] first live box after ${Date.now() - started} ms`);

    // The preview keeps detecting: count runs over three seconds.
    const preview = page.getByTestId("live-preview");
    const runs = async () => Number(await preview.getAttribute("data-detection-runs"));
    const before = await runs();
    await page.waitForTimeout(3000);
    const perSecond = ((await runs()) - before) / 3;
    const liveLabels = (await page.getByTestId("live-box").allTextContents()).sort();
    console.log(`[${model}/${testInfo.project.name}] ${perSecond.toFixed(1)} detections/s, live labels: ${liveLabels.join(", ")}`);
    // Software-emulated WebGPU in the test browser takes seconds per frame,
    // so only require that detection keeps going, not a particular speed.
    await expect.poll(runs, { timeout: 60_000 }).toBeGreaterThan(before);
    await shot(page, `live-${model}`);

    started = Date.now();
    await page.getByRole("button", { name: "Capture" }).click();
    await expect(page.getByTestId("object-box").first()).toBeVisible({
      timeout: 90_000,
    });
    console.log(`[${model}] captured and analysed in ${Date.now() - started} ms`);
    // The camera is released once the photo is taken.
    await expect(page.getByTestId("live-preview")).toHaveCount(0);

    // What the preview showed is what the scan contains.
    const scanLabels = (await page.getByTestId("object-box").allTextContents()).sort();
    expect(scanLabels).toEqual(liveLabels);

    await page.getByRole("button", { name: "Save scan" }).click();
    await expect(page).toHaveURL(/\/scans\/[\w-]+$/);
  });
}

test("falls back to the other options when the camera is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await register(page, uniqueEmail("nocam"));
  await page.getByLabel("Room name").fill("Attic");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("link", { name: "New scan" }).click();

  await page.getByRole("button", { name: "Open live camera" }).click();
  await expect(page.getByText("Camera access is blocked.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose an existing photo" })).toBeEnabled();

  // The file route still works.
  await page.getByTestId("library-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("object-box").first()).toBeVisible({
    timeout: 90_000,
  });
});
