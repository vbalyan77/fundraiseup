import { faker } from "@faker-js/faker";
import { COLLECTIONS, DATA_GENERATOR } from "./constants";
import { createMongoClient } from "./db";
import { NewCustomerDocument } from "./types";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const buildCustomer = (): NewCustomerDocument => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    firstName,
    lastName,
    email: faker.internet
      .email({
        firstName,
        lastName,
      })
      .toLowerCase(),
    address: {
      line1: faker.location.streetAddress(),
      line2: faker.location.secondaryAddress(),
      postcode: faker.location.zipCode(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      country: faker.location.countryCode("alpha-2"),
    },
    createdAt: new Date(),
  };
};

const run = async (): Promise<void> => {
  const client = createMongoClient();
  await client.connect();

  const db = client.db();
  const customers = db.collection<NewCustomerDocument>(COLLECTIONS.CUSTOMERS);

  console.log("Customer generator started");

  let running = true;

  const shutdown = async (): Promise<void> => {
    if (!running) {
      return;
    }

    running = false;
    console.log("Shutting down customer generator...");
    await client.close();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    const batchSize = faker.number.int({ min: 1, max: 10 });
    const batch = Array.from({ length: batchSize }, buildCustomer);

    try {
      await customers.insertMany(batch, { ordered: false });
    } catch (error) {
      console.error("Failed to insert a batch of customers:", error);
    }

    await sleep(DATA_GENERATOR.INSERT_INTERVAL_MS);
  }
};

run().catch((error) => {
  console.error("Fatal error in customer generator:", error);
  process.exit(1);
});
