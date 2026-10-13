import app from "./app.js";
import { getRuntimeEnv } from "./config/env.js";

const env = getRuntimeEnv();

app.listen(env.PORT, () => {
  console.log(`Backend disponible en http://localhost:${env.PORT}`);
});
