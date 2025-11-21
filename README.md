## Customer Anonymization Service

The repository contains two applications:

- `app.ts` — an online-store emulator that continuously creates customers and writes them into the `customers` collection.
- `sync.ts` — a synchronization service that copies documents from `customers` to `customers_anonymised` with deterministic anonymization of sensitive fields. Supports both real-time mode and full reindexing.

### Environment Requirements

- Node.js 18+
- MongoDB with replication enabled (a `replicaSet` is sufficient even on a local machine for change streams).

### Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set the MongoDB connection string in the `DB_URI` variable.

### Scripts

- `npm run app` — starts the customer generator. Every 200 ms new records are inserted into the `customers` collection in batches of 1–10 documents.
- `npm run sync` — enables real-time synchronization. The service listens for inserts and updates, anonymizes the data, and writes it to `customers_anonymised` in batches of 1,000 documents. If 1,000 records are not accumulated within 1 second, the current buffer is flushed.
- `npm run sync:full` — performs a full reindex of all documents from `customers` to `customers_anonymised` and then exits.
- `npm run format` / `npm run format:fix` — checks and auto-formats the sources using Prettier.

### Implementation Details

- Anonymization uses a deterministic pseudo-random token of length 8 (`[a-zA-Z0-9]`), based on SHA‑256 of the original value plus the field name. This guarantees identical replacements for identical inputs.
- The fields `firstName`, `lastName`, the part of e-mail before `@`, `address.line1`, `address.line2`, and `address.postcode` are replaced; other fields are copied as-is.
- The real-time service stores the last `resumeToken` in the `sync_state` collection. When restarted, the application resumes the change stream from the saved point and does not skip events.
- Synchronization uses `bulkWrite` with `replaceOne`/`upsert`, so the real-time and full reindexing modes can run in parallel.
- When finishing due to `SIGINT`/`SIGTERM`, both applications close connections cleanly. The synchronizer additionally flushes the remaining buffer.

### Diagnostics

- Check formatting: `npm run format`
- Update formatting: `npm run format:fix`
