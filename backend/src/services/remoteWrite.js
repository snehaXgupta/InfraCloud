/**
 * Prometheus remote_write (v1) payload rewriting.
 *
 * The ingest gateway must not trust labels sent by a host. This module decodes the
 * snappy-compressed protobuf WriteRequest, replaces every series' `server_id` label with
 * the server bound to the agent token, and re-encodes it. Sample bytes are copied as-is.
 *
 * WriteRequest { repeated TimeSeries timeseries = 1; repeated MetricMetadata metadata = 3; }
 * TimeSeries   { repeated Label labels = 1; samples = 2; exemplars = 3; histograms = 4; }
 * Label        { string name = 1; string value = 2; }
 */

const snappy = require('snappyjs');

const MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
const TENANT_LABEL = 'server_id';

const readVarint = (buf, pos) => {
  let result = 0;
  let multiplier = 1;
  for (let i = 0; i < 10; i++) {
    if (pos >= buf.length) throw new Error('Truncated varint');
    const byte = buf[pos++];
    result += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return [result, pos];
    multiplier *= 128;
  }
  throw new Error('Varint too long');
};

const encodeVarint = (value) => {
  const bytes = [];
  while (value > 127) {
    bytes.push((value % 128) | 0x80);
    value = Math.floor(value / 128);
  }
  bytes.push(value);
  return Buffer.from(bytes);
};

// Walks the top-level fields of a protobuf message, yielding raw byte ranges.
function* fields(buf) {
  let pos = 0;
  while (pos < buf.length) {
    const start = pos;
    let key;
    [key, pos] = readVarint(buf, pos);
    const fieldNumber = Math.floor(key / 8);
    const wireType = key & 7;
    let payloadStart = pos;
    switch (wireType) {
      case 0:
        [, pos] = readVarint(buf, pos);
        break;
      case 1:
        pos += 8;
        break;
      case 2: {
        let len;
        [len, pos] = readVarint(buf, pos);
        payloadStart = pos;
        pos += len;
        break;
      }
      case 5:
        pos += 4;
        break;
      default:
        throw new Error(`Unsupported protobuf wire type ${wireType}`);
    }
    if (pos > buf.length) throw new Error('Truncated protobuf field');
    yield { fieldNumber, wireType, raw: buf.subarray(start, pos), payload: buf.subarray(payloadStart, pos) };
  }
}

const lengthDelimited = (fieldNumber, payload) =>
  Buffer.concat([encodeVarint(fieldNumber * 8 + 2), encodeVarint(payload.length), payload]);

const decodeLabel = (buf) => {
  const label = { name: '', value: '' };
  for (const f of fields(buf)) {
    if (f.wireType !== 2) continue;
    if (f.fieldNumber === 1) label.name = f.payload.toString('utf8');
    if (f.fieldNumber === 2) label.value = f.payload.toString('utf8');
  }
  return label;
};

const encodeLabel = ({ name, value }) =>
  lengthDelimited(1, Buffer.concat([lengthDelimited(1, Buffer.from(name)), lengthDelimited(2, Buffer.from(value))]));

const rewriteTimeSeries = (buf, serverId) => {
  const labels = [];
  const rest = [];
  for (const f of fields(buf)) {
    if (f.fieldNumber === 1 && f.wireType === 2) labels.push(decodeLabel(f.payload));
    else rest.push(f.raw);
  }

  const forced = labels.filter((l) => l.name !== TENANT_LABEL);
  forced.push({ name: TENANT_LABEL, value: serverId });
  forced.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return Buffer.concat([...forced.map(encodeLabel), ...rest]);
};

/**
 * @param {Buffer} body     snappy-compressed WriteRequest
 * @param {string} serverId server bound to the authenticated agent token
 * @returns {{ body: Buffer, seriesCount: number }} snappy-compressed rewritten WriteRequest
 */
const enforceServerLabel = (body, serverId) => {
  const decoded = Buffer.from(snappy.uncompress(body, MAX_UNCOMPRESSED_BYTES));
  const out = [];
  let seriesCount = 0;

  for (const f of fields(decoded)) {
    if (f.fieldNumber === 1 && f.wireType === 2) {
      out.push(lengthDelimited(1, rewriteTimeSeries(f.payload, serverId)));
      seriesCount++;
    } else {
      out.push(f.raw);
    }
  }

  return { body: Buffer.from(snappy.compress(Buffer.concat(out))), seriesCount };
};

module.exports = { enforceServerLabel, TENANT_LABEL, _internal: { fields, decodeLabel, encodeLabel, lengthDelimited, encodeVarint } };
