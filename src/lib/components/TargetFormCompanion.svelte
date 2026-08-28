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
		<div class="table-container">
			<table class="target-table">
				<thead>
					<tr>
						<th class="th-action"></th>
						<th class="th-hours">Arbeitszeit|TLN Nr.</th>
						<th class="th-amount">AG Brutto mtl.</th>
						<th class="th-pct">Anteil [%]</th>
						<th class="th-months">Anzahl Monate</th>
						<th class="th-sum">Summe</th>
						{#each result.years as y}
							<th class="th-year">{y}</th>
						{/each}
						<th class="th-ctrl">Kontrollsumme</th>
						<th class="th-row-action">Aktion</th>
					</tr>
				</thead>
				<tbody>
					{#each activeTab.rows as row (row.id)}
						{@const rowExplanation = getRowExplanation(row)}
						{@const rowCostType = getRowCostType(row)}
						{@const compoundText = getCompoundOneLine(row)}
						{@const isLastCopied = lastCopiedRowId === row.id}

						<tr class="data-row {row.isOffsetRow ? 'offset-row' : ''} {isLastCopied ? 'last-copied-row' : ''}">
							<td class="td-row-num">
								<span class="row-badge {isLastCopied ? 'badge-highlight' : ''}">
									{#if isLastCopied}
										<span class="active-dot" title="Zuletzt kopierte Zeile">●</span>
									{:else}
										<span class="minus-icon">−</span>
									{/if}
									{row.rowNumber}
								</span>
							</td>

							<!-- Arbeitszeit / Stunden -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn {copiedField === `hours-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.workingHours, `hours-${row.id}`, row.id)}
									title="Klicken zum Kopieren"
								>
									<span>{row.workingHours}</span>
									{#if copiedField === `hours-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- AG Brutto mtl. -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn font-mono {copiedField === `monthly-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.monthlyAmount, `monthly-${row.id}`, row.id)}
									title="Klicken zum Kopieren"
								>
									<span>{row.monthlyAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
									{#if copiedField === `monthly-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Anteil % -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn {copiedField === `pct-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.percentage, `pct-${row.id}`, row.id)}
									title="Klicken zum Kopieren"
								>
									<span>{row.percentage}</span>
									{#if copiedField === `pct-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Anzahl Monate -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn {copiedField === `months-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.monthCount, `months-${row.id}`, row.id, true)}
									title="Klicken zum Kopieren"
								>
									<span>{row.monthCount.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
									{#if copiedField === `months-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Summe -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn font-mono font-bold {copiedField === `sum-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.totalSum, `sum-${row.id}`, row.id)}
									title="Klicken zum Kopieren"
								>
									<span>{formatCurrency(row.totalSum)}</span>
									{#if copiedField === `sum-${row.id}`}
										<span class="copied-tooltip">✓</span>
									{/if}
								</button>
							</td>

							<!-- Jahre -->
							{#each result.years as y}
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn font-mono {copiedField === `y-${y}-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(row.yearlyAmounts[y] || 0, `y-${y}-${row.id}`, row.id)}
										title="Klicken zum Kopieren"
									>
										<span>{formatCurrency(row.yearlyAmounts[y] || 0)}</span>
										{#if copiedField === `y-${y}-${row.id}`}
											<span class="copied-tooltip">✓</span>
										{/if}
									</button>
								</td>
							{/each}

							<!-- Kontrollsumme -->
							<td class="td-cell">
								<button
									type="button"
									class="copy-cell-btn font-mono font-bold {copiedField === `ctrl-${row.id}` ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(row.controlSum, `ctrl-${row.id}`, row.id)}
									title="Klicken zum Kopieren"
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
									title="Ganze Zeile als Tabellenwerte kopieren"
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
						<tr class="sub-row-meta {row.isOffsetRow ? 'offset-row' : ''} {isLastCopied ? 'last-copied-row' : ''}">
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
										class="copy-meta-btn {copiedField === `name-${row.id}` ? 'btn-copied' : ''}"
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
										class="copy-meta-btn {copiedField === `rt-${row.id}` ? 'btn-copied' : ''}"
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
										class="copy-meta-btn {copiedField === `tf-${row.id}` ? 'btn-copied' : ''}"
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
										class="copy-meta-btn {copiedField === `cp-${row.id}` ? 'btn-copied' : ''}"
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
						<tr class="sub-row-desc {row.isOffsetRow ? 'offset-row' : ''} {isLastCopied ? 'last-copied-row' : ''}">
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
		overflow: hidden;
		margin: 2rem 0;
		box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(16px);
	}

	.window-titlebar {
		background: rgba(30, 41, 59, 0.85);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
		padding: 0.4rem 0.65rem;
		color: #94a3b8;
		font-weight: 600;
		text-align: left;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.overview-table td {
		padding: 0.45rem 0.65rem;
		color: #e2e8f0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.overview-table tr {
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.overview-table tr:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.overview-table tr.active-row {
		background: rgba(99, 102, 241, 0.15);
	}

	.status-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: #34d399;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.tabs-nav {
		display: flex;
		background: rgba(15, 23, 42, 0.9);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0 0.75rem;
		overflow-x: auto;
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
		background: rgba(99, 102, 241, 0.08);
	}

	.tab-content {
		padding: 1.25rem;
	}

	.table-container {
		overflow-x: auto;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
	}

	.target-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.target-table th {
		background: rgba(30, 41, 59, 0.8);
		color: #94a3b8;
		padding: 0.65rem 0.6rem;
		font-weight: 600;
		font-size: 0.8rem;
		text-align: right;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.target-table th.th-action,
	.target-table th.th-row-action {
		text-align: center;
	}

	.target-table th.th-hours {
		text-align: center;
	}

	.data-row {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		transition: background 0.2s ease;
	}

	.data-row:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.offset-row {
		background: rgba(56, 189, 248, 0.04);
	}

	/* Last Copied Row Highlight Styling */
	.last-copied-row {
		background: rgba(99, 102, 241, 0.14) !important;
		border-left: 4px solid #818cf8 !important;
		box-shadow: inset 4px 0 16px rgba(99, 102, 241, 0.2);
	}

	.last-copied-row:hover {
		background: rgba(99, 102, 241, 0.2) !important;
	}

	.badge-highlight {
		color: #818cf8 !important;
		font-weight: 800 !important;
		text-shadow: 0 0 10px rgba(129, 140, 248, 0.6);
	}

	.active-dot {
		color: #818cf8;
		animation: pulse-dot 1.5s infinite;
		font-size: 0.85rem;
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

	.td-row-num {
		padding: 0.5rem 0.6rem;
		text-align: center;
		width: 52px;
	}

	.row-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-weight: 700;
		color: #ef4444;
		font-size: 0.85rem;
	}

	.td-cell {
		padding: 0.35rem 0.45rem;
		text-align: right;
	}

	.copy-cell-btn {
		width: 100%;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #f1f5f9;
		padding: 0.35rem 0.55rem;
		font-size: 0.85rem;
		text-align: right;
		cursor: pointer;
		position: relative;
		transition: all 0.15s ease;
	}

	.copy-cell-btn:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: #818cf8;
		color: #ffffff;
		box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
	}

	.copy-cell-btn.cell-just-copied {
		background: rgba(16, 185, 129, 0.25);
		border-color: #34d399;
		color: #ffffff;
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
	}

	.copy-row-btn {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 4px;
		color: #cbd5e1;
		padding: 0.3rem 0.6rem;
		font-size: 0.75rem;
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
		padding: 0.4rem 0.6rem 0.35rem 3.5rem;
		transition: background 0.2s ease;
	}

	.meta-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.copy-meta-btn {
		background: rgba(30, 41, 59, 0.75);
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

	.copy-meta-btn.highlight-btn {
		background: rgba(245, 158, 11, 0.12);
		border-color: rgba(245, 158, 11, 0.35);
		color: #fde68a;
	}

	.copy-meta-btn.highlight-btn:hover {
		background: rgba(245, 158, 11, 0.25);
		border-color: #fbbf24;
	}

	.copy-meta-btn.cost-type-btn {
		background: rgba(16, 185, 129, 0.12);
		border-color: rgba(16, 185, 129, 0.35);
		color: #a7f3d0;
	}

	.copy-meta-btn.cost-type-btn:hover {
		background: rgba(16, 185, 129, 0.25);
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
		padding: 0.2rem 0.6rem 0.85rem 3.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		transition: background 0.2s ease;
	}

	.desc-container {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
	}

	.desc-display-box {
		flex: 1;
		background: rgba(30, 41, 59, 0.85);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 6px;
		padding: 0.45rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.desc-display-box:hover {
		background: rgba(99, 102, 241, 0.18);
		border-color: #818cf8;
	}

	.desc-display-box.active-desc-box {
		background: rgba(30, 41, 59, 0.95);
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
