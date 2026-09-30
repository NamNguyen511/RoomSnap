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

- **Detection** uses TensorFlow.js with the COCO-SSD model
  (`src/lib/detector/cocoSsd.ts`). The weights are served from
  `public/models/` and cached by the service worker after first use, so
  detection keeps working offline. The photo is only uploaded when a scan is
  saved.
- **The model knows 80 categories** (chair, couch, bed, dining table, tv,
  laptop, potted plant, book, clock, vase, refrigerator…). It does not find
  lamps, shelves, desks, rugs or curtains, and only reports objects it is at
  least 50% sure of. Anything it misses can be added by drawing a box, and any
  result can be renamed or removed.
- **Two more models** can be picked on the scan page, both run with ONNX
  Runtime Web (`src/lib/detector/yolo.ts`) and only downloaded if selected:
  - *YOLOv8*: YOLOv8n trained on COCO, the same 80 categories. On the test
    photo it finds everything the standard model does plus the three plants,
    with higher confidence. About 27 MB to download the first time.
  - *Open Images (experimental)*: YOLOv8n trained on Open Images V7 (about
    600 categories, including lamps, shelves and curtains). On the test photo
    it is less accurate than either 80-category model: it reports low
    confidence throughout, so its threshold is 15%, and it mislabels more.
- **Adding a model**: implement the `Detector` interface in
  `src/lib/detector/types.ts` and add it to the list in
  `src/lib/detector/index.ts`. Any YOLOv8 detection model exported to ONNX
  works with `createYoloDetector`.
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

- Live camera viewfinder (the app uses the phone's own camera screen).
- Saving scans while offline: detection works offline, saving waits for a
  connection.
- Production hosting. SQLite and local-disk photos suit a single server; a
  hosted deployment would move to Postgres and object storage.
- Login rate limiting and password reset.

## Third-party assets

- COCO-SSD model weights (`public/models/coco-ssd/`): Apache-2.0, from the
  TensorFlow.js models project.
- YOLOv8n weights (`public/models/yolov8n-coco/` and
  `public/models/yolov8n-oiv7/`): AGPL-3.0, from Ultralytics. Distributing the
  app with these models, or offering it as a service, brings AGPL
  obligations; delete the folders and their entries in
  `src/lib/detector/index.ts` to avoid them.
- ONNX Runtime Web (copied to `public/ort/` on install): MIT.
- Noto Sans (`public/fonts/`): SIL Open Font License, see `public/fonts/OFL.txt`.
- Test photo (`e2e/fixtures/`): CC0, see `e2e/fixtures/README.md`.
