import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createChatServer } from './app.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const port = Number(process.env.PORT) || 3001;
const { httpServer, io } = createChatServer();

httpServer.listen(port, () => {
  console.log(`Chatterbox server listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    io.close(() => process.exit(0));
  });
}
