<script lang="ts">
	import type { FormTabDefinition, FormRowItem, GrantTransformationResult } from '#lib/types/grant';
	import { generateAutomationPayload, generatePlaywrightScript } from '#lib/automation/bridge';

	let {
		result
	}: {
		result: GrantTransformationResult;
	} = $props();

	let activeTabId = $state('jobcenter');
	let copiedField = $state<string | null>(null);
	let lastCopiedRowId = $state<string | null>(null);
	let copiedTimeout: any = null;
	let showScriptModal = $state(false);

	const activeTab = $derived(result.tabs.find(t => t.id === activeTabId) || result.tabs[0]);

	function formatCurrency(val: number): string {
		return val.toLocaleString('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}) + ' €';
	}

	function getRowExplanation(row: FormRowItem): string {
		if (row.explanationText !== undefined && row.explanationText !== null) {
			return row.explanationText.trim();
		}
		return '';
	}

	function getRowCostType(row: FormRowItem): string {
		if (row.costTypeText !== undefined && row.costTypeText !== null && row.costTypeText.trim() !== '') {
			return row.costTypeText.trim();
		}
		if (row.category === 'wage' || !row.category) return 'AG-Brutto, inkl. 19% Pauschale';
		if (row.category === 'sv_shortfall') return 'SV Fehlbetrag inkl. (U1,U2,U3) i.H.v. 23,815%';
		if (row.category === 'degression') return 'Degressionsbetrag';
		if (row.category === 'jsz') return 'Jahressonderzahlung';
		if (row.category === 'sachkosten') return 'Sachkostenpauschale 155,00 € mtl.';
		if (row.category === 'offset' || row.isOffsetRow) return 'Ausgleichsbetrag';
		return 'AG-Brutto, inkl. 19% Pauschale';
	}

	function getCompoundOneLine(row: FormRowItem): string {
		const name = row.participantName || result.participant?.name || '';
		const runtime = row.runtimeText || `${result.participant?.runtimeStart}-${result.participant?.runtimeEnd}`;
		const tariff = row.tariffText || `AWO Berlin ${result.participant?.tariffGroup}/${result.participant?.tariffStep}`;
		const period = row.calculationPeriodText || runtime;
		const explanation = getRowExplanation(row);
		const costType = getRowCostType(row);

		const parts = [
			name,
			runtime,
			tariff,
			period,
			explanation && explanation !== '' ? explanation : null,
			costType && costType !== '' ? costType : null
		].filter((p): p is string => p !== null && p !== undefined && p !== '');

		return parts.join('     '); // Exactly 5 spaces between each component
	}

	function copyToClipboard(text: string | number | undefined | null, fieldKey: string, rowId?: string, isMonthCount = false) {
		if (text === undefined || text === null) return;
		const textToCopy = typeof text === 'number'
			? (isMonthCount
				? text.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
				: text.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
			: String(text);

		navigator.clipboard.writeText(textToCopy);
		copiedField = fieldKey;
		if (rowId) {
			lastCopiedRowId = rowId;
		}
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copiedField = null;
		}, 1800);
	}

	function copyRowTSV(row: FormRowItem) {
		const values = [
			row.workingHours,
			row.monthlyAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
			row.percentage,
			row.monthCount.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
			row.totalSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
			...result.years.map(y => (row.yearlyAmounts[y] || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
			getCompoundOneLine(row)
		];
		navigator.clipboard.writeText(values.join('\t'));
		copiedField = `row-tsv-${row.id}`;
		lastCopiedRowId = row.id;
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copiedField = null;
		}, 1800);
	}

	function copyFullTabTSV() {
		const header = ['Arbeitszeit', 'AG Brutto mtl.', 'Anteil %', 'Monate', 'Summe', ...result.years.map(y => String(y)), 'Komplettzeile (Name, Laufzeit, Tarif, Zeitraum, Erläuterung, Betragstyp)'];
		const rows = activeTab.rows.map(row => [
			row.workingHours,
			row.monthlyAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
			row.percentage,
			row.monthCount.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
			row.totalSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
			...result.years.map(y => (row.yearlyAmounts[y] || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
			getCompoundOneLine(row)
		]);

		const tsv = [header.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
		navigator.clipboard.writeText(tsv);
		copiedField = 'full-tab-tsv';
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copiedField = null;
		}, 1800);
	}

	const playwrightScript = $derived(generatePlaywrightScript(result));
	const automationJson = $derived(JSON.stringify(generateAutomationPayload(result), null, 2));
</script>

<div class="companion-window">
	<!-- Top Window Header -->
	<div class="window-titlebar">
		<div class="titlebar-left">
			<div class="traffic-lights">
				<span class="light red"></span>
				<span class="light yellow"></span>
				<span class="light green"></span>
			</div>
			<span class="window-title">
				Kalkulationshilfe : 4.1.3.1 - Einkommen TLN & Sachkosten ({result.participant.name})
			</span>
		</div>

		<div class="titlebar-actions">
			<button type="button" class="action-btn" onclick={copyFullTabTSV}>
				{#if copiedField === 'full-tab-tsv'}
					✓ Tabellenzeilen kopiert!
				{:else}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
					</svg>
					Tabellenwerte kopieren (TSV)
				{/if}
			</button>

			<button type="button" class="action-btn script-btn" onclick={() => (showScriptModal = true)}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="16 18 22 12 16 6"></polyline>
					<polyline points="8 6 2 12 8 18"></polyline>
				</svg>
				Browser-Automation (Playwright)
			</button>
		</div>
	</div>

	<!-- Top Summary Overview -->
	<div class="summary-overview">
		<div class="overview-table-wrapper">
			<table class="overview-table">
				<thead>
					<tr>
						<th class="col-name">Kostenart</th>
						<th class="col-num">Summe</th>
						{#each result.years as y}
							<th class="col-num">{y}</th>
						{/each}
						<th class="col-status">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each result.tabs as tab}
						<tr class={tab.id === activeTabId ? 'active-row' : ''} onclick={() => (activeTabId = tab.id)}>
							<td class="font-medium">{tab.title}</td>
							<td class="text-right font-mono">{formatCurrency(tab.grandTotal)}</td>
							{#each result.years as y}
								<td class="text-right font-mono">{formatCurrency(tab.yearlyTotals[y] || 0)}</td>
							{/each}
							<td>
								<span class="status-indicator">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Angaben vollständig
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Tab Navigation -->
	<div class="tabs-nav">
		{#each result.tabs as tab}
			<button
				type="button"
				class="tab-btn {tab.id === activeTabId ? 'active' : ''}"
				onclick={() => (activeTabId = tab.id)}
			>
				{tab.title}
			</button>
		{/each}
	</div>

	<!-- Tab Content Area -->
	<div class="tab-content">
		<!-- Quick Legend Toolbar -->
		<div class="table-legend-bar">
			<div class="legend-items">
				<span class="legend-item legend-control">
					<span class="legend-dot dot-control"></span>
					<span class="legend-label">Steuerungs- / Parametereingaben</span>
					<span class="legend-hint">(Arbeitszeit, Anteil %, Monate)</span>
				</span>
				<span class="legend-item legend-sum">
					<span class="legend-dot dot-sum"></span>
					<span class="legend-label">Gesamtsumme (Zeile)</span>
					<span class="legend-hint">(Summe Förderposition)</span>
				</span>
				<span class="legend-item legend-ctrlsum">
					<span class="legend-dot dot-ctrlsum"></span>
					<span class="legend-label">Kontrollsumme</span>
					<span class="legend-hint">(Rechnerischer Prüfwert)</span>
				</span>
				<span class="legend-item legend-data">
					<span class="legend-dot dot-data"></span>
					<span class="legend-label">Finanz- & Jahresbeträge</span>
					<span class="legend-hint">(AG-Brutto mtl., 2026–2031)</span>
				</span>
			</div>
			<div class="legend-right">
				<span class="legend-tip">💡 Klick auf beliebigen Wert kopiert direkt in die Zwischenablage</span>
			</div>
		</div>

		<div class="table-container">
			<table class="target-table">
				<thead>
					<tr>
						<th class="th-action"></th>
						<th class="th-hours th-control-header" title="Steuerungseingabe: Wochenarbeitszeit / TLN-Nummer">
							<span class="th-content"><span class="th-tag control-tag">⚙</span>Arbeitszeit|TLN Nr.</span>
						</th>
						<th class="th-amount th-data-header" title="Datenfeld: Monatlicher AG-Bruttobetrag">
							<span class="th-content">AG Brutto mtl.</span>
						</th>
						<th class="th-pct th-control-header" title="Steuerungseingabe: Fördersatz in %">
							<span class="th-content"><span class="th-tag control-tag">⚙</span>Anteil [%]</span>
						</th>
						<th class="th-months th-control-header" title="Steuerungseingabe: Anzahl der Fördermonate im Berechnungszeitraum">
							<span class="th-content"><span class="th-tag control-tag">⚙</span>Anzahl Monate</span>
						</th>
						<th class="th-sum th-sum-header" title="Gesamtförderbetrag dieser Zeile">
							<span class="th-content"><span class="th-tag sum-tag">∑</span>Summe</span>
						</th>
						{#each result.years as y}
							<th class="th-year th-data-header" title="Datenfeld: Jahresanteil {y}">
								<span class="th-content">{y}</span>
							</th>
						{/each}
						<th class="th-ctrl th-control-sum-header" title="Kontrollsumme: Quersumme zur mathematischen Konsistenzprüfung">
							<span class="th-content"><span class="th-tag ctrl-sum-tag">✓</span>Kontrollsumme</span>
						</th>
						<th class="th-row-action">Aktion</th>
					</tr>
				</thead>
				<tbody>
					{#each activeTab.rows as row, idx (row.id)}
						{@const rowExplanation = getRowExplanation(row)}
						{@const rowCostType = getRowCostType(row)}
						{@const compoundText = getCompoundOneLine(row)}
						{@const isLastCopied = lastCopiedRowId === row.id}
						{@const isEven = idx % 2 === 0}

						<!-- 1. Numeric Values Data Row -->
						<tr class="data-row {isEven ? 'row-even' : 'row-odd'} {row.isOffsetRow ? 'offset-row' : ''} {isLastCopied ? 'last-copied-row' : ''}">
							<td class="td-row-num">
								<span class="row-badge {isLastCopied ? 'badge-highlight' : ''}" title="Förderzeile {row.rowNumber}">
									{#if isLastCopied}
										<span class="active-dot" title="Zuletzt kopierte Zeile">●</span>
									{/if}
									{row.rowNumber}
								</span>
							</td>

							<!-- Arbeitszeit / Stunden (Steuerungseingabe) -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn cell-control cell-hours {copiedField === `hours-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.workingHours, `hours-${row.id}`, row.id)}
									title="Steuerungseingabe: Arbeitszeit kopieren ({row.workingHours})"
								>
									<span>{row.workingHours}</span>
									{#if copiedField === `hours-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- AG Brutto mtl. (Datenfeld) -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn cell-data font-mono {copiedField === `monthly-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.monthlyAmount, `monthly-${row.id}`, row.id)}
									title="Datenfeld: AG Brutto monatlich kopieren"
								>
									<span>{row.monthlyAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
									{#if copiedField === `monthly-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Anteil % (Steuerungseingabe) -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn cell-control cell-pct {copiedField === `pct-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.percentage, `pct-${row.id}`, row.id)}
									title="Steuerungseingabe: Förderquote {row.percentage}% kopieren"
								>
									<span>{row.percentage}</span>
									{#if copiedField === `pct-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Anzahl Monate (Steuerungseingabe) -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn cell-control cell-months {copiedField === `months-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.monthCount, `months-${row.id}`, row.id, true)}
									title="Steuerungseingabe: Monatsanzahl {row.monthCount} kopieren"
								>
									<span>{row.monthCount.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
									{#if copiedField === `months-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Summe (Gesamtsumme Position - Gold/Amber) -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono font-bold {copiedField === `sum-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.totalSum, `sum-${row.id}`, row.id)}
									title="Gesamtsumme: Positionssumme {formatCurrency(row.totalSum)} kopieren"
								>
									<span>{formatCurrency(row.totalSum)}</span>
									{#if copiedField === `sum-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Jahre (Datenfelder) -->
							{#each result.years as y}
								{@const yVal = row.yearlyAmounts[y] || 0}
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-data cell-year font-mono {yVal === 0 ? 'cell-zero' : ''} {copiedField === `y-${y}-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(yVal, `y-${y}-${row.id}`, row.id)}
										title="Datenfeld: Jahreswert {y} ({formatCurrency(yVal)}) kopieren"
									>
										<span>{formatCurrency(yVal)}</span>
										{#if copiedField === `y-${y}-${row.id}`}
											<span class="copied-tooltip">✓</span>
										{/if}
									</button>
								</td>
							{/each}

							<!-- Kontrollsumme (Kontrollwert / Checksumme) -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn cell-control-sum font-mono font-bold {copiedField === `ctrl-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.controlSum, `ctrl-${row.id}`, row.id)}
									title="Kontrollsumme: Quersummen-Prüfwert {formatCurrency(row.controlSum)} kopieren"
								>
									<span>{formatCurrency(row.controlSum)}</span>
									{#if copiedField === `ctrl-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Row Copy Helper -->
							<td class="td-action">
								<button
									type="button"
									class="copy-row-btn {isLastCopied ? 'btn-active-row' : ''}"
									onclick={() => copyRowTSV(row)}
									title="Ganze Zeile als Tabellenwerte kopieren (TSV)"
								>
									{#if copiedField === `row-tsv-${row.id}`}
										✓ Kopiert
									{:else}
										Kopieren
									{/if}
								</button>
							</td>
						</tr>

						<!-- Sub-Row 1: Individual Entities (Name, Laufzeit, Tarif, Zeitraum, Erläuterung, Betragstyp einzeln kopierbar) -->
						<tr class="sub-row-meta {isEven ? 'row-even' : 'row-odd'} {row.isOffsetRow ? 'offset-row' : ''} {isLastCopied ? 'last-copied-row' : ''}">
							<td colspan={7 + result.years.length} class="meta-td">
								<div class="meta-content">
									{#if isLastCopied}
										<div class="last-active-indicator" title="Diese Zeile wird gerade bearbeitet">
											<span class="pulse-indicator"></span>
											<span>Aktive Zeile</span>
										</div>
									{/if}

									<!-- 1. Name -->
									<button
										type="button"
										class="copy-meta-btn meta-name-btn {copiedField === `name-${row.id}` ? 'btn-copied' : ''}"
										onclick={() => copyToClipboard(row.participantName, `name-${row.id}`, row.id)}
										title="Name einzeln kopieren"
									>
										<span class="meta-label">Name:</span>
										<span class="meta-val">{row.participantName}</span>
										{#if copiedField === `name-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
									</button>

									<!-- 2. Laufzeit -->
									<button
										type="button"
										class="copy-meta-btn meta-runtime-btn {copiedField === `rt-${row.id}` ? 'btn-copied' : ''}"
										onclick={() => copyToClipboard(row.runtimeText, `rt-${row.id}`, row.id)}
										title="Laufzeit einzeln kopieren"
									>
										<span class="meta-label">Laufzeit:</span>
										<span class="meta-val">{row.runtimeText}</span>
										{#if copiedField === `rt-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
									</button>

									<!-- 3. Tarif -->
									<button
										type="button"
										class="copy-meta-btn meta-tariff-btn {copiedField === `tf-${row.id}` ? 'btn-copied' : ''}"
										onclick={() => copyToClipboard(row.tariffText, `tf-${row.id}`, row.id)}
										title="Tarif einzeln kopieren"
									>
										<span class="meta-label">Tarif:</span>
										<span class="meta-val">{row.tariffText}</span>
										{#if copiedField === `tf-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
									</button>

									<!-- 4. Zeitraum -->
									<button
										type="button"
										class="copy-meta-btn meta-period-btn {copiedField === `cp-${row.id}` ? 'btn-copied' : ''}"
										onclick={() => copyToClipboard(row.calculationPeriodText, `cp-${row.id}`, row.id)}
										title="Berechnungszeitraum einzeln kopieren"
									>
										<span class="meta-label">Zeitraum:</span>
										<span class="meta-val">{row.calculationPeriodText}</span>
										{#if copiedField === `cp-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
									</button>

									<!-- 5. Erläuterung (nur wenn vorhanden) -->
									{#if rowExplanation}
										<button
											type="button"
											class="copy-meta-btn highlight-btn {copiedField === `exp-${row.id}` ? 'btn-copied' : ''}"
											onclick={() => copyToClipboard(rowExplanation, `exp-${row.id}`, row.id)}
											title="Erläuterung einzeln kopieren"
										>
											<span class="meta-label">Erläuterung:</span>
											<span class="meta-val">{rowExplanation}</span>
											{#if copiedField === `exp-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
										</button>
									{/if}

									<!-- 6. Betragstyp -->
									<button
										type="button"
										class="copy-meta-btn cost-type-btn {copiedField === `cost-${row.id}` ? 'btn-copied' : ''}"
										onclick={() => copyToClipboard(rowCostType, `cost-${row.id}`, row.id)}
										title="Betragstyp einzeln kopieren"
									>
										<span class="meta-label">Betragstyp:</span>
										<span class="meta-val">{rowCostType}</span>
										{#if copiedField === `cost-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
									</button>
								</div>
							</td>
						</tr>

						<!-- Sub-Row 2: Compound One-Line Text (Name, Laufzeit, Tarif, Zeitraum, Erläuterung, Betragstyp in einer Zeile mit 5 Leerzeichen getrennt) -->
						<tr class="sub-row-desc {isEven ? 'row-even' : 'row-odd'} {row.isOffsetRow ? 'offset-row' : ''} {isLastCopied ? 'last-copied-row' : ''}">
							<td colspan={7 + result.years.length} class="desc-td">
								<div class="desc-container">
									<div
										class="desc-display-box {isLastCopied ? 'active-desc-box' : ''}"
										onclick={() => copyToClipboard(compoundText, `compound-${row.id}`, row.id)}
										role="button"
										tabindex="0"
										onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') copyToClipboard(compoundText, `compound-${row.id}`, row.id); }}
										title="Klicken zum Kopieren des vollständigen einzeiligen Textes (5 Leerzeichen getrennt)"
									>
										<span class="desc-badge">Komplettzeile:</span>
										<span class="desc-text font-mono">{compoundText}</span>
									</div>

									<button
										type="button"
										class="desc-copy-action-btn {copiedField === `compound-${row.id}` ? 'action-copied' : ''} {isLastCopied ? 'active-action-btn' : ''}"
										onclick={() => copyToClipboard(compoundText, `compound-${row.id}`, row.id)}
										title="Kompletten einzeiligen Text kopieren"
									>
										{#if copiedField === `compound-${row.id}`}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
												<polyline points="20 6 9 17 4 12"></polyline>
											</svg>
											Kopiert!
										{:else}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
												<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
											</svg>
											Kopieren
										{/if}
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="total-footer-row">
						<td></td>
						<td colspan="4" class="text-right font-bold">Summe {activeTab.title}:</td>
						<td class="font-mono font-bold text-right">{formatCurrency(activeTab.grandTotal)}</td>
						{#each result.years as y}
							<td class="font-mono font-bold text-right">{formatCurrency(activeTab.yearlyTotals[y] || 0)}</td>
						{/each}
						<td class="font-mono font-bold text-right">{formatCurrency(activeTab.grandTotal)}</td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		</div>
	</div>
</div>

<!-- Modal for Automation Script -->
{#if showScriptModal}
	<div
		class="modal-backdrop"
		onclick={() => (showScriptModal = false)}
		onkeydown={(e) => { if (e.key === 'Escape') showScriptModal = false; }}
		tabindex="-1"
		role="presentation"
	>
		<div
			class="modal-content"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-label="Browser Automation Script"
			tabindex="0"
		>
			<div class="modal-header">
				<h3>Browser-Automation Payload & Script</h3>
				<button type="button" class="close-btn" onclick={() => (showScriptModal = false)}>✕</button>
			</div>

			<p class="modal-intro">
				Für die zukünftige automatisierte Übernahme in das Formular via Browser-Subagent oder Playwright-Runner:
			</p>

			<div class="modal-body">
				<div class="code-header">
					<span>Playwright Test Script (Automatische Formularausfüllung)</span>
					<button
						type="button"
						class="btn btn-secondary btn-sm"
						onclick={() => copyToClipboard(playwrightScript, 'modal-script')}
					>
						{#if copiedField === 'modal-script'}✓ Skript kopiert{:else}Skript kopieren{/if}
					</button>
				</div>
				<pre class="code-block"><code>{playwrightScript}</code></pre>

				<div class="code-header" style="margin-top: 1.5rem;">
					<span>Strukturierter Automation-Payload (JSON)</span>
					<button
						type="button"
						class="btn btn-secondary btn-sm"
						onclick={() => copyToClipboard(automationJson, 'modal-json')}
					>
						{#if copiedField === 'modal-json'}✓ JSON kopiert{:else}JSON kopieren{/if}
					</button>
				</div>
				<pre class="code-block"><code>{automationJson}</code></pre>
			</div>
		</div>
	</div>
{/if}

<style>
	.companion-window {
		background: rgba(15, 23, 42, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 16px;
		margin: 2rem 0;
		box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(16px);
		position: relative;
	}

	.window-titlebar {
		background: rgba(30, 41, 59, 0.85);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		border-top-left-radius: 16px;
		border-top-right-radius: 16px;
		padding: 0.85rem 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.titlebar-left {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.traffic-lights {
		display: flex;
		gap: 6px;
	}

	.light {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.light.red { background: #ef4444; }
	.light.yellow { background: #f59e0b; }
	.light.green { background: #10b981; }

	.window-title {
		font-size: 0.925rem;
		font-weight: 600;
		color: #f1f5f9;
	}

	.titlebar-actions {
		display: flex;
		gap: 0.65rem;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.4rem 0.75rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		color: #e2e8f0;
		font-size: 0.825rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.script-btn {
		background: rgba(99, 102, 241, 0.2);
		border-color: rgba(99, 102, 241, 0.4);
		color: #c7d2fe;
	}

	.script-btn:hover {
		background: rgba(99, 102, 241, 0.35);
		color: #ffffff;
	}

	.summary-overview {
		padding: 1rem 1.25rem;
		background: rgba(30, 41, 59, 0.4);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.overview-table-wrapper {
		overflow-x: auto;
	}

	.overview-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.overview-table th {
		padding: 0.55rem 0.75rem;
		color: #94a3b8;
		font-weight: 600;
		text-align: left;
		border-bottom: 2px solid rgba(255, 255, 255, 0.12);
	}

	.overview-table td {
		padding: 0.55rem 0.75rem;
		color: #e2e8f0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.overview-table tr {
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.overview-table tr:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.overview-table tr.active-row {
		background: rgba(99, 102, 241, 0.18);
		border-left: 3px solid #818cf8;
	}

	.status-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: #34d399;
		font-size: 0.8rem;
		font-weight: 500;
	}

	/* Sticky Tabs Navigation Bar */
	.tabs-nav {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		background: #0b1120;
		background: rgba(11, 17, 32, 0.98);
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
		padding: 0 0.75rem;
		overflow-x: auto;
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}

	.tab-btn {
		padding: 0.75rem 1.25rem;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: #94a3b8;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s ease;
	}

	.tab-btn:hover {
		color: #f1f5f9;
	}

	.tab-btn.active {
		color: #ffffff;
		border-bottom-color: #6366f1;
		background: rgba(99, 102, 241, 0.12);
	}

	.tab-content {
		padding: 0 1.25rem 1.25rem 1.25rem;
	}

	/* Quick Legend Toolbar */
	.table-legend-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.85rem 0.25rem 0.75rem 0.25rem;
		font-size: 0.8rem;
	}

	.legend-items {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1.25rem;
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		display: inline-block;
	}

	.dot-control {
		background: rgba(14, 165, 233, 0.3);
		border: 1.5px solid #38bdf8;
		box-shadow: 0 0 6px rgba(56, 189, 248, 0.4);
	}

	.dot-sum {
		background: rgba(245, 158, 11, 0.3);
		border: 1.5px solid #fbbf24;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
	}

	.dot-ctrlsum {
		background: rgba(139, 92, 246, 0.3);
		border: 1.5px solid #a78bfa;
		box-shadow: 0 0 6px rgba(167, 139, 250, 0.4);
	}

	.dot-data {
		background: rgba(30, 41, 59, 0.9);
		border: 1.5px solid rgba(255, 255, 255, 0.3);
	}

	.legend-label {
		font-weight: 600;
	}

	.legend-control .legend-label {
		color: #7dd3fc;
	}

	.legend-sum .legend-label {
		color: #fde68a;
	}

	.legend-ctrlsum .legend-label {
		color: #c084fc;
	}

	.legend-data .legend-label {
		color: #e2e8f0;
	}

	.legend-hint {
		color: #64748b;
		font-size: 0.725rem;
	}

	.legend-tip {
		color: #94a3b8;
		font-size: 0.775rem;
	}

	.table-container {
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		background: rgba(15, 23, 42, 0.7);
		overflow-x: auto;
		overflow-y: visible;
		max-width: 100%;
		box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25);
		scrollbar-width: thin;
		scrollbar-color: rgba(99, 102, 241, 0.5) rgba(15, 23, 42, 0.8);
	}

	.table-container::-webkit-scrollbar {
		height: 8px;
	}

	.table-container::-webkit-scrollbar-track {
		background: rgba(15, 23, 42, 0.8);
		border-bottom-left-radius: 12px;
		border-bottom-right-radius: 12px;
	}

	.table-container::-webkit-scrollbar-thumb {
		background: rgba(99, 102, 241, 0.5);
		border-radius: 4px;
	}

	.table-container::-webkit-scrollbar-thumb:hover {
		background: rgba(99, 102, 241, 0.8);
	}

	.target-table {
		width: 100%;
		min-width: 1180px;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.85rem;
	}

	/* Sticky Table Header */
	.target-table thead {
		position: sticky;
		top: 0;
		z-index: 90;
	}

	.target-table th {
		position: sticky;
		top: 0;
		z-index: 90;
		background: #111827;
		background: rgba(17, 24, 39, 0.99);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		color: #94a3b8;
		padding: 0.65rem 0.4rem;
		font-weight: 600;
		font-size: 0.775rem;
		text-align: right;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: 2px solid rgba(99, 102, 241, 0.5);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		user-select: none;
	}

	.target-table th.th-action,
	.target-table th.th-row-action {
		text-align: center;
		padding: 0.65rem 0.35rem;
	}

	.target-table th.th-hours {
		text-align: center;
	}

	.th-content {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}

	.th-tag {
		font-size: 0.65rem;
		padding: 1px 3px;
		border-radius: 3px;
		font-weight: 700;
	}

	.th-control-header {
		color: #38bdf8 !important;
	}

	.control-tag {
		background: rgba(14, 165, 233, 0.2);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.4);
	}

	.th-sum-header {
		color: #fbbf24 !important;
	}

	.sum-tag {
		background: rgba(245, 158, 11, 0.2);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.4);
	}

	.th-control-sum-header {
		color: #c084fc !important;
	}

	.ctrl-sum-tag {
		background: rgba(139, 92, 246, 0.2);
		color: #c084fc;
		border: 1px solid rgba(167, 139, 250, 0.4);
	}

	.th-data-header {
		color: #cbd5e1;
	}

	/* Distinct Row Separation & Zebra Grouping */
	.data-row {
		border-top: 3px solid rgba(99, 102, 241, 0.4);
		transition: background 0.15s ease;
	}

	.target-table tbody tr:first-child.data-row {
		border-top: none;
	}

	.row-even {
		background: rgba(30, 41, 59, 0.32);
	}

	.row-odd {
		background: rgba(15, 23, 42, 0.55);
	}

	.data-row:hover,
	.sub-row-meta:hover,
	.sub-row-desc:hover {
		background: rgba(99, 102, 241, 0.12) !important;
	}

	.offset-row {
		background: rgba(14, 165, 233, 0.08) !important;
	}

	.offset-row.data-row {
		border-top: 3px solid rgba(56, 189, 248, 0.6);
	}

	/* Last Copied Row Highlight Styling */
	.last-copied-row {
		background: rgba(99, 102, 241, 0.22) !important;
	}

	.data-row.last-copied-row {
		border-top: 3px solid #818cf8 !important;
	}

	.sub-row-desc.last-copied-row td {
		border-bottom: 3px solid #818cf8 !important;
	}

	.td-row-num {
		padding: 0.55rem 0.35rem 0.3rem 0.6rem;
		text-align: center;
		width: 52px;
		vertical-align: middle;
	}

	.row-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		min-width: 32px;
		height: 24px;
		padding: 0 6px;
		border-radius: 6px;
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(129, 140, 248, 0.4);
		font-weight: 700;
		color: #c7d2fe;
		font-size: 0.8rem;
		font-family: monospace;
	}

	.offset-row .row-badge {
		background: rgba(14, 165, 233, 0.22);
		border-color: rgba(56, 189, 248, 0.5);
		color: #38bdf8;
	}

	.badge-highlight {
		background: rgba(99, 102, 241, 0.55) !important;
		border-color: #818cf8 !important;
		color: #ffffff !important;
		box-shadow: 0 0 10px rgba(129, 140, 248, 0.6);
	}

	.active-dot {
		color: #818cf8;
		animation: pulse-dot 1.5s infinite;
		font-size: 0.75rem;
	}

	@keyframes pulse-dot {
		0% { transform: scale(0.9); opacity: 0.7; }
		50% { transform: scale(1.3); opacity: 1; }
		100% { transform: scale(0.9); opacity: 0.7; }
	}

	.last-active-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(99, 102, 241, 0.25);
		border: 1px solid rgba(129, 140, 248, 0.5);
		border-radius: 4px;
		padding: 0.2rem 0.5rem;
		font-size: 0.725rem;
		font-weight: 700;
		color: #e0e7ff;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.pulse-indicator {
		width: 7px;
		height: 7px;
		background: #818cf8;
		border-radius: 50%;
		box-shadow: 0 0 8px #818cf8;
		animation: pulse-dot 1.5s infinite;
	}

	.td-cell {
		padding: 0.4rem 0.3rem 0.25rem 0.3rem;
		text-align: right;
		vertical-align: middle;
	}

	/* Base Copy Button */
	.copy-cell-btn {
		width: 100%;
		border-radius: 6px;
		padding: 0.35rem 0.4rem;
		font-size: 0.825rem;
		text-align: right;
		cursor: pointer;
		position: relative;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	/* 1. Control / Parameter Inputs (Arbeitszeit, Anteil %, Monate) - Sky/Cyan */
	.copy-cell-btn.cell-control {
		background: rgba(14, 165, 233, 0.12);
		border: 1px solid rgba(56, 189, 248, 0.38);
		color: #7dd3fc;
		font-weight: 600;
		text-align: center;
	}

	.copy-cell-btn.cell-control:hover {
		background: rgba(14, 165, 233, 0.28);
		border-color: #38bdf8;
		color: #ffffff;
		box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
		transform: translateY(-1px);
	}

	/* 2. Position Total / Summe - Warm Amber/Gold */
	.copy-cell-btn.cell-sum {
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(245, 158, 11, 0.4);
		color: #fde68a;
		font-weight: 700;
	}

	.copy-cell-btn.cell-sum:hover {
		background: rgba(245, 158, 11, 0.28);
		border-color: #fbbf24;
		color: #ffffff;
		box-shadow: 0 0 12px rgba(245, 158, 11, 0.45);
		transform: translateY(-1px);
	}

	/* 3. Control Sum / Checksum (Kontrollsumme) - Soft Violet/Purple */
	.copy-cell-btn.cell-control-sum {
		background: rgba(139, 92, 246, 0.14);
		border: 1px solid rgba(167, 139, 250, 0.38);
		color: #ddd6fe;
	}

	.copy-cell-btn.cell-control-sum:hover {
		background: rgba(139, 92, 246, 0.28);
		border-color: #a78bfa;
		color: #ffffff;
		box-shadow: 0 0 12px rgba(167, 139, 250, 0.45);
		transform: translateY(-1px);
	}

	/* 4. Financial / Numerical Data Fields (AG-Brutto, Jahreswerte) - Slate/White */
	.copy-cell-btn.cell-data {
		background: rgba(30, 41, 59, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #f1f5f9;
	}

	.copy-cell-btn.cell-data:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: #818cf8;
		color: #ffffff;
		box-shadow: 0 0 12px rgba(99, 102, 241, 0.35);
		transform: translateY(-1px);
	}

	.copy-cell-btn.cell-zero {
		color: #64748b;
		opacity: 0.75;
	}

	.copy-cell-btn.cell-zero:hover {
		color: #ffffff;
		opacity: 1;
	}

	/* Common Cell Copied Feedback */
	.copy-cell-btn.cell-just-copied {
		background: rgba(16, 185, 129, 0.35) !important;
		border-color: #34d399 !important;
		color: #ffffff !important;
		box-shadow: 0 0 12px rgba(52, 211, 153, 0.5) !important;
	}

	.copied-tooltip {
		position: absolute;
		top: -12px;
		right: 4px;
		background: #10b981;
		color: white;
		font-size: 0.7rem;
		padding: 1px 4px;
		border-radius: 3px;
		font-weight: bold;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		z-index: 10;
	}

	.td-action {
		padding: 0.4rem 0.4rem 0.25rem 0.4rem;
		text-align: center;
		vertical-align: middle;
	}

	.copy-row-btn {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		color: #cbd5e1;
		padding: 0.35rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.copy-row-btn:hover {
		background: #6366f1;
		color: white;
		border-color: #6366f1;
	}

	.copy-row-btn.btn-active-row {
		background: rgba(99, 102, 241, 0.3);
		border-color: #818cf8;
		color: #ffffff;
	}

	.sub-row-meta td {
		padding: 0.3rem 0.75rem 0.3rem 1.25rem;
		transition: background 0.15s ease;
	}

	.meta-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.copy-meta-btn {
		background: rgba(30, 41, 59, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #e2e8f0;
		padding: 0.25rem 0.55rem;
		font-size: 0.785rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 0.15s ease;
	}

	.copy-meta-btn:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: #818cf8;
		color: white;
		transform: translateY(-1px);
	}

	.copy-meta-btn.meta-runtime-btn {
		background: rgba(14, 165, 233, 0.1);
		border-color: rgba(56, 189, 248, 0.3);
		color: #bae6fd;
	}

	.copy-meta-btn.meta-runtime-btn:hover {
		background: rgba(14, 165, 233, 0.22);
		border-color: #38bdf8;
	}

	.copy-meta-btn.meta-period-btn {
		background: rgba(14, 165, 233, 0.1);
		border-color: rgba(56, 189, 248, 0.3);
		color: #bae6fd;
	}

	.copy-meta-btn.meta-period-btn:hover {
		background: rgba(14, 165, 233, 0.22);
		border-color: #38bdf8;
	}

	.copy-meta-btn.highlight-btn {
		background: rgba(245, 158, 11, 0.14);
		border-color: rgba(245, 158, 11, 0.4);
		color: #fde68a;
	}

	.copy-meta-btn.highlight-btn:hover {
		background: rgba(245, 158, 11, 0.28);
		border-color: #fbbf24;
	}

	.copy-meta-btn.cost-type-btn {
		background: rgba(16, 185, 129, 0.14);
		border-color: rgba(16, 185, 129, 0.4);
		color: #a7f3d0;
	}

	.copy-meta-btn.cost-type-btn:hover {
		background: rgba(16, 185, 129, 0.28);
		border-color: #34d399;
	}

	.copy-meta-btn.btn-copied {
		background: rgba(16, 185, 129, 0.3);
		border-color: #10b981;
		color: #ffffff;
	}

	.meta-label {
		color: #94a3b8;
		font-weight: 600;
		font-size: 0.725rem;
	}

	.meta-val {
		font-weight: 500;
	}

	.copy-icon {
		opacity: 0.6;
		font-size: 0.8rem;
	}

	.copied-inline {
		color: #34d399;
		font-weight: bold;
	}

	.sub-row-desc td {
		padding: 0.25rem 0.75rem 1rem 1.25rem;
		border-bottom: 2px solid rgba(255, 255, 255, 0.1);
		transition: background 0.15s ease;
	}

	.offset-row.sub-row-desc td {
		border-bottom: 2px solid rgba(56, 189, 248, 0.35);
	}

	.desc-container {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
	}

	.desc-display-box {
		flex: 1;
		min-width: 0;
		background: rgba(30, 41, 59, 0.9);
		border: 1px solid rgba(99, 102, 241, 0.35);
		border-radius: 6px;
		padding: 0.45rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		cursor: pointer;
		transition: all 0.15s ease;
		overflow: hidden;
	}

	.desc-display-box:hover {
		background: rgba(99, 102, 241, 0.18);
		border-color: #818cf8;
	}

	.desc-display-box.active-desc-box {
		background: rgba(30, 41, 59, 0.98);
		border-color: #818cf8;
		box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
	}

	.desc-badge {
		font-size: 0.725rem;
		font-weight: 700;
		color: #818cf8;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.desc-text {
		font-size: 0.825rem;
		color: #f1f5f9;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: anywhere;
	}

	.desc-copy-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.85rem;
		background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		color: #ffffff;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
		box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
	}

	.desc-copy-action-btn:hover {
		background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
		box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45);
		transform: translateY(-1px);
	}

	.desc-copy-action-btn.action-copied {
		background: #10b981;
		border-color: #10b981;
	}

	.desc-copy-action-btn.active-action-btn {
		box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
	}

	.total-footer-row td {
		padding: 0.85rem 0.6rem;
		background: rgba(30, 41, 59, 0.95);
		color: #ffffff;
		border-top: 2px solid rgba(99, 102, 241, 0.4);
		border-bottom-left-radius: 10px;
		border-bottom-right-radius: 10px;
		font-size: 0.9rem;
	}

	.text-right { text-align: right; }
	.font-mono { font-family: monospace; }
	.font-bold { font-weight: 700; }
	.font-medium { font-weight: 500; }

	/* Modal Styles */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.modal-content {
		background: #0f172a;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 16px;
		width: 100%;
		max-width: 850px;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
		overflow: hidden;
	}

	.modal-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.15rem;
		color: #f8fafc;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		font-size: 1.25rem;
		cursor: pointer;
	}

	.close-btn:hover { color: white; }

	.modal-intro {
		padding: 0.75rem 1.5rem 0 1.5rem;
		font-size: 0.875rem;
		color: #94a3b8;
		margin: 0;
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
	}

	.code-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.btn-sm {
		padding: 0.25rem 0.65rem;
		font-size: 0.775rem;
	}

	.code-block {
		background: #090d16;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 1rem;
		overflow-x: auto;
		color: #e2e8f0;
		font-family: monospace;
		font-size: 0.8rem;
		max-height: 220px;
	}
</style>
