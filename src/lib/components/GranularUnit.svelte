<script lang="ts">
	// The Plode1 panel: record a source buffer, then spray grains from it.
	// Range sliders mirror the patch's rsliders for start / length / transpose,
	// and interval+jitter mirror the metro + "rhythmic variation" controls.
	import type { Granular, GranularState } from '$lib/audio/granular';
	import Meter from './Meter.svelte';
	import Fader from './Fader.svelte';
	import Waveform from './Waveform.svelte';
	import RangeSlider from './RangeSlider.svelte';

	let { granular }: { granular: Granular } = $props();

	let gState = $state<GranularState>('empty');
	let duration = $state(0);
	let grainCount = $state(0);
	let waveform = $state<Float32Array | null>(null);

	// Local mirrors of GrainParams, pushed into the engine on change.
	let startLo = $state(0);
	let startHi = $state(100); // percent in the UI
	let lenLo = $state(80);
	let lenHi = $state(600);
	let transLo = $state(-12);
	let transHi = $state(12);
	let intervalMs = $state(90);
	let jitterMs = $state(120);

	$effect(() => {
		granular.params.startMin = startLo / 100;
		granular.params.startMax = startHi / 100;
		granular.params.lengthMinMs = lenLo;
		granular.params.lengthMaxMs = lenHi;
		granular.params.transposeMin = transLo;
		granular.params.transposeMax = transHi;
		granular.params.intervalMs = intervalMs;
		granular.params.jitterMs = jitterMs;
	});

	$effect(() => {
		const id = setInterval(() => {
			gState = granular.state;
			duration = granular.duration;
			grainCount = granular.grainCount;
			if (waveform !== granular.getWaveform()) waveform = granular.getWaveform();
		}, 120);
		return () => clearInterval(id);
	});

	async function recordToggle() {
		if (granular.state === 'recording') granular.stopRecording();
		else await granular.startRecording();
	}

	function runToggle() {
		if (granular.state === 'running') granular.stop();
		else granular.start();
	}
</script>

<section>
	<h2>granular · plode</h2>
	<div class="row">
		<button class:rec={gState === 'recording'} onclick={recordToggle}>
			{gState === 'recording' ? 'stop rec' : 'record source'}
		</button>
		<button disabled={gState === 'empty' || gState === 'recording'} onclick={runToggle}>
			{gState === 'running' ? 'stop grains' : 'start grains'}
		</button>
		{#if duration > 0}
			<span class="hint">{duration.toFixed(2)} s source</span>
		{/if}
		{#if gState === 'running'}
			<span class="hint grains">{grainCount} grains</span>
		{/if}
	</div>

	<Waveform samples={waveform} />

	<RangeSlider label="start" min={0} max={100} bind:lo={startLo} bind:hi={startHi} unit="%" />
	<RangeSlider label="length" min={20} max={2000} step={10} bind:lo={lenLo} bind:hi={lenHi} unit=" ms" />
	<RangeSlider label="pitch" min={-24} max={24} bind:lo={transLo} bind:hi={transHi} unit=" st" />

	<label class="fader-row">
		<span class="label">interval</span>
		<input type="range" min="10" max="500" step="5" bind:value={intervalMs} />
		<span class="value">{intervalMs} ms</span>
	</label>
	<label class="fader-row">
		<span class="label">jitter</span>
		<input type="range" min="0" max="500" step="5" bind:value={jitterMs} />
		<span class="value">+{jitterMs} ms</span>
	</label>

	<Fader param={granular.gain.gain} label="level" initialDb={-2} />
	<Meter analyser={granular.analyser} label="out" />
</section>

<style>
	section {
		background: #171522;
		border: 1px solid #2b2440;
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	h2 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--dim);
		margin: 0 0 0.25rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	button {
		background: #2b2440;
		color: #e8e6e3;
		border: 1px solid #45395f;
		border-radius: 7px;
		padding: 0.45rem 0.9rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: #372e52;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	button.rec {
		background: #5c2330;
		border-color: #8a3547;
	}
	.hint {
		color: var(--dim);
		font-size: 0.75rem;
	}
	.grains {
		color: #b08bc6;
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 3.5rem;
	}
	.fader-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.fader-row input {
		flex: 1;
		accent-color: #b08bc6;
	}
	.value {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 5.5rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
