<script lang="ts">
	// The pulse monitor panel: pick a source (tap / BLE strap / Arduino),
	// watch the BPM, freeze it (the patch's «"k" freezes the bpm»), or type
	// it in manually («performers not using pulse monitor can manually
	// input pulse bpm data»). Optionally the pulse paces the grain cloud.
	import { BPM_BUCKETS, bucketIndexFor, type PulseSource } from '$lib/audio/pulse/types';
	import { pulseState } from '$lib/stores/pulse-state.svelte';
	import { TapPulse } from '$lib/audio/pulse/tap';
	import { BleHeartRate } from '$lib/audio/pulse/ble';
	import { SerialPulse } from '$lib/audio/pulse/serial';
	import type { Granular } from '$lib/audio/granular';

	let { granular = null }: { granular?: Granular | null } = $props();

	let frozen = $state(false);
	let driveGrains = $state(false);
	let error = $state('');
	let active = $state.raw<PulseSource | null>(null);
	let activeLabel = $state('');

	const bleAvailable = BleHeartRate.available();
	const serialAvailable = SerialPulse.available();
	const bucket = $derived(bucketIndexFor(pulseState.bpm));

	// Pulse -> grain pacing: grains on the 8th notes of the heartbeat,
	// with a quarter-beat of the patch's "rhythmic variation".
	$effect(() => {
		if (driveGrains && granular) {
			const beatMs = 60000 / pulseState.bpm;
			granular.params.intervalMs = beatMs / 2;
			granular.params.jitterMs = beatMs / 4;
		}
	});

	function onBpm(value: number) {
		if (!frozen) pulseState.bpm = value;
	}

	async function activate(source: PulseSource) {
		stopSource();
		error = '';
		try {
			await source.start(onBpm);
			active = source;
			activeLabel = source.label;
			frozen = false;
		} catch (e) {
			// User dismissed the device picker, or no device — not fatal.
			error = e instanceof Error ? e.message : String(e);
		}
	}

	function stopSource() {
		active?.stop();
		active = null;
		activeLabel = '';
	}

	/** The patch's "k": freeze the reading and let go of the sensor. */
	function freeze() {
		frozen = true;
		stopSource();
	}

	function onManualBpm(e: Event) {
		const v = Number((e.target as HTMLInputElement).value);
		if (v >= 30 && v <= 220) pulseState.bpm = v;
	}
</script>

<section>
	<h2>pulse</h2>

	<div class="head">
		<div class="bpm" class:frozen>
			{pulseState.bpm}
			<span class="unit">bpm{frozen ? ' ·frozen' : ''}</span>
		</div>
		<div class="buckets">
			{#each BPM_BUCKETS as b, i (b.name)}
				<span class="chip" class:active={i === bucket}>{b.name}<em>{b.min}–{b.max}</em></span>
			{/each}
		</div>
	</div>

	<div class="row">
		<span class="label">source</span>
		<button class:on={activeLabel === 'tap'} onclick={() => activate(new TapPulse())}>tap</button>
		<button
			class:on={activeLabel === 'bluetooth strap'}
			disabled={!bleAvailable}
			onclick={() => activate(new BleHeartRate())}
			title={bleAvailable ? '' : 'Web Bluetooth needs a Chromium browser'}
		>
			bluetooth strap
		</button>
		<button
			class:on={activeLabel === 'arduino (serial)'}
			disabled={!serialAvailable}
			onclick={() => activate(new SerialPulse())}
			title={serialAvailable ? '' : 'Web Serial needs a Chromium browser'}
		>
			arduino
		</button>
		{#if active}
			<button class="freeze" onclick={freeze}>freeze</button>
		{/if}
	</div>

	{#if active instanceof TapPulse}
		{@const tapSource = active}
		<div class="row">
			<button class="tap-pad" onclick={() => tapSource.tap()}>tap your pulse</button>
			<span class="hint">finger on your neck, tap along — settles after a few taps</span>
		</div>
	{/if}

	<div class="row">
		<span class="label">manual</span>
		<input type="number" min="30" max="220" value={pulseState.bpm} onchange={onManualBpm} />
		<label class="drive">
			<input type="checkbox" bind:checked={driveGrains} disabled={!granular} />
			pulse paces the grain cloud
		</label>
	</div>

	{#if error}<p class="error">{error}</p>{/if}
</section>

<style>
	section {
		background: #1a1216;
		border: 1px solid #3a2230;
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	h2 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--dim);
		margin: 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.bpm {
		font-size: 2.6rem;
		font-weight: 700;
		line-height: 1;
		color: #d1748f;
		font-variant-numeric: tabular-nums;
	}
	.bpm.frozen {
		color: #90bec6;
	}
	.unit {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--dim);
	}
	.buckets {
		flex: 1;
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.chip {
		font-size: 0.68rem;
		color: var(--dim);
		border: 1px solid #3a2230;
		border-radius: 999px;
		padding: 0.2rem 0.55rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.25;
	}
	.chip em {
		font-style: normal;
		font-size: 0.6rem;
		opacity: 0.7;
	}
	.chip.active {
		color: #e8e6e3;
		border-color: #d1748f;
		background: #2c1a22;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.label {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 3.5rem;
	}
	button {
		background: #2c1a22;
		color: #e8e6e3;
		border: 1px solid #4a2c3c;
		border-radius: 7px;
		padding: 0.45rem 0.9rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: #3a2230;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	button.on {
		border-color: #d1748f;
		background: #3a2230;
	}
	.freeze {
		border-color: #4a9d8f;
	}
	.tap-pad {
		font-size: 1rem;
		padding: 0.8rem 1.6rem;
		border-color: #d1748f;
	}
	input[type='number'] {
		width: 5rem;
		background: #2c1a22;
		color: #e8e6e3;
		border: 1px solid #4a2c3c;
		border-radius: 6px;
		padding: 0.35rem 0.5rem;
		font-size: 0.85rem;
	}
	.drive {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: var(--dim);
	}
	.drive input {
		accent-color: #d1748f;
	}
	.hint {
		color: var(--dim);
		font-size: 0.72rem;
	}
	.error {
		color: #d1495b;
		font-size: 0.8rem;
		margin: 0;
	}
</style>
