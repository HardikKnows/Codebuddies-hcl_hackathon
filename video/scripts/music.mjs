// Synthesizes the 2-minute ambient music bed (public/audio/music.wav): a slow D-major pad, a soft sub,
// a faint "pulse" heartbeat under the product scenes, and a simple Schroeder reverb. No samples, no licenses.
import { mkdirSync, writeFileSync } from 'node:fs'

const RATE = 44100
const SECONDS = 120
const N = RATE * SECONDS
const CHORD_SECONDS = 7.5
// Dmaj9 → Bm9 → Gmaj9 → A6/9, as MIDI notes.
const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 61, 62],
  [43, 50, 54, 57, 59],
  [45, 52, 59, 61, 64],
]
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

const left = new Float32Array(N)
const right = new Float32Array(N)

// Pad: each chord fades in over 2.5 s and out over 3 s, overlapping its neighbours.
for (let c = 0; c * CHORD_SECONDS < SECONDS; c++) {
  const start = c * CHORD_SECONDS
  const notes = CHORDS[c % CHORDS.length]
  const from = Math.max(0, Math.floor((start - 1.5) * RATE))
  const to = Math.min(N, Math.floor((start + CHORD_SECONDS + 2) * RATE))
  for (const [k, midi] of notes.entries()) {
    const f = hz(midi)
    const detune = 2 ** (4 / 1200)
    const level = 0.11 / (1 + k * 0.15)
    for (let i = from; i < to; i++) {
      const t = i / RATE
      const env = smooth((t - (start - 1.5)) / 2.5) * (1 - smooth((t - (start + CHORD_SECONDS - 1)) / 3))
      const lfo = 1 + 0.12 * Math.sin(2 * Math.PI * (0.07 + k * 0.013) * t + k)
      const a = 2 * Math.PI * f * t
      const voiceL = Math.sin(a / detune) + 0.28 * Math.sin(2 * a / detune) + 0.08 * Math.sin(3 * a)
      const voiceR = Math.sin(a * detune) + 0.28 * Math.sin(2 * a * detune) + 0.08 * Math.sin(3 * a)
      left[i] += voiceL * env * lfo * level
      right[i] += voiceR * env * lfo * level
    }
  }
  // Sub bass an octave under the root.
  const sub = hz(notes[0] - 12)
  for (let i = from; i < to; i++) {
    const t = i / RATE
    const env = smooth((t - (start - 1.5)) / 2.5) * (1 - smooth((t - (start + CHORD_SECONDS - 1)) / 3))
    const s = Math.sin(2 * Math.PI * sub * t) * env * 0.12
    left[i] += s
    right[i] += s
  }
}

// Schroeder reverb on the pad.
const reverb = (input) => {
  const out = new Float32Array(N)
  for (const [delay, feedback] of [[1557, 0.8], [1617, 0.79], [1491, 0.78], [1422, 0.77]]) {
    const buf = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      buf[i] = input[i] + (i >= delay ? buf[i - delay] * feedback : 0)
      out[i] += buf[i] * 0.25
    }
  }
  for (const delay of [225, 556]) {
    const copy = Float32Array.from(out)
    for (let i = 0; i < N; i++) {
      out[i] = -0.5 * copy[i] + (i >= delay ? copy[i - delay] + 0.5 * out[i - delay] : 0)
    }
  }
  return out
}
const wetL = reverb(left)
const wetR = reverb(right)

// A soft heartbeat ("pulse") at 84 BPM under the product scenes, 14 s to 95.5 s.
const BEAT = 60 / 84
for (let beat = 14; beat < 95.5; beat += BEAT * 2) {
  for (const [offset, gain] of [[0, 0.22], [0.24, 0.13]]) {
    const s0 = Math.floor((beat + offset) * RATE)
    for (let j = 0; j < RATE * 0.35 && s0 + j < N; j++) {
      const t = j / RATE
      const f = 52 + 40 * Math.exp(-t * 30)
      const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 11) * gain
      left[s0 + j] += v
      right[s0 + j] += v
    }
  }
}

// Mix, master fades, normalize to -3 dBFS.
let peak = 0
for (let i = 0; i < N; i++) {
  const t = i / RATE
  const master = smooth(t / 3) * (1 - smooth((t - (SECONDS - 5)) / 5))
  left[i] = (left[i] * 0.75 + wetL[i] * 0.35) * master
  right[i] = (right[i] * 0.75 + wetR[i] * 0.35) * master
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
}
const gain = 0.7 / peak

const data = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * gain)) * 32767), i * 4)
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * gain)) * 32767), i * 4 + 2)
}
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVEfmt ', 8)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(2, 22)
header.writeUInt32LE(RATE, 24)
header.writeUInt32LE(RATE * 4, 28)
header.writeUInt16LE(4, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(data.length, 40)

const out = new URL('../public/audio/', import.meta.url)
mkdirSync(out, { recursive: true })
writeFileSync(new URL('music.wav', out), Buffer.concat([header, data]))
console.log('wrote public/audio/music.wav')
