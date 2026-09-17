<script lang="ts">
	// The patch's [rslider]: a labeled min/max pair defining a random range.
	let {
		label,
		min,
		max,
		step = 1,
		unit = '',
		lo = $bindable(),
		hi = $bindable(),
		onchange
	}: {
		label: string;
		min: number;
		max: number;
		step?: number;
		unit?: string;
		lo: number;
		hi: number;
		onchange?: (lo: number, hi: number) => void;
	} = $props();

	function onLo(e: Event) {
		lo = Math.min(Number((e.target as HTMLInputElement).value), hi);
		onchange?.(lo, hi);
	}
	function onHi(e: Event) {
		hi = Math.max(Number((e.target as HTMLInputElement).value), lo);
		onchange?.(lo, hi);
	}
</script>

<div class="range">
	<span class="label">{label}</span>
	<div class="pair">
		<input type="range" {min} {max} {step} value={lo} oninput={onLo} />
		<input type="range" {min} {max} {step} value={hi} oninput={onHi} />
	</div>
	<span class="value">{lo}–{hi}{unit}</span>
</div>

<style>
	.range {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 3.5rem;
	}
	.pair {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	input {
		width: 100%;
		accent-color: #b08bc6;
		height: 12px;
	}
	.value {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 5.5rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
