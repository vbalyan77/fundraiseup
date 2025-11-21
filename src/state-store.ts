import { Collection, ResumeToken } from "mongodb";
import { SyncStateDocument } from "./types";

export class ResumeTokenStore {
  constructor(
    private readonly collection: Collection<SyncStateDocument>,
    private readonly key: string,
  ) {}

  async get(): Promise<ResumeToken | null> {
    const state = await this.collection.findOne({ _id: this.key });
    return state?.resumeToken ?? null;
  }

  async save(resumeToken: ResumeToken): Promise<void> {
    await this.collection.updateOne(
      { _id: this.key },
      {
        $set: {
          resumeToken,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
}
