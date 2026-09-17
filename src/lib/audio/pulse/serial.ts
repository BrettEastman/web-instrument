/**
 * SerialPulse — the original hardware: the Arduino Uno running the
 * PulseSensor_BPM sketch, exactly as the Max patch used it, but the
 * browser talks to it directly via Web Serial (Chromium-only).
 *
 * The patch side was: [serial b 115200] polled by [metro 50] ->
 * [sel 13 10] -> [zl.group] -> [itoa] -> [fromsymbol] -> BPM number.
 * Here the port's readable stream does the polling for us; we split on
 * newlines and parse the digits. PulseSensor sketches prefix lines:
 * 'B' = BPM on each beat, 'S' = raw signal, 'Q' = inter-beat interval —
 * we take 'B' lines, or bare numbers for simpler sketches.
 */
import type { BpmListener, PulseSource } from './types';

export class SerialPulse implements PulseSource {
	readonly label = 'arduino (serial)';

	private port: SerialPort | null = null;
	private reader: ReadableStreamDefaultReader<string> | null = null;
	private running = false;

	static available(): boolean {
		return typeof navigator !== 'undefined' && 'serial' in navigator;
	}

	async start(onBpm: BpmListener): Promise<void> {
		this.port = await navigator.serial.requestPort();
		await this.port.open({ baudRate: 115200 }); // the patch's [serial b 115200]

		const decoder = new TextDecoderStream();
		// lib.dom types decoder.writable as WritableStream<BufferSource>, the
		// serial types as Uint8Array — same bytes, TS just can't see it.
		this.port.readable!.pipeTo(decoder.writable as WritableStream<Uint8Array>).catch(() => {});
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
				for (const line of lines) {
					const bpm = parseBpmLine(line.trim());
					if (bpm !== null) onBpm(bpm);
				}
			}
		} catch {
			// Port unplugged mid-performance — go quiet rather than crash.
		}
	}

	stop(): void {
		this.running = false;
		this.reader?.cancel().catch(() => {});
		this.reader = null;
		// Closing after cancel; ignore errors if already gone.
		this.port?.close().catch(() => {});
		this.port = null;
	}
}

function parseBpmLine(line: string): number | null {
	let digits: string | null = null;
	if (line.startsWith('B')) digits = line.slice(1); // PulseSensor BPM line
	else if (/^\d+$/.test(line)) digits = line; // bare-number sketches
	if (!digits) return null;
	const bpm = parseInt(digits, 10);
	return Number.isFinite(bpm) && bpm >= 30 && bpm <= 220 ? bpm : null;
}
