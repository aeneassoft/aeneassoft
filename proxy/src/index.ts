import { buildServer } from './proxy';

async function main() {
  const server = buildServer();

  try {
    await server.listen({ port: 8080, host: '0.0.0.0' });
    server.log.info('[PRODUCTNAME] Proxy running on port 8080');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
