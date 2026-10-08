/** Minimal Prometheus remote_write (v1) encoder for test/demo scripts. */
const snappy = require('snappyjs');
const { _internal: pb } = require('../../src/services/remoteWrite');

const encodeSample = (value, tsMs) => {
  const dbl = Buffer.alloc(8);
  dbl.writeDoubleLE(value);
  return pb.lengthDelimited(2, Buffer.concat([Buffer.from([0x09]), dbl, Buffer.from([0x10]), pb.encodeVarint(tsMs)]));
};

/** @param {Record<string,string>} labels  @param {Array<[number, number]>} samples [value, tsMs] */
const encodeSeries = (labels, samples) => {
  const sorted = Object.entries(labels).sort(([a], [b]) => (a < b ? -1 : 1));
  return pb.lengthDelimited(
    1,
    Buffer.concat([...sorted.map(([name, value]) => pb.encodeLabel({ name, value })), ...samples.map(([v, t]) => encodeSample(v, t))])
  );
};

/** @param {Buffer[]} series encoded with encodeSeries → snappy-compressed WriteRequest */
const buildWriteRequest = (series) => Buffer.from(snappy.compress(Buffer.concat(series)));

module.exports = { encodeSeries, buildWriteRequest };
