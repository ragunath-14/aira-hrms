import { db } from "./db";

async function testDatabase() {
  try {
    const result = await db.execute("SELECT 1");
    console.log("Database connected successfully:", result);
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}

testDatabase();