// Dev-only mock of the RESOLVE API contract (no deps). Usage: node scripts/mock-api.mjs [port]
import http from 'node:http';
import zlib from 'node:zlib';

const port = Number(process.argv[2] || 8000);

function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, f) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = f(x, y); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const pattern = (s) => (x, y) => { const u = Math.floor(x / s), v = Math.floor(y / s); return [(u * 37) % 256, (v * 53) % 256, ((u + v) * 29) % 256]; };
const inputPng = png(256, 256, pattern(16));
const outputPng = png(256, 256, (x, y) => pattern(4)(x, y));

const result = (id) => ({
  id, input: { width: 64, height: 64, png: `/api/results/${id}/input.png` },
  output: { width: 256, height: 256, png: `/api/results/${id}/output.png` },
  runtime_ms: 5, model: 'mock', crs: 'EPSG:32644', notes: [],
});
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  const p = req.url.split('?')[0];
  if (p === '/api/health') return json(res, 200, { status: 'ok', model: 'mock', device: 'cpu' });
  if (p === '/api/samples') return json(res, 200, [{ id: 'farm', name: 'Mock Farmland', location: 'India', date: '2024-01-01', width: 64, height: 64 }]);
  if (p === '/api/samples/farm/superres' && req.method === 'POST') return setTimeout(() => json(res, 200, result('r1')), 800);
  if (p === '/api/superres' && req.method === 'POST') {
    const chunks = []; req.on('data', (c) => chunks.push(c));
    return req.on('end', () => {
      const body = Buffer.concat(chunks).toString('latin1');
      if (!/\.tiff?"/i.test(body)) return json(res, 400, { detail: 'file is not a GeoTIFF (mock)' });
      setTimeout(() => json(res, 200, result('r2')), 800);
    });
  }
  if (p.endsWith('/input.png')) { res.writeHead(200, { ...h, 'content-type': 'image/png' }); return res.end(inputPng); }
  if (p.endsWith('/output.png')) { res.writeHead(200, { ...h, 'content-type': 'image/png' }); return res.end(outputPng); }
  if (p.endsWith('/output.tif')) { res.writeHead(200, { ...h, 'content-type': 'image/tiff' }); return res.end(Buffer.from('II*\0mock')); }
  json(res, 404, { detail: 'not found' });
}).listen(port, () => console.log(`mock api on ${port}`));
