import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./database.js";
const server = createApp().listen(config.PORT, () =>
  console.log(`ERCS API ready on http://127.0.0.1:${config.PORT}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
