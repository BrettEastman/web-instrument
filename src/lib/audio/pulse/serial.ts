/**
 * SerialPulse — the original hardware: the Arduino Uno running the
 * PulseSensor_BPM sketch, exactly as the Max patch used it, but the
 * browser talks to it directly via Web Serial (Chromium-only).
 *
 * The patch side was: [serial b 115200] polled by [metro 50] ->
 * [sel 13 10] -> [zl.group] -> [itoa] -> [fromsymbol] -> BPM number.
 * Here the port's readable stream does the polling for us; we split on
 * newlines and parse each line with parseBpmLine (see below for the
 * output formats it understands).
 *
 * Every raw line is also reported through `onRaw`, so the UI can show
 * exactly what the board is sending — the fastest way to diagnose a
 * baud-rate mismatch or an unfamiliar sketch format.
 */
import type { BpmListener, PulseSource } from './types';

export const BAUD_RATES = [115200, 9600, 57600, 250000] as const;

export interface SerialPulseOptions {
	baudRate?: number;
	/** Every raw line received, parsed or not. */
	onRaw?: (line: string) => void;
	/** Read failures after the port opened (e.g. cable pulled). */
	onError?: (message: string) => void;
}

export class SerialPulse implements PulseSource {
	readonly label = 'arduino (serial)';

	private port: SerialPort | null = null;
	private reader: ReadableStreamDefaultReader<string> | null = null;
	private pipeDone: Promise<void> | null = null;
	private running = false;

	constructor(private options: SerialPulseOptions = {}) {}

	static available(): boolean {
		return typeof navigator !== 'undefined' && 'serial' in navigator;
	}

	async start(onBpm: BpmListener): Promise<void> {
		this.port = await navigator.serial.requestPort();
		try {
			await this.port.open({ baudRate: this.options.baudRate ?? 115200 });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			// The usual culprit: Arduino IDE's Serial Monitor/Plotter holding the port.
			throw new Error(`${msg} — close the Arduino IDE Serial Monitor/Plotter and try again.`);
		}

		const decoder = new TextDecoderStream();
		// lib.dom types decoder.writable as WritableStream<BufferSource>, the
		// serial types as Uint8Array — same bytes, TS just can't see it.
		this.pipeDone = this.port
			.readable!.pipeTo(decoder.writable as WritableStream<Uint8Array>)
			.catch(() => {});
		this.reader = decoder.readable.getReader();
		this.running = true;

		void this.readLoop(onBpm);
	}

	private async readLoop(onBpm: BpmListener): Promise<void> {
		let lineBuffer = '';
		try {
			while (this.running && this.reader) {
				const { value, done } = await this.reader.read();
				if (done) break;
				lineBuffer += value;
				const lines = lineBuffer.split(/\r?\n/);
				lineBuffer = lines.pop() ?? ''; // keep the trailing partial line
				for (const raw of lines) {
					const line = raw.trim();
					if (!line) continue;
					this.options.onRaw?.(line);
					const bpm = parseBpmLine(line);
					if (bpm !== null) onBpm(bpm);
				}
			}
		} catch (e) {
			if (this.running) {
				this.options.onError?.(e instanceof Error ? e.message : String(e));
			}
		}
	}

	stop(): void {
		this.running = false;
		const reader = this.reader;
		const port = this.port;
		const pipeDone = this.pipeDone;
		this.reader = null;
		this.port = null;
		this.pipeDone = null;
		// The port can only close once the reader is released and the pipe has
		// settled; doing it in order frees the port for the next connect.
		void (async () => {
			await reader?.cancel().catch(() => {});
			await pipeDone;
			await port?.close().catch(() => {});
		})();
	}
}

/**
 * Pull a BPM out of one line of serial output. Formats handled:
 *   "BPM: 72", "BPM=72", "♥ A HeartBeat Happened! BPM: 72"  (PulseSensor Playground)
 *   "B72"                                                   (classic Amped sketch; S/Q lines ignored)
 *   "88,686,514" / "514,88,686"                             (Serial Plotter CSV, any field order)
 *   "72"                                                    (bare number, as the Max patch read it)
 */
export function parseBpmLine(line: string): number | null {
	if (line.includes(',')) return bpmFromCsv(line);
	let match = line.match(/BPM\D{0,4}(\d{2,3})/i);
	if (!match) match = line.match(/^B(\d{2,3})$/);
	if (!match) match = line.match(/^(\d{2,3})$/);
	if (!match) return null;
	return validBpm(parseInt(match[1], 10));
}

/**
 * Serial Plotter CSV carries BPM, IBI (ms between beats) and the raw signal,
 * but the field order differs between PulseSensor library versions
 * (Brett's board sends BPM,IBI,signal). Rather than trust an order, find the
 * pair that agrees with itself: BPM × IBI ≈ 60000. The library's BPM is a
 * 10-beat average while IBI is the latest beat, so some slack is needed —
 * but kept tight (±15%) because the raw signal (~300–700) can masquerade as
 * an IBI. Rejecting an occasional honest line costs nothing at ~50 lines/s.
 */
function bpmFromCsv(line: string): number | null {
	const labeled = line.match(/BPM\D{0,4}(\d{2,3})/i); // "Signal:512,BPM:90,IBI:666"
	if (labeled) return validBpm(parseInt(labeled[1], 10));

	const fields = line.split(',').map((f) => Number(f.trim()));
	if (fields.some((n) => !Number.isFinite(n))) return null;

	let best: { bpm: number; error: number } | null = null;
	for (let b = 0; b < fields.length; b++) {
		for (let i = 0; i < fields.length; i++) {
			if (b === i) continue;
			const bpm = fields[b];
			const ibi = fields[i];
			if (bpm < 30 || bpm > 220 || ibi < 270 || ibi > 2000) continue;
			const error = Math.abs((bpm * ibi) / 60000 - 1);
			if (error <= 0.15 && (!best || error < best.error)) best = { bpm, error };
		}
	}
	return best ? Math.round(best.bpm) : null;
}

function validBpm(bpm: number): number | null {
	return bpm >= 30 && bpm <= 220 ? bpm : null;
}
