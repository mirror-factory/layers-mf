#!/usr/bin/env node
// Agent Message Broker — lets two Claude Code terminals talk via curl
// Start: node .claude/msg-server.js
// Send:  curl -s -d "your message" http://localhost:9876/send/pm
// Read:  curl -s http://localhost:9876/read/pm
// Peek:  curl -s http://localhost:9876/peek/pm  (read without clearing)

const http = require('http');
const PORT = process.env.MSG_PORT || 9876;

const channels = {};

function getChannel(name) {
  if (!channels[name]) channels[name] = [];
  return channels[name];
}

const server = http.createServer((req, res) => {
  const [, action, channel] = req.url.split('/');
  res.setHeader('Content-Type', 'application/json');

  if (!channel && action !== 'status') {
    res.end(JSON.stringify({ error: 'usage: /send/<channel>, /read/<channel>, /peek/<channel>, /status' }));
    return;
  }

  switch (action) {
    case 'send': {
      if (req.method !== 'POST') {
        res.end(JSON.stringify({ error: 'POST required' }));
        return;
      }
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        const msg = {
          text: body,
          from: req.headers['x-from'] || 'unknown',
          time: new Date().toISOString(),
          id: Date.now()
        };
        getChannel(channel).push(msg);
        console.log(`[${msg.time}] ${msg.from} → ${channel}: ${body.slice(0, 80)}`);
        res.end(JSON.stringify({ ok: true, queued: getChannel(channel).length }));
      });
      break;
    }

    case 'read': {
      const msgs = getChannel(channel);
      const result = [...msgs];
      msgs.length = 0; // clear after reading
      res.end(JSON.stringify(result));
      break;
    }

    case 'peek': {
      res.end(JSON.stringify(getChannel(channel)));
      break;
    }

    case 'status': {
      const status = {};
      for (const [name, msgs] of Object.entries(channels)) {
        status[name] = msgs.length;
      }
      res.end(JSON.stringify({ channels: status, uptime: process.uptime() | 0 }));
      break;
    }

    default:
      res.end(JSON.stringify({ error: `unknown action: ${action}` }));
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use. Kill the existing process: lsof -ti:${PORT} | xargs kill`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Agent message broker running on http://localhost:${PORT}`);
  console.log('Channels are created on first use. Messages queue until read.');
  console.log('');
  console.log('Quick reference:');
  console.log(`  Send:   curl -s -H "X-From: pm" -d "message" http://localhost:${PORT}/send/dev`);
  console.log(`  Read:   curl -s http://localhost:${PORT}/read/dev`);
  console.log(`  Peek:   curl -s http://localhost:${PORT}/peek/dev`);
  console.log(`  Status: curl -s http://localhost:${PORT}/status`);
});
