/**
 *
 *
 * @module react-native-notion-markdown/editor/ui/audioWaveform
 *
 * @file      audioWaveform.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Compact audio waveform helpers shared by the recording confirmation player and audio metadata.
 */

export const audioWaveformBarCount = 32;

const minimumAudioBarHeight = 0.18;

/** Convert Expo's dBFS metering value into a normalized waveform height. */
export function normalizeAudioMetering(metering: number): number
{
    return Math.max(0, Math.min(1, (metering + 60) / 60));
}

/** Build a stable waveform when an older audio block has no recorded sample data. */
export function createFallbackAudioWaveform(seed: string): ReadonlyArray<number>
{
    let hash = 2166136261;
    for (const character of seed)
    {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 16777619);
    }
    return Array.from({ length: audioWaveformBarCount }, (_unused: unknown, index: number) =>
    {
        const wave = Math.abs(Math.sin((index + 1) * 1.73 + (hash >>> 0) / 100000000));
        return minimumAudioBarHeight + wave * 0.62;
    });
}

/** Reduce the metering samples captured during recording to the final displayed waveform. */
export function finalizeAudioWaveform(samples: ReadonlyArray<number>): ReadonlyArray<number>
{
    if (samples.length === 0)
    {
        return createFallbackAudioWaveform("audio");
    }
    return Array.from({ length: audioWaveformBarCount }, (_unused: unknown, index: number) =>
    {
        const start = Math.floor(index * samples.length / audioWaveformBarCount);
        const end = Math.max(start + 1, Math.floor((index + 1) * samples.length / audioWaveformBarCount));
        const group = samples.slice(start, end);
        const peak = Math.max(...group, 0);
        const average = group.reduce((sum: number, value: number) => sum + value, 0) / group.length;
        return Math.max(minimumAudioBarHeight, Math.min(1, peak * 0.8 + average * 0.2));
    });
}

/** Return a compact player time label. */
export function formatAudioTime(seconds: number): string
{
    const safe = Math.max(0, Math.round(seconds));
    return `${ Math.floor(safe / 60) }:${ String(safe % 60).padStart(2, "0") }`;
}
