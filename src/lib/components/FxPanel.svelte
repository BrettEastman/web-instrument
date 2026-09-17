<script lang="ts">
	// Master FX controls: the patch's filtergraph~ umenu + flonums, the
	// Basicflange knobs, and a reverb send. All moves go through ramp()
	// so nothing zippers.
	import type { FxBus } from '$lib/audio/fx';
	import { ramp } from '$lib/audio/engine';

	let { fx }: { fx: FxBus } = $props();

	// The patch's filter-type umenu, minus "display".
	const eqTypes: BiquadFilterType[] = [
		'lowpass',
		'highpass',
		'bandpass',
		'notch',
		'peaking',
		'lowshelf',
		'highshelf'
	];

	let eqType = $state<BiquadFilterType>('peaking');
	let eqFreqNorm = $state(freqToNorm(1868)); // 0..1 on a log scale
	let eqGainDb = $state(0);
	let eqQ = $state(0.7);
	let flangWet = $state(0);
	let flangRate = $state(0.47);
	let flangDepthMs = $state(2);
	let flangFeedback = $state(0.3);
	let reverbWet = $state(0);

	// Log-scaled frequency: 20 Hz .. 18 kHz. Ears hear ratios, not
	// differences, so a linear slider would cram all the music into
	// its left edge.
	function normToFreq(x: number): number {
		return 20 * Math.pow(900, x);
	}
	function freqToNorm(f: number): number {
		return Math.log(f / 20) / Math.log(900);
	}

	const eqFreq = $derived(normToFreq(eqFreqNorm));
	const hasGain = $derived(['peaking', 'lowshelf', 'highshelf'].includes(eqType));

	function onEqType(e: Event) {
		eqType = (e.target as HTMLSelectElement).value as BiquadFilterType;
		fx.eq.type = eqType;
	}
</script>

<section>
	<h2>fx bus</h2>

	<div class="group">
		<span class="group-label">eq</span>
		<select value={eqType} onchange={onEqType}>
			{#each eqTypes as t (t)}<option value={t}>{t}</option>{/each}
		</select>
		<label class="fader-row">
			<span class="label">freq</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.001"
				bind:value={eqFreqNorm}
				oninput={() => ramp(fx.eq.frequency, eqFreq, 30)}
			/>
			<span class="value">{eqFreq < 1000 ? eqFreq.toFixed(0) + ' Hz' : (eqFreq / 1000).toFixed(2) + ' kHz'}</span>
		</label>
		{#if hasGain}
			<label class="fader-row">
				<span class="label">gain</span>
				<input
					type="range"
					min="-15"
					max="15"
					step="0.5"
					bind:value={eqGainDb}
					oninput={() => ramp(fx.eq.gain, eqGainDb, 30)}
				/>
				<span class="value">{eqGainDb.toFixed(1)} dB</span>
			</label>
		{/if}
		<label class="fader-row">
			<span class="label">Q</span>
			<input
				type="range"
				min="0.1"
				max="12"
				step="0.1"
				bind:value={eqQ}
				oninput={() => ramp(fx.eq.Q, eqQ, 30)}
			/>
			<span class="value">{eqQ.toFixed(1)}</span>
		</label>
	</div>

	<div class="group">
		<span class="group-label">flanger</span>
		<label class="fader-row">
			<span class="label">wet</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={flangWet}
				oninput={() => ramp(fx.flanger.wet.gain, flangWet, 50)}
			/>
			<span class="value">{(flangWet * 100).toFixed(0)}%</span>
		</label>
		<label class="fader-row">
			<span class="label">rate</span>
			<input
				type="range"
				min="0.05"
				max="2"
				step="0.01"
				bind:value={flangRate}
				oninput={() => ramp(fx.flanger.rate.frequency, flangRate, 50)}
			/>
			<span class="value">{flangRate.toFixed(2)} Hz</span>
		</label>
		<label class="fader-row">
			<span class="label">depth</span>
			<input
				type="range"
				min="0"
				max="4.5"
				step="0.1"
				bind:value={flangDepthMs}
				oninput={() => ramp(fx.flanger.depth.gain, flangDepthMs / 1000, 50)}
			/>
			<span class="value">{flangDepthMs.toFixed(1)} ms</span>
		</label>
		<label class="fader-row">
			<span class="label">regen</span>
			<input
				type="range"
				min="0"
				max="0.85"
				step="0.01"
				bind:value={flangFeedback}
				oninput={() => ramp(fx.flanger.feedback.gain, flangFeedback, 50)}
			/>
			<span class="value">{(flangFeedback * 100).toFixed(0)}%</span>
		</label>
	</div>

	<div class="group">
		<span class="group-label">reverb</span>
		<label class="fader-row">
			<span class="label">send</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={reverbWet}
				oninput={() => ramp(fx.reverb.wet.gain, reverbWet, 100)}
			/>
			<span class="value">{(reverbWet * 100).toFixed(0)}%</span>
		</label>
	</div>
</section>

<style>
	section {
		background: #1a1712;
		border: 1px solid #38301f;
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	h2 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--dim);
		margin: 0;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.group-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #e2b04a;
	}
	select {
		align-self: flex-start;
		background: #2c2617;
		color: #e8e6e3;
		border: 1px solid #4a3f26;
		border-radius: 6px;
		padding: 0.3rem 0.5rem;
		font-size: 0.8rem;
	}
	.fader-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 3.5rem;
	}
	.fader-row input {
		flex: 1;
		accent-color: #e2b04a;
	}
	.value {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 4.5rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
