<script lang="ts">
	import type { ControlCheckResult, ParticipantInfo } from '#lib/types/grant';

	let {
		controls,
		participant,
		includeOffset = true,
		onToggleOffset
	}: {
		controls: ControlCheckResult;
		participant: ParticipantInfo;
		includeOffset?: boolean;
		onToggleOffset?: (val: boolean) => void;
	} = $props();

	function formatCurrency(val: number): string {
		return val.toLocaleString('de-DE', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}
</script>

<div class="dashboard-card">
	<div class="dashboard-header">
		<div class="header-info">
			<div class="badge-row">
				<span class="status-badge {controls.overallStatus === 'MATCH' ? 'badge-match' : 'badge-warn'}">
					{#if controls.overallStatus === 'MATCH'}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
						Kontrollberechnung: 100% Mathematisch Konsistent
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="12" y1="8" x2="12" y2="12"></line>
							<line x1="12" y1="16" x2="12.01" y2="16"></line>
						</svg>
						Rundungsdifferenz vor Ausgleichszeile: {formatCurrency(controls.totalDelta)}
					{/if}
				</span>

				<span class="participant-badge">
					<strong>{participant.name}</strong> • {participant.tariffGroup}/{participant.tariffStep} ({participant.weeklyHours}h/Woche) • KK: {participant.healthInsuranceName}
					{#if participant.jobcenterId} • JC: <code>{participant.jobcenterId}</code>{/if}
					{#if participant.zgsId} • ZGS: <code>{participant.zgsId}</code>{/if}
				</span>
			</div>
			<h2>Plausibilitäts- & Kontrollrechnungs-Dashboard</h2>
		</div>

		{#if onToggleOffset}
			<div class="toggle-container">
				<label class="switch-label">
					<input
						type="checkbox"
						checked={includeOffset}
						onchange={(e) => onToggleOffset((e.target as HTMLInputElement).checked)}
					/>
					<span class="slider"></span>
					<span class="label-text">
						Ausgleichszeilen aktivieren (K-Hilfe Offset)
					</span>
				</label>
			</div>
		{/if}
	</div>

	<!-- Summary Totals Grid -->
	<div class="metrics-grid">
		<div class="metric-card highlight">
			<div class="metric-label">Gesamtförderung (inkl. Sachkosten)</div>
			<div class="metric-value">{formatCurrency(controls.formGrandTotal)}</div>
			<div class="metric-sub">
				Reale Gesamtkosten AG: {formatCurrency(controls.excelGrandTotal)}
			</div>
		</div>

		<div class="metric-card">
			<div class="metric-label">1. Jobcenter (Bund §16i)</div>
			<div class="metric-value">{formatCurrency(controls.jobcenterCheck.formTotal)}</div>
			<div class="metric-sub {controls.jobcenterCheck.offsetAmount !== 0 ? 'text-offset' : ''}">
				{#if includeOffset && controls.jobcenterCheck.offsetAmount !== 0}
					Inkl. {formatCurrency(controls.jobcenterCheck.offsetAmount)} Ausgleichszeile
				{:else}
					Korrekt degressiv berechnet
				{/if}
			</div>
		</div>

		<div class="metric-card">
			<div class="metric-label">2. Landesmittel (ZGS Berlin)</div>
			<div class="metric-value">{formatCurrency(controls.landesmittelCheck.formTotal)}</div>
			<div class="metric-sub {controls.landesmittelCheck.offsetAmount !== 0 ? 'text-offset' : ''}">
				{#if includeOffset && controls.landesmittelCheck.offsetAmount !== 0}
					Inkl. {formatCurrency(controls.landesmittelCheck.offsetAmount)} Ausgleichszeile
				{:else}
					SV-Fehlbetrag + Degr. + JSZ
				{/if}
			</div>
		</div>

		<div class="metric-card">
			<div class="metric-label">3. Sachkostenpauschale (Fi BiB)</div>
			<div class="metric-value">{formatCurrency(controls.sachkostenCheck.formTotal)}</div>
			<div class="metric-sub">
				{formatCurrency(participant.sachkostenMonthly)} / Teilnehmer / Monat
			</div>
		</div>
	</div>

	<!-- Detailed Audit Table -->
	<div class="audit-section">
		<div class="table-wrapper">
			<table class="audit-table">
				<thead>
					<tr>
						<th>Förderposition</th>
						<th class="text-right">Excel Reale Kalkulation</th>
						<th class="text-right">Formular-Summe (Monatlich × Mon.)</th>
						<th class="text-right">Rundungsdifferenz (Delta)</th>
						<th>Prüfstatus</th>
						<th>Hinweis / Verrechnung</th>
					</tr>
				</thead>
				<tbody>
					{#each controls.items as item}
						<tr>
							<td class="font-medium">{item.name}</td>
							<td class="text-right font-mono">{formatCurrency(item.excelValue)}</td>
							<td class="text-right font-mono">{formatCurrency(item.formValue)}</td>
							<td class="text-right font-mono {Math.abs(item.delta) > 0.001 ? 'delta-highlight' : 'delta-zero'}">
								{item.delta > 0 ? '+' : ''}{formatCurrency(item.delta)}
							</td>
							<td>
								<span class="status-tag tag-{item.status.toLowerCase()}">
									{item.status === 'MATCH' ? '✓ Übereinstimmung' : item.status === 'OFFSET_APPLIED' ? '⚙ Ausgeglichen' : '⚠ Differenz'}
								</span>
							</td>
							<td class="text-muted text-sm">{item.note}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<style>
	.dashboard-card {
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 1.5rem;
		margin: 1.5rem 0;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(12px);
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.badge-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		border-radius: 20px;
		font-size: 0.825rem;
		font-weight: 600;
	}

	.badge-match {
		background: rgba(16, 185, 129, 0.18);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.4);
	}

	.badge-warn {
		background: rgba(245, 158, 11, 0.18);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.4);
	}

	.participant-badge {
		background: rgba(99, 102, 241, 0.15);
		color: #c7d2fe;
		padding: 0.35rem 0.75rem;
		border-radius: 20px;
		font-size: 0.825rem;
		border: 1px solid rgba(99, 102, 241, 0.3);
	}

	.header-info h2 {
		font-size: 1.35rem;
		font-weight: 600;
		color: #f8fafc;
		margin: 0;
	}

	.switch-label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		user-select: none;
		font-size: 0.875rem;
		color: #cbd5e1;
	}

	.switch-label input {
		position: absolute;
		opacity: 0;
		cursor: pointer;
		height: 0;
		width: 0;
	}

	.slider {
		position: relative;
		display: inline-block;
		width: 38px;
		height: 20px;
		background-color: rgba(255, 255, 255, 0.2);
		border-radius: 20px;
		transition: 0.3s;
	}

	.slider:before {
		position: absolute;
		content: "";
		height: 14px;
		width: 14px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		border-radius: 50%;
		transition: 0.3s;
	}

	.switch-label input:checked + .slider {
		background-color: #6366f1;
	}

	.switch-label input:checked + .slider:before {
		transform: translateX(18px);
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.metric-card {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		transition: transform 0.2s ease;
	}

	.metric-card:hover {
		transform: translateY(-2px);
		border-color: rgba(99, 102, 241, 0.3);
	}

	.metric-card.highlight {
		background: linear-gradient(135deg, rgba(79, 70, 229, 0.25) 0%, rgba(124, 58, 237, 0.15) 100%);
		border-color: rgba(99, 102, 241, 0.4);
	}

	.metric-label {
		font-size: 0.8rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 600;
	}

	.metric-value {
		font-size: 1.45rem;
		font-weight: 700;
		color: #ffffff;
		font-family: monospace;
	}

	.metric-sub {
		font-size: 0.8rem;
		color: #64748b;
	}

	.text-offset {
		color: #38bdf8;
	}

	.table-wrapper {
		overflow-x: auto;
	}

	.audit-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.audit-table th {
		background: rgba(30, 41, 59, 0.85);
		color: #94a3b8;
		padding: 0.75rem 0.85rem;
		font-weight: 600;
		text-align: left;
		border-bottom: 2px solid rgba(99, 102, 241, 0.4);
	}

	.audit-table td {
		padding: 0.75rem 0.85rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		color: #e2e8f0;
	}

	.audit-table tbody tr:nth-child(even) {
		background: rgba(255, 255, 255, 0.02);
	}

	.audit-table tbody tr:hover {
		background: rgba(99, 102, 241, 0.1);
	}

	.text-right {
		text-align: right;
	}

	.font-mono {
		font-family: monospace;
	}

	.font-medium {
		font-weight: 500;
	}

	.delta-highlight {
		color: #38bdf8;
		font-weight: 600;
	}

	.delta-zero {
		color: #64748b;
	}

	.status-tag {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.tag-match {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}

	.tag-offset_applied {
		background: rgba(56, 189, 248, 0.15);
		color: #38bdf8;
	}

	.tag-warning {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
	}

	.text-muted {
		color: #94a3b8;
	}

	.text-sm {
		font-size: 0.8rem;
	}
</style>
