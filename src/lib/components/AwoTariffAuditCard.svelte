<script lang="ts">
	import type { TariffValidationReport, ParticipantInfo, MonthlyRecord, ParticipantCalculationResult } from '#lib/types/grant';
	import { getAwoTariffSalary, determineParticipantStepForRecord } from '#lib/grants/awo-tariff-data';

	let {
		validation,
		participant,
		records,
		participants
	}: {
		validation?: TariffValidationReport;
		participant: ParticipantInfo;
		records: MonthlyRecord[];
		participants?: ParticipantCalculationResult[];
	} = $props();

	let selectedIdx = $state(0);
	const activePData = $derived(participants && participants.length > 0 ? (participants[selectedIdx] || participants[0]) : null);
	const activeParticipant = $derived(activePData ? activePData.participant : participant);
	const activeRecords = $derived(activePData ? activePData.records : records);
	const activeValidation = $derived(activePData ? activePData.tariffValidation : validation);

	let showDetails = $state(false);
	let filterView = $state<'all' | 'discrepancies'>('discrepancies');

	function formatCurrency(val: number): string {
		return val.toLocaleString('de-DE', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	// Build a complete audit list of all records >= 09/2025
	const auditRows = $derived.by(() => {
		if (!activeRecords || activeRecords.length === 0) return [];
		return activeRecords
			.filter(r => r.year * 100 + r.month >= 202509)
			.map(r => {
				const step = determineParticipantStepForRecord(activeParticipant, r);
				const awo = getAwoTariffSalary(
					activeParticipant.tariffGroup,
					step,
					r.year,
					r.month,
					r.weeklyHours || activeParticipant.weeklyHours,
					r.fullTimeHours || activeParticipant.fullTimeHours || 39.0
				);
				const expectedFte = awo ? awo.fteSalary : 0;
				const diffFte = Math.round((r.fteSalary - expectedFte + Number.EPSILON) * 100) / 100;
				const isDiscrepant = Math.abs(diffFte) > 0.05;

				return {
					date: r.date,
					year: r.year,
					month: r.month,
					step,
					recordedFte: r.fteSalary,
					expectedFte,
					diffFte,
					isDiscrepant,
					periodLabel: awo ? awo.periodLabel : '–',
					recordedPt: r.partTimeSalary,
					expectedPt: awo ? Math.round(((expectedFte / 39) * (r.weeklyHours || activeParticipant.weeklyHours) + Number.EPSILON) * 100) / 100 : 0
				};
			});
	});

	const displayedRows = $derived.by(() => {
		if (filterView === 'discrepancies') {
			return auditRows.filter(r => r.isDiscrepant);
		}
		return auditRows;
	});
</script>

{#if activeValidation}
	<div class="audit-card {activeValidation.isCompliant ? 'audit-compliant' : 'audit-warning'}">
		{#if participants && participants.length > 1}
			<div class="audit-p-switcher">
				<span class="audit-p-label">Gegenprüfung für Teilnehmer/in:</span>
				<div class="audit-p-pills">
					{#each participants as p, idx}
						<button
							type="button"
							class="audit-p-btn {selectedIdx === idx ? 'active' : ''} {p.tariffValidation?.isCompliant ? 'status-ok' : 'status-warn'}"
							onclick={() => (selectedIdx = idx)}
						>
							<span>{p.tariffValidation?.isCompliant ? '✓' : '⚠️'}</span>
							<span class="p-name">{p.participant.name || `TLN ${idx + 1}`}</span>
							<span class="audit-p-eg">({p.participant.tariffGroup}/{p.participant.tariffStep})</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Header -->
		<div class="audit-header">
			<div class="audit-title-area">
				<div class="status-icon">
					{#if activeValidation.isCompliant}
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
							<polyline points="22 4 12 14.01 9 11.01"></polyline>
						</svg>
					{:else}
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="12" y1="8" x2="12" y2="12"></line>
							<line x1="12" y1="16" x2="12.01" y2="16"></line>
						</svg>
					{/if}
				</div>

				<div>
					<div class="audit-badge-row">
						<span class="badge {activeValidation.isCompliant ? 'badge-green' : 'badge-amber'}">
							{activeValidation.isCompliant ? 'AWO-Tariftreue: 100% Konform' : `${activeValidation.discrepancyCount} Tarifabweichung(en)`}
						</span>
						{#if activeValidation.jszAudits && activeValidation.jszAudits.length > 0}
							{@const jszOk = activeValidation.jszAudits.every(a => a.isCompliant)}
							<span class="badge {jszOk ? 'badge-purple' : 'badge-amber'}">
								{jszOk ? '✓ JSZ (85% AWO) 100% Konform' : '⚠️ JSZ Abweichung'}
							</span>
						{/if}
						<span class="badge-sub">
							Gegenprüfung Spalte F (VZ-Brutto) & Jahressonderzahlung nach TV AWO Berlin (10. ÄTV / TE 05.05.2026)
							{#if participants && participants.length > 1}
								• <strong>{activeParticipant.name}</strong> ({activeParticipant.tariffGroup}/{activeParticipant.tariffStep})
							{/if}
						</span>
					</div>
					<h3 class="audit-heading">AWO Berlin Tarif-Plausibilitätsprüfung</h3>
				</div>
			</div>

			<div class="header-actions">
				<button
					type="button"
					class="btn-toggle-details"
					onclick={() => (showDetails = !showDetails)}
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						{#if showDetails}
							<polyline points="18 15 12 9 6 15"></polyline>
						{:else}
							<polyline points="6 9 12 15 18 9"></polyline>
						{/if}
					</svg>
					{showDetails ? 'Prüftabelle ausblenden' : 'Prüftabelle einblenden'}
				</button>
			</div>
		</div>

		<!-- Metrics Grid -->
		<div class="audit-metrics-grid">
			<div class="metric-box">
				<span class="metric-label">Prüfungsstatus (ab 09/2025)</span>
				<span class="metric-val {activeValidation.isCompliant ? 'text-emerald' : 'text-amber'}">
					{activeValidation.isCompliant ? '✓ Fehlerfrei' : `⚠️ ${activeValidation.discrepancyCount} Abweichungen`}
				</span>
				<span class="metric-sub">VZ-Brutto & JSZ geprüft</span>
			</div>

			<div class="metric-box">
				<span class="metric-label">Jahressonderzahlung (AWO 85%)</span>
				{#if activeValidation.jszAudits && activeValidation.jszAudits.length > 0}
					{@const jszOkCount = activeValidation.jszAudits.filter(a => a.isCompliant).length}
					<span class="metric-val font-mono {jszOkCount === activeValidation.jszAudits.length ? 'text-emerald' : 'text-amber'}">
						{jszOkCount}/{activeValidation.jszAudits.length} Jahre konform
					</span>
					<span class="metric-sub">Stichtag 01.12. & Septembergehalt</span>
				{:else}
					<span class="metric-val font-mono text-muted">–</span>
					<span class="metric-sub">Keine JSZ in Auswertung</span>
				{/if}
			</div>

			<div class="metric-box">
				<span class="metric-label">Geprüfte Monate (ab 09/2025)</span>
				<span class="metric-val font-mono">{activeValidation.checkedCount} Monate</span>
				<span class="metric-sub">09/2025 bis 12/2028</span>
			</div>

			<div class="metric-box">
				<span class="metric-label">Monate vor 09/2025</span>
				<span class="metric-val font-mono">{activeValidation.skippedPriorTo2025Count} Monate</span>
				<span class="metric-sub">Keine Tariftabelle hinterlegt</span>
			</div>

			<div class="metric-box">
				<span class="metric-label">Eingruppierung</span>
				<span class="metric-val font-mono">{activeParticipant.tariffGroup}/{activeParticipant.tariffStep}</span>
				<span class="metric-sub">{activeParticipant.weeklyHours}h / 39,0h Teilzeit</span>
			</div>
		</div>

		<!-- Detail Table -->
		{#if showDetails}
			<div class="table-container">
				<div class="table-toolbar">
					<span class="table-title">Monatsweise Detailprüfung Spalte F (VZ-Brutto):</span>
					<div class="filter-buttons">
						<button
							type="button"
							class="btn-filter {filterView === 'discrepancies' ? 'active' : ''}"
							onclick={() => (filterView = 'discrepancies')}
						>
							Nur Abweichungen ({activeValidation.discrepancyCount})
						</button>
						<button
							type="button"
							class="btn-filter {filterView === 'all' ? 'active' : ''}"
							onclick={() => (filterView = 'all')}
						>
							Alle Monate ab 09/2025 ({auditRows.length})
						</button>
					</div>
				</div>

				{#if displayedRows.length === 0}
					<div class="empty-notice">
						{#if filterView === 'discrepancies'}
							✓ Keine Abweichungen gefunden! Alle {activeValidation.checkedCount} Monate stimmen exakt mit der AWO-Tariftabelle überein.
						{:else}
							Keine Datensätze ab 09/2025 vorhanden.
						{/if}
					</div>
				{:else}
					<div class="table-wrapper">
						<table class="audit-table">
							<thead>
								<tr>
									<th>Monat</th>
									<th>Tarifstufe</th>
									<th>AWO-Tarifstand</th>
									<th class="th-num">Berechnungsblatt (Spalte F)</th>
									<th class="th-num">Offizieller AWO-Tarif</th>
									<th class="th-num">Differenz VZ</th>
									<th class="th-center">Status</th>
								</tr>
							</thead>
							<tbody>
								{#each displayedRows as row}
									<tr class={row.isDiscrepant ? 'row-discrepant' : ''}>
										<td class="font-mono">{String(row.month).padStart(2, '0')}/{row.year}</td>
										<td>{activeParticipant.tariffGroup}/ES {row.step}</td>
										<td class="text-muted">{row.periodLabel}</td>
										<td class="text-right font-mono font-medium">{formatCurrency(row.recordedFte)}</td>
										<td class="text-right font-mono font-medium">{formatCurrency(row.expectedFte)}</td>
										<td class="text-right font-mono font-bold {row.diffFte === 0 ? 'text-muted' : row.diffFte > 0 ? 'text-rose' : 'text-emerald'}">
											{row.diffFte > 0 ? '+' : ''}{formatCurrency(row.diffFte)}
										</td>
										<td class="text-center">
											{#if !row.isDiscrepant}
												<span class="status-tag tag-match">✓ Exakt</span>
											{:else}
												<span class="status-tag tag-diff">⚠️ Abweichung</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				{#if activeValidation.jszAudits && activeValidation.jszAudits.length > 0}
					<div class="table-toolbar" style="margin-top: 1.5rem;">
						<span class="table-title">🎁 Detailprüfung Jahressonderzahlung nach AWO Berlin Tarif (10. ÄTV / TE 05.05.2026):</span>
					</div>
					<div class="table-wrapper">
						<table class="audit-table">
							<thead>
								<tr>
									<th>Jahr</th>
									<th>Stichtag 01.12.</th>
									<th>Beschäftigungsmonate</th>
									<th class="th-num">Basis (Septembergehalt)</th>
									<th class="th-num">Berechnungsblatt JSZ</th>
									<th class="th-num">AWO-Tarif JSZ (85%)</th>
									<th class="th-num">AGA auf JSZ</th>
									<th class="th-center">Status</th>
								</tr>
							</thead>
							<tbody>
								{#each activeValidation.jszAudits as jsz}
									<tr class={!jsz.isCompliant ? 'row-discrepant' : ''}>
										<td class="font-mono font-bold">{jsz.year}</td>
										<td>
											{#if jsz.isEmployedOnDec1st}
												<span class="status-tag tag-match">✓ Beschäftigt</span>
											{:else}
												<span class="status-tag tag-diff">✗ Ausgetreten</span>
											{/if}
										</td>
										<td class="font-mono">{jsz.activeMonthsInYear.toFixed(1).replace('.0', '')} / 12 Monate</td>
										<td class="text-right font-mono">{formatCurrency(jsz.septemberSalary)}</td>
										<td class="text-right font-mono font-medium">{formatCurrency(jsz.recordedJszAmount)}</td>
										<td class="text-right font-mono font-medium">{formatCurrency(jsz.expectedJszAmount)}</td>
										<td class="text-right font-mono">{formatCurrency(jsz.recordedJszAga)}</td>
										<td class="text-center">
											{#if jsz.isCompliant}
												<span class="status-tag tag-match">✓ AWO-konform</span>
											{:else}
												<span class="status-tag tag-diff">⚠️ Abweichung</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.audit-card {
		background: rgba(15, 23, 42, 0.7);
		border-radius: 12px;
		border: 1px solid;
		backdrop-filter: blur(12px);
		padding: 1.25rem 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.audit-card.audit-compliant {
		border-color: rgba(16, 185, 129, 0.3);
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(15, 23, 42, 0.8) 100%);
	}

	.audit-card.audit-warning {
		border-color: rgba(245, 158, 11, 0.4);
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%);
	}

	.audit-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.audit-title-area {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.status-icon {
		width: 42px;
		height: 42px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.audit-compliant .status-icon {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.audit-warning .status-icon {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.audit-badge-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 0.25rem;
		flex-wrap: wrap;
	}

	.badge {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.badge-green {
		background: rgba(16, 185, 129, 0.2);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.4);
	}

	.badge-amber {
		background: rgba(245, 158, 11, 0.2);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.4);
	}

	.badge-purple {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	.badge-sub {
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.audit-heading {
		font-size: 1.15rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
	}

	.btn-toggle-details {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(30, 41, 59, 0.8);
		color: #e2e8f0;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		padding: 0.5rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-toggle-details:hover {
		background: rgba(51, 65, 85, 0.9);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.audit-metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.85rem;
	}

	.metric-box {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.metric-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
	}

	.metric-val {
		font-size: 1.05rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.metric-sub {
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.text-emerald { color: #34d399 !important; }
	.text-amber { color: #fbbf24 !important; }
	.text-rose { color: #f87171 !important; }
	.text-muted { color: #64748b; }

	.table-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 1rem;
	}

	.table-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.table-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.filter-buttons {
		display: flex;
		gap: 0.4rem;
	}

	.btn-filter {
		background: rgba(30, 41, 59, 0.6);
		color: #94a3b8;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		padding: 0.3rem 0.65rem;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-filter.active {
		background: rgba(56, 189, 248, 0.15);
		color: #38bdf8;
		border-color: rgba(56, 189, 248, 0.4);
		font-weight: 600;
	}

	.empty-notice {
		padding: 1.25rem;
		background: rgba(16, 185, 129, 0.08);
		border: 1px dashed rgba(16, 185, 129, 0.3);
		border-radius: 6px;
		color: #34d399;
		font-size: 0.85rem;
		text-align: center;
	}

	.table-wrapper {
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		overflow-x: auto;
	}

	.audit-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}

	.audit-table th {
		background: rgba(15, 23, 42, 0.9);
		color: #94a3b8;
		padding: 0.6rem 0.85rem;
		text-align: left;
		font-weight: 600;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.audit-table td {
		padding: 0.55rem 0.85rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		color: #e2e8f0;
	}

	.audit-table tr.row-discrepant {
		background: rgba(245, 158, 11, 0.08);
	}

	.status-tag {
		display: inline-block;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.tag-match {
		background: rgba(16, 185, 129, 0.2);
		color: #34d399;
	}

	.tag-diff {
		background: rgba(245, 158, 11, 0.2);
		color: #fbbf24;
	}

	.th-num { text-align: right; }
	.th-center { text-align: center; }
	.text-center { text-align: center; }

	/* Multi-Participant Switcher */
	.audit-p-switcher {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		background: rgba(15, 23, 42, 0.6);
		border-radius: 8px;
		margin-bottom: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		flex-wrap: wrap;
	}

	.audit-p-label {
		font-size: 0.78rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.audit-p-pills {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.audit-p-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #cbd5e1;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.audit-p-btn:hover {
		background: rgba(51, 65, 85, 0.9);
		color: #ffffff;
	}

	.audit-p-btn.active {
		background: rgba(56, 189, 248, 0.2);
		border-color: #38bdf8;
		color: #ffffff;
		font-weight: 700;
	}

	.audit-p-eg {
		font-size: 0.72rem;
		color: #94a3b8;
	}
</style>
