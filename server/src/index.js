const { createServer } = require('./server');
const store = require('./store');

const PORT = parseInt(process.env.PORT || '9400', 10);
const HOST = process.env.HOST || '0.0.0.0';

const server = createServer();
server.listen(PORT, HOST, () => {
  console.log(`[sapere] listening on http://${HOST}:${PORT}`);
  console.log(`[sapere] data file: ${store.DATA}`);
});

process.on('SIGTERM', () => { store.flush(); server.close(() => process.exit(0)); });
