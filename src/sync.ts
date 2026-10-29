import { Collection } from "mongodb";
import { anonymizeCustomer } from "./mask-manager";
import { ResumeTokenStore } from "./state-store";
import { BufferedChange, CustomerDocument, SyncStateDocument } from "./types";
import {
  COLLECTIONS,
  REALTIME,
  SYNC_STATE_KEY,
  FULL_REINDEX_BATCH_SIZE,
} from "./constants";
import { createMongoClient } from "./db";

const bulkUpsert = async (
  collection: Collection<CustomerDocument>,
  docs: CustomerDocument[],
): Promise<void> => {
  if (!docs.length) {
    return;
  }

  const operations = docs.map((doc) => ({
    replaceOne: {
      filter: { _id: doc._id },
      replacement: doc,
      upsert: true,
    },
  }));

  await collection.bulkWrite(operations, { ordered: false });
};

const runFullReindex = async (): Promise<void> => {
  console.log("Starting full reindex");
  const client = createMongoClient();

  try {
    await client.connect();

    const db = client.db();
    const source = db.collection<CustomerDocument>(COLLECTIONS.CUSTOMERS);
    const target = db.collection<CustomerDocument>(
      COLLECTIONS.CUSTOMERS_ANONYMIZED,
    );

    const cursor = source.find(
      {},
      { sort: { _id: 1 }, batchSize: FULL_REINDEX_BATCH_SIZE },
    );
    let batch: CustomerDocument[] = [];

    for await (const doc of cursor) {
      batch.push(doc);

      if (batch.length >= FULL_REINDEX_BATCH_SIZE) {
        const anonymized = batch.map(anonymizeCustomer);
        await bulkUpsert(target, anonymized);
        batch = [];
      }
    }

    if (batch.length > 0) {
      const anonymized = batch.map(anonymizeCustomer);
      await bulkUpsert(target, anonymized);
    }

    await cursor.close();
    console.log("Full reindex finished");
  } finally {
    await client.close();
  }
};

class ChangeBuffer {
  private readonly buffered: BufferedChange[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushPromise: Promise<void> | null = null;

  constructor(
    private readonly target: Collection<CustomerDocument>,
    private readonly tokenStore: ResumeTokenStore,
    private readonly batchSize: number,
    private readonly flushIntervalMs: number,
    private readonly onBackgroundFlushError: (error: unknown) => void,
  ) {}

  add(change: BufferedChange): Promise<void> {
    this.buffered.push(change);

    if (this.buffered.length >= this.batchSize) {
      return this.flush();
    }

    this.scheduleFlush();
    return Promise.resolve();
  }

  cancelTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  drain(): Promise<void> {
    this.cancelTimer();
    return this.flush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer || !this.buffered.length) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(this.onBackgroundFlushError);
    }, this.flushIntervalMs);

    this.flushTimer.unref?.();
  }

  private async flushInternal(): Promise<void> {
    while (this.buffered.length > 0) {
      const chunk = this.buffered.splice(
        0,
        Math.min(this.buffered.length, this.batchSize),
      );

      const docs = chunk.map((item) => item.document);
      await bulkUpsert(this.target, docs);

      const lastToken = chunk[chunk.length - 1]?.resumeToken;
      if (lastToken) {
        await this.tokenStore.save(lastToken);
      }
    }
  }

  private flush(): Promise<void> {
    if (!this.flushPromise) {
      if (!this.buffered.length) {
        return Promise.resolve();
      }

      this.flushPromise = (async () => {
        try {
          await this.flushInternal();
        } finally {
          this.flushPromise = null;
        }
      })();
    }

    return this.flushPromise;
  }
}

const runRealtimeSync = async (): Promise<void> => {
  console.log("Starting realtime sync");
  const client = createMongoClient();

  await client.connect();

  const db = client.db();
  const source = db.collection<CustomerDocument>(COLLECTIONS.CUSTOMERS);
  const target = db.collection<CustomerDocument>(
    COLLECTIONS.CUSTOMERS_ANONYMIZED,
  );
  const stateCollection = db.collection<SyncStateDocument>(
    COLLECTIONS.SYNC_STATE,
  );
  const tokenStore = new ResumeTokenStore(stateCollection, SYNC_STATE_KEY);

  const buffer = new ChangeBuffer(
    target,
    tokenStore,
    REALTIME.CHANGE_BATCH_SIZE,
    REALTIME.FLUSH_INTERVAL_MS,
    (error) => {
      console.error("Failed to flush buffered changes:", error);
      process.exit(1);
    },
  );

  let isShuttingDown = false;

  const resumeToken = await tokenStore.get();
  const changeStream = source.watch<CustomerDocument>(
    [
      {
        $match: {
          operationType: {
            $in: ["insert", "update", "replace"],
          },
        },
      },
    ],
    {
      fullDocument: "updateLookup",
      ...(resumeToken ? { resumeAfter: resumeToken } : {}),
    },
  );

  const shutdown = async (): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log("Stopping realtime sync...");

    try {
      await buffer.drain();
    } catch (error) {
      console.error("Error during final buffer flush:", error);
    }

    await changeStream.close();
    await client.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    for await (const change of changeStream) {
      if (
        change.operationType !== "insert" &&
        change.operationType !== "update" &&
        change.operationType !== "replace"
      ) {
        continue;
      }

      if (!change.fullDocument) {
        continue;
      }

      const document = anonymizeCustomer(change.fullDocument);
      await buffer.add({
        document,
        resumeToken: change._id,
      });
    }
  } catch (error) {
    console.error("Change stream error:", error);
    process.exit(1);
  }
};

const main = async (): Promise<void> => {
  const isFullReindex = process.argv.includes("--full-reindex");

  if (isFullReindex) {
    await runFullReindex();
    process.exit(0);
  }

  await runRealtimeSync();
};

main().catch((error) => {
  console.error("Unhandled sync error:", error);
  process.exit(1);
});
