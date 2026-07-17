import http from 'node:http';
import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 8080);
const app = createApp();

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const result = await app.handle({
    method: req.method,
    url: req.url,
    pathname: new URL(req.url || '/', 'http://localhost').pathname,
    headers: req.headers,
    bodyText: Buffer.concat(chunks).toString('utf8')
  });
  res.writeHead(result.status, result.headers);
  res.end(JSON.stringify(result.body));
});

server.listen(port, '0.0.0.0');

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});
