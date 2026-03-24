import 'dotenv/config';
import express from 'express';
import { listSources, deleteSource } from '../sources.js';
import { scanAndIngest } from '../ingest.js';
import { logger } from '../../utils/logger.js';

const app = express();
const PORT = parseInt(process.env.KNOWLEDGE_UI_PORT || '9723');
const SOURCE_DIR = process.env.KNOWLEDGE_SOURCE_DIR || './books';

app.use(express.json());

// SSE clients for live progress
const sseClients: express.Response[] = [];

function broadcast(data: object) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

// ── API routes ──────────────────────────────────────────

app.get('/sources', async (_req, res) => {
  try {
    const sources = await listSources();
    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/source/:source', async (req, res) => {
  try {
    const deleted = await deleteSource(req.params.source);
    res.json({ deleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/ingest/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('data: {"status":"connected"}\n\n');
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx >= 0) sseClients.splice(idx, 1);
  });
});

app.post('/ingest', (_req, res) => {
  res.json({ status: 'started' });

  // Run ingestion in background
  (async () => {
    try {
      broadcast({ status: 'ingesting', message: `Scanning ${SOURCE_DIR} for PDFs...` });
      logger.info(`[ui] Starting scan & ingest from ${SOURCE_DIR}`);
      const results = await scanAndIngest(SOURCE_DIR, 'marketing');
      broadcast({ status: 'done', results });
      logger.info(`[ui] Ingestion complete: ${JSON.stringify(results)}`);
    } catch (err: any) {
      broadcast({ status: 'error', message: err.message });
      logger.error(`[ui] Ingestion error: ${err.message}`);
    }
  })();
});

// ── Admin UI ────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.send(HTML);
});

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge Base Admin</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 2rem; }
  h1 { margin-bottom: 1.5rem; font-size: 1.5rem; }
  .card { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.6rem 1rem; border-bottom: 1px solid #eee; }
  th { font-weight: 600; color: #666; font-size: 0.85rem; text-transform: uppercase; }
  button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
  .btn-primary { background: #2563eb; color: #fff; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-danger { background: #ef4444; color: #fff; font-size: 0.8rem; padding: 0.3rem 0.7rem; }
  .btn-danger:hover { background: #dc2626; }
  .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
  #log { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 4px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; margin-top: 1rem; display: none; }
  .empty { color: #999; padding: 1rem; text-align: center; }
</style>
</head>
<body>
<h1>Knowledge Base Admin</h1>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
    <h2 style="font-size:1.1rem">Sources</h2>
    <button class="btn-primary" id="ingestBtn" onclick="startIngest()">Scan &amp; Ingest</button>
  </div>
  <div id="tableWrap"></div>
  <div id="log"></div>
</div>

<script>
async function loadSources() {
  const wrap = document.getElementById('tableWrap');
  try {
    const res = await fetch('/sources');
    const sources = await res.json();
    if (!sources.length) {
      wrap.innerHTML = '<p class="empty">No sources ingested yet.</p>';
      return;
    }
    let html = '<table><thead><tr><th>Source</th><th>Type</th><th>Chunks</th><th>Last Updated</th><th></th></tr></thead><tbody>';
    for (const s of sources) {
      const date = new Date(s.lastUpdated).toLocaleString();
      html += '<tr><td>' + esc(s.source) + '</td><td>' + esc(s.knowledge_type) + '</td><td>' + s.chunkCount + '</td><td>' + date + '</td><td><button class="btn-danger" onclick="delSource(\\''+esc(s.source)+'\\')">Delete</button></td></tr>';
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
  } catch (e) {
    wrap.innerHTML = '<p class="empty">Error loading sources.</p>';
  }
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function delSource(source) {
  if (!confirm('Delete all chunks for "' + source + '"?')) return;
  await fetch('/source/' + encodeURIComponent(source), { method: 'DELETE' });
  loadSources();
}

function startIngest() {
  const btn = document.getElementById('ingestBtn');
  const log = document.getElementById('log');
  btn.disabled = true;
  btn.textContent = 'Ingesting...';
  log.style.display = 'block';
  log.textContent = '';

  fetch('/ingest', { method: 'POST' });

  const es = new EventSource('/ingest/stream');
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.message) log.textContent += data.message + '\\n';
    if (data.status === 'done') {
      log.textContent += '\\nDone! ' + JSON.stringify(data.results, null, 2) + '\\n';
      btn.disabled = false;
      btn.textContent = 'Scan & Ingest';
      es.close();
      loadSources();
    }
    if (data.status === 'error') {
      log.textContent += '\\nError: ' + data.message + '\\n';
      btn.disabled = false;
      btn.textContent = 'Scan & Ingest';
      es.close();
    }
    log.scrollTop = log.scrollHeight;
  };
}

loadSources();
</script>
</body>
</html>`;

app.listen(PORT, () => {
  logger.info(`[knowledge-ui] Admin UI running on http://localhost:${PORT}`);
});
