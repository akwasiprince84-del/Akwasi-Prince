import { RecordedMidiEvent } from '../types/synth';

function writeVarLen(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];
  let v = value;
  while ((v >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (v & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }
  return bytes;
}

export function exportEventsToMidiBlob(
  events: RecordedMidiEvent[],
  bpm: number
): Blob {
  const ticksPerQuarter = 480;
  const sorted = [...events].sort((a, b) => a.timeMs - b.timeMs);

  const trackBytes: number[] = [];

  // Tempo meta event: FF 51 03 tt tt tt (microseconds per quarter note)
  const mpqn = Math.round(60_000_000 / Math.max(30, Math.min(300, bpm)));
  trackBytes.push(
    0x00,
    0xff,
    0x51,
    0x03,
    (mpqn >> 16) & 0xff,
    (mpqn >> 8) & 0xff,
    mpqn & 0xff
  );

  // Track Name meta event: GOLDENKEYS Studio
  const trackName = 'GOLDENKEYS Studio';
  trackBytes.push(0x00, 0xff, 0x03, trackName.length);
  for (let i = 0; i < trackName.length; i++) {
    trackBytes.push(trackName.charCodeAt(i));
  }

  let prevTick = 0;
  for (const ev of sorted) {
    const tick = Math.max(
      prevTick,
      Math.round((ev.timeMs / 1000) * (bpm / 60) * ticksPerQuarter)
    );
    const delta = tick - prevTick;
    prevTick = tick;

    trackBytes.push(...writeVarLen(delta));
    if (ev.type === 'noteOn') {
      trackBytes.push(0x90, ev.note & 0x7f, Math.max(1, Math.min(127, ev.velocity)));
    } else {
      trackBytes.push(0x80, ev.note & 0x7f, 0x00);
    }
  }

  // End of Track meta event
  trackBytes.push(0x00, 0xff, 0x2f, 0x00);

  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // Header length = 6
    0x00, 0x00, // Format 0
    0x00, 0x01, // 1 track
    (ticksPerQuarter >> 8) & 0xff,
    ticksPerQuarter & 0xff,
  ];

  const trackLen = trackBytes.length;
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff,
    trackLen & 0xff,
  ];

  const fileBytes = new Uint8Array([...header, ...trackHeader, ...trackBytes]);
  return new Blob([fileBytes], { type: 'audio/midi' });
}
