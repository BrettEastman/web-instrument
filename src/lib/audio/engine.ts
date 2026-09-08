/**
 * The audio engine: one AudioContext and the master output chain.
 *
 * Signal flow (the Web Audio equivalent of the Max patch's main out):
 *
 *   everything -> busInput -> softclip (tanh~) -> masterGain (live.gain~) -> analyser (levelmeter~) -> speakers
 *
 * Browsers refuse to start audio without a user gesture, so nothing here
 * runs until initEngine() is called from a click handler ("Begin").
 */

let ctx: AudioContext | null = null;

export interface MasterChain {
	/** Connect every sound source to this node. */
	busInput: GainNode;
	masterGain: GainNode;
	analyser: AnalyserNode;
}

let master: MasterChain | null = null;

export function getContext(): AudioContext {
	if (!ctx) throw new Error('Audio engine not initialized — press Begin first.');
	return ctx;
}

export function getMaster(): MasterChain {
	if (!master) throw new Error('Audio engine not initialized — press Begin first.');
	return master;
}

export function isRunning(): boolean {
	return ctx !== null && ctx.state === 'running';
}

export async function initEngine(): Promise<MasterChain> {
	if (ctx && master) {
		if (ctx.state === 'suspended') await ctx.resume();
		return master;
	}

	// latencyHint 'interactive' asks the browser for its smallest safe buffer.
	ctx = new AudioContext({ latencyHint: 'interactive' });
	await ctx.resume();

	const busInput = ctx.createGain();
	busInput.gain.value = 1;

	// tanh soft clipper — same idea as the patch's tanh~ compression stage.
	// A WaveShaperNode maps every sample through a lookup curve.
	const softclip = ctx.createWaveShaper();
	softclip.curve = makeTanhCurve(1.0);
	softclip.oversample = '2x';

	const masterGain = ctx.createGain();
	masterGain.gain.value = dbToGain(-6);

	const analyser = ctx.createAnalyser();
	analyser.fftSize = 2048;

	busInput.connect(softclip);
	softclip.connect(masterGain);
	masterGain.connect(analyser);
	analyser.connect(ctx.destination);

	master = { busInput, masterGain, analyser };
	return master;
}

/** tanh transfer curve; drive > 1 pushes harder into saturation. */
function makeTanhCurve(drive: number, length = 2048): Float32Array<ArrayBuffer> {
	const curve = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		const x = (i / (length - 1)) * 2 - 1; // -1 .. 1
		curve[i] = Math.tanh(x * drive);
	}
	return curve;
}

/**
 * The web equivalent of Max's [line] -> [live.gain~] pattern:
 * glide any AudioParam to a target over `ms` milliseconds, click-free.
 */
export function ramp(param: AudioParam, target: number, ms: number): void {
	const t = getContext().currentTime;
	param.cancelScheduledValues(t);
	param.setValueAtTime(param.value, t);
	param.linearRampToValueAtTime(target, t + ms / 1000);
}

/** dB (like live.gain~'s scale, -70..+6) to linear gain. -70 is treated as silence. */
export function dbToGain(db: number): number {
	return db <= -70 ? 0 : Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
	return gain <= 0 ? -70 : Math.max(-70, 20 * Math.log10(gain));
}
