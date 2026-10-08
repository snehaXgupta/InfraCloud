/**
 * Alert email mute switch. While muted, alerts are still opened, escalated, resolved and
 * audited — only the emails are skipped. A mute either has an end time or lasts until unmuted.
 */
const PlatformSetting = require('../models/PlatformSetting');

const KEY = 'alertEmailMute';
const CACHE_MS = 10 * 1000;
let cached = null; // { at, value }

/** @returns {Promise<{ muted: boolean, until: Date|null, updatedAt: Date|null }>} */
const getEmailMute = async () => {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const doc = await PlatformSetting.findOne({ key: KEY }).lean();
  const v = doc?.value || {};
  const until = v.until ? new Date(v.until) : null;
  const muted = !!v.muted && (!until || until > new Date());
  const value = { muted, until: muted ? until : null, updatedAt: doc?.updatedAt || null };

  cached = { at: Date.now(), value };
  return value;
};

/**
 * @param {{ muted: boolean, minutes?: number|null }} input  minutes null/omitted = until turned back on
 */
const setEmailMute = async ({ muted, minutes = null }, user) => {
  const until = muted && minutes ? new Date(Date.now() + minutes * 60 * 1000) : null;
  await PlatformSetting.findOneAndUpdate(
    { key: KEY },
    { $set: { value: { muted: !!muted, until }, updatedBy: user?._id } },
    { upsert: true }
  );
  cached = null;
  return getEmailMute();
};

module.exports = { getEmailMute, setEmailMute };
