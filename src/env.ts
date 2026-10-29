import * as dotenv from "dotenv";

dotenv.config();

const dbUri = process.env.DB_URI;

if (!dbUri) {
  throw new Error("Environment variable DB_URI is not defined");
}

export const env = {
  DB_URI: dbUri,
};
