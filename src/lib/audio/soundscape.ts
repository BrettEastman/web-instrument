/**
 * The soundscape — the Max patch's [nodes] object plus its five environment
 * buffers (env1–env5: SacRiver / Wavesclose / Thunder / ThunderRain / Wind).
 *
 * Five looping layers live at 2D positions; a puck position sets each
 * layer's gain by proximity (linear falloff within the node's radius —
 * the same feel as Max's nodes object). The node coordinates below are
 * lifted VERBATIM from the patch JSON's xplace / yplace / nsize arrays,
 * so the geography of the piece is preserved.
 *
 * Until real field recordings land in static/soundscapes/, each layer is
 * synthesized from colored noise — recognizable placeholders, not the art.
 *
 * BPM steering: positionForBpm() maps a heart rate onto a path through the
 * node centers using the patch's five BPM buckets (calm = river, racing =
 * wind), interpolating smoothly between zone centers.
 */
import { getContext, getMaster, ramp } from './engine';
import { BPM_BUCKETS } from './pulse/types';

export interface SoundscapeNode {
	name: string;
	x: number;
	y: number;
	radius: number;
}

// From the patch: nodes @xplace @yplace @nsize (nodesnames 1–5 = env1–env5).
export const SOUNDSCAPE_NODES: SoundscapeNode[] = [
	{ name: 'river', x: 0.159, y: 0.853, radius: 0.419 },
	{ name: 'waves', x: 0.177, y: 0.145, radius: 0.341 },
	{ name: 'thunder', x: 0.855, y: 0.853, radius: 0.422 },
	{ name: 'thunder + rain', x: 0.82, y: 0.192, radius: 0.397 },
	{ name: 'wind', x: 0.396, y: 0.455, radius: 0.294 }
];

interface Layer {
	node: SoundscapeNode;
	/** Proximity weight control (0..1), set by setPosition. */
	gain: GainNode;
	stops: (() => void)[];
}

export class Soundscape {
	readonly masterGain: GainNode;
	readonly analyser: AnalyserNode;
	position = { x: 0.5, y: 0.5 };
	/** Last computed per-layer weights, for the UI. */
	weights: number[] = [0, 0, 0, 0, 0];

	private layers: Layer[] = [];

	constructor() {
		const ctx = getContext();
		this.masterGain = ctx.createGain();
		this.masterGain.gain.value = 0.6;
		this.analyser = ctx.createAnalyser();
		this.analyser.fftSize = 1024;
		this.masterGain.connect(this.analyser);
		this.analyser.connect(getMaster().busInput);

		const builders = [buildRiver, buildWaves, buildThunder, buildThunderRain, buildWind];
		this.layers = SOUNDSCAPE_NODES.map((node, i) => {
			const gain = ctx.createGain();
			gain.gain.value = 0;
			gain.connect(this.masterGain);
			const stops = builders[i](ctx, gain);
			return { node, gain, stops };
		});

		this.setPosition(0.5, 0.5, 0);
	}

	/** Move the puck: each layer's gain = linear falloff of distance / radius. */
	setPosition(x: number, y: number, rampMs = 150): void {
		this.position = { x, y };
		this.layers.forEach((layer, i) => {
			const dx = x - layer.node.x;
			const dy = y - layer.node.y;
			const dist = Math.hypot(dx, dy);
			const weight = Math.max(0, 1 - dist / layer.node.radius);
			this.weights[i] = weight;
			ramp(layer.gain.gain, weight, rampMs);
		});
	}

	stop(): void {
		ramp(this.masterGain.gain, 0, 300);
		const stops = this.layers.flatMap((l) => l.stops);
		setTimeout(() => stops.forEach((s) => s()), 400);
		this.layers = [];
	}
}

/**
 * Heart rate -> pad position, honoring the patch's semantics: a BPM inside
 * a bucket sits ON that bucket's node ("default BPM is 67, which will play
 * only the Sacramento river"). Only in the outer EDGE fraction of a bucket
 * does the puck glide toward the neighbor, so zone changes are a smooth
 * crossing rather than a teleport.
 */
export function positionForBpm(bpm: number): { x: number; y: number } {
	const EDGE = 0.08; // glide across the last/first 8% of each zone
	const last = BPM_BUCKETS.length - 1;
	let i = BPM_BUCKETS.findIndex((b) => bpm >= b.min && bpm <= b.max);
	if (i === -1) i = bpm < BPM_BUCKETS[0].min ? 0 : last;

	const node = SOUNDSCAPE_NODES[i];
	const b = BPM_BUCKETS[i];
	const t = Math.max(0, Math.min(1, (bpm - b.min) / (b.max - b.min)));

	let other: SoundscapeNode | null = null;
	let blend = 0; // 0 = on this node, 0.5 = halfway to `other`
	if (t > 1 - EDGE && i < last) {
		other = SOUNDSCAPE_NODES[i + 1];
		blend = (t - (1 - EDGE)) / (2 * EDGE);
	} else if (t < EDGE && i > 0) {
		other = SOUNDSCAPE_NODES[i - 1];
		blend = (EDGE - t) / (2 * EDGE);
	}
	if (!other) return { x: node.x, y: node.y };
	return { x: node.x + (other.x - node.x) * blend, y: node.y + (other.y - node.y) * blend };
}

