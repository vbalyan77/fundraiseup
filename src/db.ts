import { MongoClient } from "mongodb";
import { env } from "./env";

export const createMongoClient = (): MongoClient =>
  new MongoClient(env.DB_URI);



