<script lang="ts">
	import type { BgRatePeriod, ParticipantInfo } from '#lib/types/grant';
	import type { BgProviderType } from '#lib/types/bg';
	import {
		BGW_TARIFSTELLEN,
		VBG_TARIFSTELLEN,
		BGW_BEITRAGSFUSS_GEMEINNUETZIG,
		BGW_BEITRAGSFUSS_GEWERBLICH,
		BGW_AUSGLEICHSUMLAGE_DEFAULT,
		calculateBgwRate,
		calculateVbgRate,
		calculateManualRate,
		getBgwTarifstelle
	} from '#lib/grants/bg-calculator';
	import {
		getOrganizationBgSettings,
		saveOrganizationBgSettings
	} from '#lib/grants/organization-settings';

	let {
		timeline,
		participant,
		onUpdateTimeline
	}: {
		timeline: BgRatePeriod[];
		participant: ParticipantInfo;
		onUpdateTimeline: (newTimeline: BgRatePeriod[]) => void;
	} = $props();

	let isOpen = $state(false);
	let periods = $state<BgRatePeriod[]>([]);
	let showCalculator = $state(false);
	let orgSettingsSavedToast = $state(false);

	$effect(() => {
		periods = JSON.parse(JSON.stringify(timeline || []));
	});

	// Calculation states initialized from organization defaults
	const orgDefaults = getOrganizationBgSettings();
	let bgProvider = $state<BgProviderType>(orgDefaults.provider);
	let bgwIsNonProfit = $state(orgDefaults.bgw.isNonProfit);
	let bgwTarifstelleCode = $state(orgDefaults.bgw.tarifstelleCode || 'ts-14');
	let bgwDangerClassOverride = $state<number | undefined>(orgDefaults.bgw.dangerClassOverride);
	let bgwBeitragsfussOverride = $state<number | undefined>(orgDefaults.bgw.beitragsfussOverride);
	let bgwAusgleichsumlage = $state(orgDefaults.bgw.ausgleichsumlageRate ?? BGW_AUSGLEICHSUMLAGE_DEFAULT);
	let bgwSurcharge = $state(orgDefaults.bgw.surchargePercentage ?? 0.0);

	let vbgTarifstelleCode = $state(orgDefaults.vbg.tarifstelleCode || 'vbg-ts-26');
	let vbgDangerClass = $state(orgDefaults.vbg.dangerClass || 0.33);
	let vbgBeitragsfuss = $state(orgDefaults.vbg.beitragsfuss || 4.00);

	let manualBgRatePercent = $state(orgDefaults.manualRatePercent || 0.681);

	let bgCalculation = $derived.by(() => {
		if (bgProvider === 'bgw') {
			return calculateBgwRate({
				isNonProfit: bgwIsNonProfit,
				tarifstelleCode: bgwTarifstelleCode,
				dangerClassOverride: bgwDangerClassOverride,
				beitragsfussOverride: bgwBeitragsfussOverride,
				ausgleichsumlageRate: bgwAusgleichsumlage,
				surchargePercentage: bgwSurcharge
			});
		} else if (bgProvider === 'vbg') {
			return calculateVbgRate({
				tarifstelleCode: vbgTarifstelleCode,
				dangerClass: vbgDangerClass,
				beitragsfuss: vbgBeitragsfuss
			});
		} else {
			return calculateManualRate({
				ratePercent: manualBgRatePercent
			});
		}
	});

	let currentRate = $derived(periods.length > 0 ? periods[0].rate : (participant.defaultBgRate ?? 0.00681));

	function addPeriod() {
		const lastPeriod = periods[periods.length - 1];
		let nextStart = '2028-01-01';
		let nextEnd = '2031-09-30';

		if (lastPeriod) {
			nextStart = lastPeriod.endDate;
		}

		periods = [
			...periods,
			{
				id: `bg-${Date.now()}`,
				startDate: nextStart,
				endDate: nextEnd,
				rate: lastPeriod ? lastPeriod.rate : bgCalculation.rateDecimal,
				label: `Anpassung BG ab ${nextStart.slice(0, 4)}`
			}
		];
	}

	function removePeriod(id: string) {
		if (periods.length <= 1) return;
		periods = periods.filter(p => p.id !== id);
		onUpdateTimeline(periods);
	}

	function handleApplyCalculatedRate() {
		const label = `${bgCalculation.providerLabel} (${bgCalculation.ratePercent.toFixed(3).replace('.', ',')}%)`;
		if (periods.length > 0) {
			periods[0].rate = bgCalculation.rateDecimal;
			periods[0].label = label;
			periods = [...periods];
		} else {
			periods = [
				{
					id: `bg-${Date.now()}`,
					startDate: participant.runtimeStart || '2026-10-01',
					endDate: participant.runtimeEnd || '2031-09-30',
					rate: bgCalculation.rateDecimal,
					label
				}
			];
		}
		onUpdateTimeline(periods);
	}

	function applyQuickPreset(code: string) {
		bgwTarifstelleCode = code;
		const gts = getBgwTarifstelle(code);
		if (gts) {
			bgwDangerClassOverride = undefined;
		}
	}

	function handleSaveOrgDefaults() {
		saveOrganizationBgSettings({
			provider: bgProvider,
			bgw: {
				isNonProfit: bgwIsNonProfit,
				tarifstelleCode: bgwTarifstelleCode,
				dangerClassOverride: bgwDangerClassOverride,
				beitragsfussOverride: bgwBeitragsfussOverride,
				ausgleichsumlageRate: bgwAusgleichsumlage,
				surchargePercentage: bgwSurcharge
			},
			vbg: {
				tarifstelleCode: vbgTarifstelleCode,
				dangerClass: vbgDangerClass,
				beitragsfuss: vbgBeitragsfuss
			},
			manualRatePercent: manualBgRatePercent
		});
		orgSettingsSavedToast = true;
		setTimeout(() => {
			orgSettingsSavedToast = false;
		}, 3000);
	}

	function handleApply() {
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
			<span class="shield-icon">🛡️</span>
			<span>
				<strong>Berufsgenossenschaft (Gesetzliche Unfallversicherung)</strong>:
				{periods.length} {periods.length === 1 ? 'Intervall aktiv' : 'Intervalle aktiv'} (Aktuell: {(currentRate * 100).toFixed(3).replace('.', ',')}%)
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
			<!-- Quick Presets for Welfare / Health Care -->
			<div class="calculator-box">
				<div class="calc-header">
					<div class="calc-header-title">
						<span>⚖️ Gesetzliche BG-Beitragsberechnung gem. § 152 ff. SGB VII</span>
						<span class="calc-subtitle">Berechnet den BG-Beitragssatz transparent nach offizieller Formel</span>
					</div>
					<div class="calc-header-actions">
						<button
							type="button"
							class="pill-tab-btn {bgProvider === 'bgw' ? 'active' : ''}"
							onclick={() => (bgProvider = 'bgw')}
						>
							BGW
						</button>
						<button
							type="button"
							class="pill-tab-btn {bgProvider === 'vbg' ? 'active' : ''}"
							onclick={() => (bgProvider = 'vbg')}
						>
							VBG
						</button>
						<button
							type="button"
							class="pill-tab-btn {bgProvider === 'manual' ? 'active' : ''}"
							onclick={() => (bgProvider = 'manual')}
						>
							Manuell
						</button>
					</div>
				</div>

				{#if bgProvider === 'bgw'}
					<div class="bgw-controls-grid">
						<div class="sub-field col-span-2">
							<div class="label-row-between">
								<label for="companion-bgw-gts">Gefahrtarifstelle (6. Gefahrtarif der BGW ab 2025)</label>
								<button
									type="button"
									class="toggle-nonprofit-btn {bgwIsNonProfit ? 'active' : ''}"
									onclick={() => (bgwIsNonProfit = !bgwIsNonProfit)}
								>
									{bgwIsNonProfit ? 'Gemeinnützig (BF 1,94)' : 'Gewerblich (BF 2,08)'}
								</button>
							</div>
							<select
								id="companion-bgw-gts"
								bind:value={bgwTarifstelleCode}
								class="form-select-sm"
							>
								{#each BGW_TARIFSTELLEN as ts}
									<option value={ts.code}>
										{ts.title} (GK {ts.dangerClass.toFixed(2).replace('.', ',')})
									</option>
								{/each}
							</select>
						</div>

						<div class="sub-field">
							<label for="companion-danger-override">Gefahrklasse</label>
							<input
								id="companion-danger-override"
								type="number"
								step="0.01"
								placeholder={getBgwTarifstelle(bgwTarifstelleCode)?.dangerClass.toFixed(2) || '3.47'}
								value={bgwDangerClassOverride ?? ''}
								oninput={(e) => {
									const val = parseFloat(e.currentTarget.value);
									bgwDangerClassOverride = isNaN(val) ? undefined : val;
								}}
								class="form-input-sm"
							/>
						</div>

						<div class="sub-field">
							<label for="companion-surcharge">Zuschlag / Nachlass (%)</label>
							<input
								id="companion-surcharge"
								type="number"
								step="0.5"
								bind:value={bgwSurcharge}
								class="form-input-sm"
							/>
						</div>
					</div>

					<div class="quick-preset-chips">
						<span class="chip-label">Häufige Tarifstellen:</span>
						<button
							type="button"
							class="chip-mini {bgwTarifstelleCode === 'ts-14' ? 'active' : ''}"
							onclick={() => applyQuickPreset('ts-14')}
						>
							GTS 14: Beratung & Eingliederungshilfe (3,47)
						</button>
						<button
							type="button"
							class="chip-mini {bgwTarifstelleCode === 'ts-17' ? 'active' : ''}"
							onclick={() => applyQuickPreset('ts-17')}
						>
							GTS 17: WfbM & Beschäftigungsprojekte (8,40)
						</button>
						<button
							type="button"
							class="chip-mini {bgwTarifstelleCode === 'ts-10' ? 'active' : ''}"
							onclick={() => applyQuickPreset('ts-10')}
						>
							GTS 10: Verwaltung & Verbände (2,59)
						</button>
					</div>
				{:else if bgProvider === 'vbg'}
					<div class="vbg-controls-grid">
						<div class="sub-field">
							<label for="companion-vbg-ts">VBG Gefahrtarifstelle</label>
							<select
								id="companion-vbg-ts"
								bind:value={vbgTarifstelleCode}
								onchange={(e) => {
									const found = VBG_TARIFSTELLEN.find(t => t.code === e.currentTarget.value);
									if (found) vbgDangerClass = found.dangerClass;
								}}
								class="form-select-sm"
							>
								{#each VBG_TARIFSTELLEN as vts}
									<option value={vts.code}>{vts.title}</option>
								{/each}
							</select>
						</div>
						<div class="sub-field">
							<label for="companion-vbg-danger">Gefahrklasse</label>
							<input id="companion-vbg-danger" type="number" step="0.01" bind:value={vbgDangerClass} class="form-input-sm" />
						</div>
						<div class="sub-field">
							<label for="companion-vbg-bf">Beitragsfuß</label>
							<input id="companion-vbg-bf" type="number" step="0.05" bind:value={vbgBeitragsfuss} class="form-input-sm" />
						</div>
					</div>
				{:else}
					<div class="manual-control-row">
						<label for="companion-manual-rate">Freier Beitragssatz (%):</label>
						<input id="companion-manual-rate" type="number" step="0.01" bind:value={manualBgRatePercent} class="form-input-sm w-32" />
					</div>
				{/if}

				<!-- Result Breakdown & Apply Action -->
				<div class="calc-result-row">
					<div class="calc-result-left">
						<span class="calc-rate-badge">{bgCalculation.ratePercent.toFixed(3).replace('.', ',')} %</span>
						<span class="calc-formula">📐 {bgCalculation.formulaBreakdown}</span>
					</div>
					<div class="calc-result-actions">
						<button
							type="button"
							class="btn-save-org"
							onclick={handleSaveOrgDefaults}
							title="Als Organisations-Standard in diesem Browser speichern"
						>
							{#if orgSettingsSavedToast}
								✓ Gespeichert!
							{:else}
								💾 Als Organisations-Standard
							{/if}
						</button>
						<button
							type="button"
							class="btn-apply-calc"
							onclick={handleApplyCalculatedRate}
						>
							⚡ Berechneten Satz anwenden
						</button>
					</div>
				</div>
			</div>

			<!-- Multi-period Table -->
			<div class="periods-table">
				<div class="table-header">
					<span class="col-idx">#</span>
					<span class="col-date">Startdatum</span>
					<span class="col-date">Enddatum</span>
					<span class="col-rate">BG-Beitragssatz</span>
					<span class="col-label">Bezeichnung / Notiz</span>
					<span class="col-action"></span>
				</div>
				{#each periods as period, idx (period.id)}
					<div class="table-row">
						<span class="col-idx">{idx + 1}</span>
						<div class="col-date">
							<input
								type="text"
								bind:value={period.startDate}
								placeholder="01.10.2026"
								class="input-table"
							/>
						</div>
						<div class="col-date">
							<input
								type="text"
								bind:value={period.endDate}
								placeholder="30.09.2031"
								class="input-table"
							/>
						</div>
						<div class="col-rate">
							<div class="input-with-pct">
								<input
									type="number"
									step="0.01"
									value={Number((period.rate * 100).toFixed(3))}
									oninput={(e) => {
										period.rate = parseFloat(e.currentTarget.value) / 100 || 0;
									}}
									class="input-table"
								/>
								<span class="pct-sign">%</span>
							</div>
						</div>
						<div class="col-label">
							<input
								type="text"
								bind:value={period.label}
								placeholder="z. B. BGW Standard (0,681%)"
								class="input-table"
							/>
						</div>
						<div class="col-action">
							{#if periods.length > 1}
								<button
									type="button"
									class="delete-btn"
									onclick={() => removePeriod(period.id)}
									title="Intervall löschen"
								>
									&times;
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="actions-row">
				<button type="button" class="btn-add" onclick={addPeriod}>
					+ Zeitraum hinzufügen
				</button>
				<button type="button" class="btn-save" onclick={handleApply}>
					Änderungen übernehmen & Neu berechnen
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.timeline-container {
		margin-bottom: 1.5rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(56, 189, 248, 0.25);
		border-radius: 12px;
		overflow: hidden;
		backdrop-filter: blur(8px);
	}

	.timeline-toggle-btn {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		background: transparent;
		border: none;
		color: #f1f5f9;
		cursor: pointer;
		font-size: 0.95rem;
		text-align: left;
		transition: background 0.2s ease;
	}

	.timeline-toggle-btn:hover {
		background: rgba(56, 189, 248, 0.08);
	}

	.timeline-toggle-btn.active {
		border-bottom: 1px solid rgba(56, 189, 248, 0.2);
	}

	.btn-content {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.shield-icon {
		font-size: 1.2rem;
	}

	.chevron {
		transition: transform 0.2s ease;
		color: #94a3b8;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.timeline-body {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Calculator Box */
	.calculator-box {
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(56, 189, 248, 0.3);
		border-radius: 10px;
		padding: 1rem 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.calc-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.calc-header-title {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.calc-header-title span:first-child {
		font-weight: 700;
		font-size: 0.9rem;
		color: #e2e8f0;
	}

	.calc-subtitle {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.calc-header-actions {
		display: flex;
		gap: 0.25rem;
		background: rgba(30, 41, 59, 0.7);
		padding: 0.2rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.pill-tab-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		padding: 0.25rem 0.65rem;
		border-radius: 5px;
		font-size: 0.775rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pill-tab-btn:hover {
		color: #ffffff;
	}

	.pill-tab-btn.active {
		background: #0284c7;
		color: #ffffff;
	}

	.bgw-controls-grid,
	.vbg-controls-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
	}

	.col-span-2 {
		grid-column: span 2;
	}

	@media (max-width: 768px) {
		.col-span-2 {
			grid-column: span 1;
		}
	}

	.label-row-between {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.label-row-between label,
	.sub-field label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.toggle-nonprofit-btn {
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.35);
		color: #6ee7b7;
		border-radius: 6px;
		padding: 0.15rem 0.5rem;
		font-size: 0.725rem;
		font-weight: 600;
		cursor: pointer;
	}

	.toggle-nonprofit-btn:not(.active) {
		background: rgba(148, 163, 184, 0.12);
		border-color: rgba(148, 163, 184, 0.25);
		color: #cbd5e1;
	}

	.form-select-sm,
	.form-input-sm {
		width: 100%;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		padding: 0.45rem 0.65rem;
		font-size: 0.8rem;
		color: #f1f5f9;
		box-sizing: border-box;
	}

	.quick-preset-chips {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.chip-label {
		font-size: 0.725rem;
		color: #94a3b8;
	}

	.chip-mini {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #cbd5e1;
		border-radius: 5px;
		padding: 0.2rem 0.5rem;
		font-size: 0.725rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.chip-mini:hover {
		background: rgba(56, 189, 248, 0.15);
		color: #ffffff;
		border-color: #38bdf8;
	}

	.chip-mini.active {
		background: rgba(56, 189, 248, 0.2);
		color: #38bdf8;
		border-color: #38bdf8;
		font-weight: 600;
	}

	.calc-result-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.65rem;
		background: rgba(2, 132, 199, 0.12);
		border: 1px solid rgba(56, 189, 248, 0.25);
		border-radius: 8px;
		padding: 0.6rem 0.85rem;
	}

	.calc-result-left {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.calc-rate-badge {
		font-size: 1.15rem;
		font-weight: 800;
		color: #38bdf8;
	}

	.calc-formula {
		font-size: 0.75rem;
		color: #bae6fd;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.calc-result-actions {
		display: flex;
		gap: 0.4rem;
	}

	.btn-save-org {
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.35);
		color: #c7d2fe;
		padding: 0.35rem 0.65rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-save-org:hover {
		background: rgba(99, 102, 241, 0.25);
		color: #ffffff;
	}

	.btn-apply-calc {
		background: #0284c7;
		border: 1px solid #38bdf8;
		color: #ffffff;
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		font-size: 0.775rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-apply-calc:hover {
		background: #0369a1;
	}

	/* Table styles */
	.periods-table {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.table-header {
		display: grid;
		grid-template-columns: 32px 140px 140px 130px 1fr 36px;
		gap: 0.65rem;
		padding: 0.45rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 6px;
	}

	.table-row {
		display: grid;
		grid-template-columns: 32px 140px 140px 130px 1fr 36px;
		gap: 0.65rem;
		align-items: center;
		padding: 0.4rem 0.75rem;
		background: rgba(15, 23, 42, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 6px;
	}

	.col-idx {
		font-size: 0.8rem;
		color: #64748b;
		text-align: center;
	}

	.input-table {
		width: 100%;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 5px;
		padding: 0.35rem 0.55rem;
		color: #f1f5f9;
		font-size: 0.8rem;
		box-sizing: border-box;
	}

	.input-table:focus {
		outline: none;
		border-color: #38bdf8;
	}

	.input-with-pct {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-with-pct .input-table {
		padding-right: 1.5rem;
	}

	.pct-sign {
		position: absolute;
		right: 0.45rem;
		font-size: 0.75rem;
		color: #94a3b8;
		pointer-events: none;
	}

	.delete-btn {
		background: transparent;
		border: none;
		color: #ef4444;
		font-size: 1.25rem;
		cursor: pointer;
		line-height: 1;
		padding: 0;
	}

	.delete-btn:hover {
		color: #f87171;
	}

	.actions-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.btn-add {
		background: rgba(56, 189, 248, 0.15);
		border: 1px solid rgba(56, 189, 248, 0.35);
		color: #38bdf8;
		padding: 0.45rem 0.85rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-add:hover {
		background: rgba(56, 189, 248, 0.25);
		color: #ffffff;
	}

	.btn-save {
		background: linear-gradient(135deg, #0284c7, #6366f1);
		border: none;
		color: #ffffff;
		padding: 0.45rem 1.1rem;
		border-radius: 6px;
		font-size: 0.825rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
		transition: all 0.15s ease;
	}

	.btn-save:hover {
		filter: brightness(1.1);
	}
</style>
