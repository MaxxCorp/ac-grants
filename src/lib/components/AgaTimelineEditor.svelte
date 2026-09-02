<script lang="ts">
	import type { AgaRatePeriod, ParticipantInfo } from '#lib/types/grant';

	let {
		timeline,
		participant,
		onUpdateTimeline
	}: {
		timeline: AgaRatePeriod[];
		participant: ParticipantInfo;
		onUpdateTimeline: (newTimeline: AgaRatePeriod[]) => void;
	} = $props();

	let isOpen = $state(false);
	let periods = $state<AgaRatePeriod[]>([]);

	$effect(() => {
		periods = JSON.parse(JSON.stringify(timeline));
	});

	const PRESET_INSURANCES = [
		{ name: 'Barmer', rate: 0.23815 },
		{ name: 'AOK BLN-BRB', rate: 0.2387 },
		{ name: 'Techniker', rate: 0.22935 },
		{ name: 'mkk', rate: 0.2448 },
		{ name: 'BIG direkt', rate: 0.25285 },
		{ name: 'BKK VBU', rate: 0.2448 },
		{ name: 'DAK', rate: 0.2314 },
		{ name: 'IKK BLN-BRB', rate: 0.25415 }
	];

	function addPeriod() {
		const lastPeriod = periods[periods.length - 1];
		let nextStart = '2028-01-01';
		let nextEnd = '2031-07-31';

		if (lastPeriod) {
			nextStart = lastPeriod.endDate;
		}

		periods = [
			...periods,
			{
				id: `aga-${Date.now()}`,
				startDate: nextStart,
				endDate: nextEnd,
				rate: lastPeriod ? lastPeriod.rate : 0.23815,
				label: `Anpassung ab ${nextStart.slice(0, 4)}`
			}
		];
	}

	function removePeriod(id: string) {
		if (periods.length <= 1) return;
		periods = periods.filter(p => p.id !== id);
		onUpdateTimeline(periods);
	}

	function handleApply() {
		onUpdateTimeline(periods);
	}

	function applyPreset(presetRate: number, presetName: string) {
		periods = [
			{
				id: 'aga-preset-1',
				startDate: '2026-08-01',
				endDate: '2031-07-31',
				rate: presetRate,
				label: `${presetName} (${(presetRate * 100).toFixed(3)}%)`
			}
		];
		onUpdateTimeline(periods);
	}
</script>

