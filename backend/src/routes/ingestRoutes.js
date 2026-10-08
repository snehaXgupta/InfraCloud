const express = require('express');
const router = express.Router();
const { enforceServerLabel } = require('../services/remoteWrite');
const { PROM_URL } = require('../services/prometheusService');
const { bearerToken, resolveAgentToken } = require('../services/agentAuth');

// body-parser only understands gzip/deflate/br; remote_write bodies are always snappy and
// are decoded by enforceServerLabel, so hide the header from the parser.
const takeSnappyBody = (req, res, next) => {
  if ((req.headers['content-encoding'] || '').toLowerCase() !== 'snappy') {
    return res.status(415).send('expected Content-Encoding: snappy');
  }
  delete req.headers['content-encoding'];
  next();
};

router.post('/metrics', takeSnappyBody, express.raw({ type: () => true, limit: '10mb' }), async (req, res) => {
  const token = bearerToken(req);
  if (!token) return res.status(401).send('missing agent token');

  if ((req.headers['content-type'] || '').includes('io.prometheus.write.v2')) {
    return res.status(415).send('remote_write v2 not supported; use v1');
  }

  let credential;
  try {
    credential = await resolveAgentToken(token);
  } catch (err) {
    return res.status(503).send('credential store unavailable');
  }
  if (!credential) return res.status(401).send('invalid or revoked agent token');

  let rewritten;
  try {
    rewritten = enforceServerLabel(req.body, credential.serverId.toString());
  } catch (err) {
    return res.status(400).send(`malformed remote_write payload: ${err.message}`);
  }

  try {
    const upstream = await fetch(`${PROM_URL}/api/v1/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-protobuf',
        'Content-Encoding': 'snappy',
        'X-Prometheus-Remote-Write-Version': '0.1.0',
      },
      body: rewritten.body,
      signal: AbortSignal.timeout(10000),
    });
    // 4xx from Prometheus (e.g. out-of-order samples) must not be retried forever by the shipper,
    // 5xx should be retried, so pass the status through.
    const text = upstream.ok ? '' : await upstream.text();
    return res.status(upstream.status).send(text);
  } catch (err) {
    // Prometheus down: 503 makes vmagent buffer on disk and retry.
    return res.status(503).send('metrics backend unavailable');
  }
});

module.exports = router;
