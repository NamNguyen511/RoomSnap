# RoomSnap

Photograph a room and get a list of the objects in it. RoomSnap is a mobile
web app (installable as a PWA): object detection runs in the browser, and
scans are saved per room with CSV and PDF export.

## Setup

Requires Node.js 22.

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
npm run db:migrate            # creates data/roomsnap.db
npm run dev                   # http://localhost:3000
```

Create an account, add a room, then choose **New scan**.

### Trying it on a phone

The camera and the service worker need HTTPS, and a phone cannot reach WSL's
`localhost`, so expose the dev server through a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

The offline features (installing, detecting without a connection) only exist
in a production build: `npm run build && npm start`.

## How it works

- **Detection** uses YOLO-World v2 (small), run in the browser with ONNX
  Runtime Web (`src/lib/detector/yolo.ts`). YOLO-World finds objects
  described by words; RoomSnap's 66-word list (room furniture such as lamp,
  desk, shelf, rug, curtain, pillow and picture frame, plus household objects
  such as chair, couch, tv, laptop and potted plant) is built into the model
  by `scripts/export-yolo-world.py`. Edit the list there and re-run it to
  change what the app looks for; nothing is trained. Objects it is at least
  25% sure of are reported. The weights (about 50 MB) are served from
  `public/models/` and cached by the service worker after first use, so
  detection keeps working offline. The photo is only uploaded when a scan is
  saved.
- **Live camera** (`src/components/LiveCamera.tsx`): the preview draws boxes
  while you aim, and Capture analyses the still with the same model at the
  same size, so the preview shows what the scan will
  contain. On Android
  Chrome the still is a full-resolution photo; on iPhone it is a video frame,
  so the phone's camera app (the second button) gives better quality in dim
  rooms. Browsers offer no HDR or night mode on a video stream.
- **Saving offline** (`src/lib/pendingScans.ts`,
  `src/components/PendingScans.tsx`): if the server can't be reached, the scan
  is stored on the device (IndexedDB) and uploaded when the connection
  returns, the app is reopened, or "Upload now" is pressed. Each scan carries
  an id chosen on the device, so a retried upload is never stored twice. A
  scan the server refuses (for example, its room was deleted) stays in the
  list with the reason until it is retried or discarded. Unsent scans exist
  only on that device: clearing the browser's data loses them, and logging
  out deletes them after a warning. iPhones don't upload in the background,
  so there the upload happens the next time the app is opened.
- **Anything the model misses** can be added by drawing a box, and any
  result can be renamed or removed.
- **Where detection runs**: on the graphics chip through WebGPU where the
  browser has it, otherwise on the processor (slower, so live boxes lag). The
  scan page says which one is in use.
- **Swapping the model**: implement the `Detector` interface in
  `src/lib/detector/types.ts` and export it from `src/lib/detector/index.ts`.
  Any YOLOv8-style detection model exported to ONNX works with
  `createYoloDetector`.
- **Storage**: SQLite through Prisma (`prisma/schema.prisma`); photos on disk
  under `data/uploads/<userId>/`, served only to their owner. Both live in
  `data/`, which is not committed.
- **Accounts**: Auth.js with email and password (`src/auth.ts`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against a production build on port 3100, using a throwaway database in `data/e2e/`. First run: `npx playwright install chromium` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply database migrations |
| `node scripts/make-icons.mjs` | Regenerate the PWA icons |

## Not in this version

- Production hosting. SQLite and local-disk photos suit a single server; a
  hosted deployment would move to Postgres and object storage.
- Login rate limiting and password reset.

## Third-party assets

- YOLO-World weights (`public/models/yolo-world-room/`): AGPL-3.0, from
  Ultralytics. Distributing the app with this model, or offering it as a
  service, brings AGPL obligations for the app.
- ONNX Runtime Web (copied to `public/ort/` on install): MIT.
- Noto Sans (`public/fonts/`): SIL Open Font License, see `public/fonts/OFL.txt`.
- Test photo (`e2e/fixtures/`): CC0, see `e2e/fixtures/README.md`.