<div class="timeline-container">
	<button
		type="button"
		class="timeline-toggle-btn {isOpen ? 'active' : ''}"
		onclick={() => (isOpen = !isOpen)}
	>
		<div class="btn-content">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
				<line x1="16" y1="2" x2="16" y2="6"></line>
				<line x1="8" y1="2" x2="8" y2="6"></line>
				<line x1="3" y1="10" x2="21" y2="10"></line>
			</svg>
			<span>
				<strong>AGA-Beitragssatz-Matrix (Zeitabhängig)</strong>:
				{periods.length} {periods.length === 1 ? 'Intervall aktiv' : 'Intervalle aktiv'} (Standard: {(participant.defaultAgaRate * 100).toFixed(3).replace('.', ',')}%)
			</span>
		</div>
		<svg
			class="chevron {isOpen ? 'rotated' : ''}"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<polyline points="6 9 12 15 18 9"></polyline>
		</svg>
	</button>

	{#if isOpen}
		<div class="timeline-body">
			<div class="presets-row">
				<span class="preset-label">Krankenkassen-Presets:</span>
				<div class="preset-chips">
					{#each PRESET_INSURANCES as p}
						<button
							type="button"
							class="chip-btn"
							onclick={() => applyPreset(p.rate, p.name)}
						>
							{p.name} ({(p.rate * 100).toFixed(2)}%)
						</button>
					{/each}
				</div>
			</div>

			<p class="section-desc">
				Legen Sie fest, ob sich der Arbeitgeber-Gesamtsozialversicherungsbeitrag (inkl. U1, U2, U3) über die 5-jährige Laufzeit ändert (z. B. durch Erhöhung des KV-Zusatzbeitrags oder PV):
			</p>

			<div class="periods-list">
				{#each periods as period, index (period.id)}
					<div class="period-row">
						<div class="period-index">#{index + 1}</div>

						<div class="field-group">
							<label for="start-{period.id}">Von</label>
							<input
								id="start-{period.id}"
								type="date"
								bind:value={period.startDate}
								class="input-field"
							/>
						</div>

						<div class="field-group">
							<label for="end-{period.id}">Bis</label>
							<input
								id="end-{period.id}"
								type="date"
								bind:value={period.endDate}
								class="input-field"
							/>
						</div>

						<div class="field-group rate-group">
							<label for="rate-{period.id}">AGA-Satz [%]</label>
							<div class="input-with-suffix">
								<input
									id="rate-{period.id}"
									type="number"
									step="0.001"
									min="15"
									max="40"
									value={period.rate * 100}
									oninput={(e) => {
										const val = parseFloat((e.target as HTMLInputElement).value);
										if (!isNaN(val)) period.rate = val / 100;
									}}
									class="input-field"
								/>
								<span class="suffix">%</span>
							</div>
						</div>

						<div class="field-group label-group">
							<label for="label-{period.id}">Bezeichnung</label>
							<input
								id="label-{period.id}"
								type="text"
								bind:value={period.label}
								placeholder="z. B. Barmer 2028 Erhöhung"
								class="input-field"
							/>
						</div>

						{#if periods.length > 1}
							<button
								type="button"
								class="delete-btn"
								onclick={() => removePeriod(period.id)}
								title="Intervall entfernen"
							>
								✕
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<div class="timeline-footer">
				<button type="button" class="btn btn-secondary" onclick={addPeriod}>
					+ Weiteres Zeitintervall hinzufügen
				</button>

				<button type="button" class="btn btn-primary" onclick={handleApply}>
					AGA-Matrix anwenden & Neuberechnen
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.timeline-container {
		margin: 1.25rem 0;
		border-radius: 12px;
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		overflow: hidden;
	}

	.timeline-toggle-btn {
		width: 100%;
		padding: 0.9rem 1.25rem;
		background: transparent;
		border: none;
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #e2e8f0;
		cursor: pointer;
		font-size: 0.925rem;
		transition: background 0.2s ease;
	}

	.timeline-toggle-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.timeline-toggle-btn.active {
		background: rgba(99, 102, 241, 0.12);
		border-bottom: 1px solid rgba(99, 102, 241, 0.3);
	}

	.btn-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.chevron {
		transition: transform 0.25s ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.timeline-body {
		padding: 1.25rem;
	}

	.presets-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.preset-label {
		font-size: 0.825rem;
		color: #94a3b8;
		font-weight: 500;
	}

	.preset-chips {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.chip-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 16px;
		padding: 0.25rem 0.65rem;
		font-size: 0.775rem;
		color: #cbd5e1;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.chip-btn:hover {
		background: rgba(99, 102, 241, 0.25);
		color: #ffffff;
		border-color: #818cf8;
	}

	.section-desc {
		font-size: 0.85rem;
		color: #94a3b8;
		margin: 0 0 1rem 0;
	}

	.periods-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.period-row {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		padding: 0.75rem 1rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		flex-wrap: wrap;
	}

	.period-index {
		font-weight: 700;
		color: #818cf8;
		padding-bottom: 0.5rem;
		font-size: 0.85rem;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-group label {
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 500;
	}

	.input-field {
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		color: #ffffff;
		padding: 0.4rem 0.6rem;
		font-size: 0.85rem;
	}

	.input-with-suffix {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-with-suffix input {
		padding-right: 1.75rem;
		width: 100px;
	}

	.suffix {
		position: absolute;
		right: 0.5rem;
		color: #94a3b8;
		font-size: 0.85rem;
		pointer-events: none;
	}

	.label-group {
		flex: 1;
		min-width: 180px;
	}

	.label-group input {
		width: 100%;
	}

	.delete-btn {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.4);
		border-radius: 6px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		margin-bottom: 2px;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 0.35);
	}

	.timeline-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.btn {
		padding: 0.55rem 1rem;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.2s ease;
	}

	.btn-secondary {
		background: rgba(255, 255, 255, 0.08);
		color: #cbd5e1;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.btn-primary {
		background: #6366f1;
		color: #ffffff;
	}

	.btn-primary:hover {
		background: #4f46e5;
	}
</style>
