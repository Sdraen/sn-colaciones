import { createApp } from "./app.js";
import { getRuntimeEnv } from "./config/env.js";

const env = getRuntimeEnv();
const app = createApp({
  corsOrigins: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
});

app.listen(env.PORT, () => {
  console.log(`Backend disponible en http://localhost:${env.PORT}`);
});
