import { Document, ObjectId, ResumeToken } from "mongodb";

export interface Address {
  line1: string;
  line2: string;
  postcode: string;
  city: string;
  state: string;
  country: string;
}

export interface CustomerDocument {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  address: Address;
  createdAt: Date;
}

export interface SyncStateDocument extends Document {
  _id: string;
  resumeToken?: ResumeToken;
  updatedAt: Date;
}

export type NewCustomerDocument = Omit<CustomerDocument, "_id">;

export type BufferedChange = {
  document: CustomerDocument;
  resumeToken: ResumeToken;
};
