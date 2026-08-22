import { betterAuth } from "better-auth";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

export const auth = betterAuth({
  database: databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
      })
    : {
        provider: "sqlite",
        url: "auth.db",
      },
  emailAndPassword: {
    enabled: true,
  },
});