// ---------------------------------------------------------------------------
// Placeholder layer builders — colored noise sketches of the five WAVs.
// Each returns stop() functions for its sources.
// ---------------------------------------------------------------------------

type NoiseColor = 'white' | 'pink' | 'brown';

function makeNoiseBuffer(ctx: BaseAudioContext, seconds: number, color: NoiseColor): AudioBuffer {
	const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const data = buffer.getChannelData(ch);
		let b0 = 0,
			b1 = 0,
			b2 = 0,
			brown = 0;
		for (let i = 0; i < data.length; i++) {
			const white = Math.random() * 2 - 1;
			if (color === 'white') {
				data[i] = white * 0.3;
			} else if (color === 'pink') {
				b0 = 0.99765 * b0 + white * 0.099046;
				b1 = 0.963 * b1 + white * 0.2965164;
				b2 = 0.57 * b2 + white * 1.0526913;
				data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
			} else {
				brown = (brown + 0.02 * white) / 1.02;
				data[i] = brown * 3.0;
			}
		}
		// Crossfade the loop seam so it doesn't click.
		const fade = Math.floor(ctx.sampleRate * 0.05);
		for (let i = 0; i < fade; i++) {
			const w = i / fade;
			data[i] = data[i] * w + data[data.length - fade + i] * (1 - w);
		}
	}
	return buffer;
}

function loopNoise(ctx: BaseAudioContext, color: NoiseColor, seconds = 4): AudioBufferSourceNode {
	const src = ctx.createBufferSource();
	src.buffer = makeNoiseBuffer(ctx, seconds, color);
	src.loop = true;
	src.start();
	return src;
}

/** LFO helper: wobble `param` around its current value by ±depth at `hz`. */
function addLfo(ctx: BaseAudioContext, param: AudioParam, hz: number, depth: number): () => void {
	const lfo = ctx.createOscillator();
	lfo.frequency.value = hz;
	const amount = ctx.createGain();
	amount.gain.value = depth;
	lfo.connect(amount);
	amount.connect(param);
	lfo.start();
	return () => lfo.stop();
}

function buildRiver(ctx: BaseAudioContext, out: GainNode): (() => void)[] {
	const src = loopNoise(ctx, 'pink');
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 900;
	const stopLfo = addLfo(ctx, lp.frequency, 0.13, 350);
	const level = ctx.createGain();
	level.gain.value = 1;
	src.connect(lp);
	lp.connect(level);
	level.connect(out);
	return [() => src.stop(), stopLfo];
}

function buildWaves(ctx: BaseAudioContext, out: GainNode): (() => void)[] {
	const src = loopNoise(ctx, 'pink', 6);
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 600;
	// Slow swells: the tide breathing at ~0.07 Hz.
	const swell = ctx.createGain();
	swell.gain.value = 0.55;
	const stopLfo = addLfo(ctx, swell.gain, 0.07, 0.45);
	src.connect(lp);
	lp.connect(swell);
	swell.connect(out);
	return [() => src.stop(), stopLfo];
}

function buildThunder(ctx: BaseAudioContext, out: GainNode): (() => void)[] {
	const src = loopNoise(ctx, 'brown', 6);
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 130;
	// Two slow detuned LFOs make pseudo-random rumble surges.
	const surge = ctx.createGain();
	surge.gain.value = 0.9;
	const stopA = addLfo(ctx, surge.gain, 0.043, 0.5);
	const stopB = addLfo(ctx, surge.gain, 0.067, 0.35);
	const level = ctx.createGain();
	level.gain.value = 1.6; // brown noise through a lowpass runs quiet
	src.connect(lp);
	lp.connect(surge);
	surge.connect(level);
	level.connect(out);
	return [() => src.stop(), stopA, stopB];
}

function buildThunderRain(ctx: BaseAudioContext, out: GainNode): (() => void)[] {
	// Rain: bright bandpassed white noise…
	const rain = loopNoise(ctx, 'white');
	const bp = ctx.createBiquadFilter();
	bp.type = 'bandpass';
	bp.frequency.value = 3200;
	bp.Q.value = 0.4;
	const rainLevel = ctx.createGain();
	rainLevel.gain.value = 0.5;
	rain.connect(bp);
	bp.connect(rainLevel);
	rainLevel.connect(out);
	// …over distant rumble.
	const rumble = loopNoise(ctx, 'brown', 6);
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 110;
	const surge = ctx.createGain();
	surge.gain.value = 0.7;
	const stopLfo = addLfo(ctx, surge.gain, 0.05, 0.5);
	const rumbleLevel = ctx.createGain();
	rumbleLevel.gain.value = 1.3;
	rumble.connect(lp);
	lp.connect(surge);
	surge.connect(rumbleLevel);
	rumbleLevel.connect(out);
	return [() => rain.stop(), () => rumble.stop(), stopLfo];
}

function buildWind(ctx: BaseAudioContext, out: GainNode): (() => void)[] {
	const src = loopNoise(ctx, 'pink', 6);
	const bp = ctx.createBiquadFilter();
	bp.type = 'bandpass';
	bp.frequency.value = 900;
	bp.Q.value = 1.4;
	// Wandering center frequency = gusts sweeping past.
	const stopLfo = addLfo(ctx, bp.frequency, 0.05, 500);
	const level = ctx.createGain();
	level.gain.value = 1.4;
	src.connect(bp);
	bp.connect(level);
	level.connect(out);
	return [() => src.stop(), stopLfo];
}
