import type { GrantTransformationResult, FormTabDefinition, FormRowItem } from '#lib/types/grant';

export interface AutomationStep {
	tabId: string;
	tabTitle: string;
	tabSelector?: string;
	rows: {
		rowIndex: number;
		fields: {
			name: string;
			selectorHint?: string;
			value: string | number;
			type: 'text' | 'number' | 'currency' | 'select' | 'date';
		}[];
	}[];
}

export interface AutomationPayload {
	grantSchemeId: string;
	participantName: string;
	generatedAt: string;
	steps: AutomationStep[];
}

export function generateAutomationPayload(result: GrantTransformationResult): AutomationPayload {
	const steps: AutomationStep[] = result.tabs.map(tab => {
		return {
			tabId: tab.id,
			tabTitle: tab.title,
			rows: tab.rows.map((row, index) => {
				const fields = [
					{ name: 'Arbeitszeit|TLN Nr.', value: row.workingHours, type: 'number' as const },
					{ name: 'AG Brutto mtl.', value: row.monthlyAmount, type: 'currency' as const },
					{ name: 'Anteil [%]', value: row.percentage, type: 'number' as const },
					{ name: 'Anzahl Monate', value: row.monthCount, type: 'number' as const },
					{ name: 'Summe', value: row.totalSum, type: 'currency' as const },
					...result.years.map(y => ({
						name: String(y),
						value: row.yearlyAmounts[y] || 0,
						type: 'currency' as const
					})),
					{ name: 'Kontrollsumme', value: row.controlSum, type: 'currency' as const },
					{ name: 'Name', value: row.participantName, type: 'text' as const },
					{ name: 'Laufzeit', value: row.runtimeText, type: 'text' as const },
					{ name: 'Tarif', value: row.tariffText, type: 'text' as const },
					{ name: 'Berechnungszeitraum', value: row.calculationPeriodText, type: 'text' as const },
					{ name: 'Beschreibung', value: row.description, type: 'text' as const }
				];

				return {
					rowIndex: index + 1,
					fields
				};
			})
		};
	});

	return {
		grantSchemeId: result.schemeId,
		participantName: result.participant.name,
		generatedAt: new Date().toISOString(),
		steps
	};
}

/**
 * Generates an executable Playwright script snippet for direct web browser automation
 */
export function generatePlaywrightScript(result: GrantTransformationResult): string {
	const payload = generateAutomationPayload(result);
	return `// Playwright Automation Script for Grant Application Form
// Generated on ${new Date().toLocaleString('de-DE')}
import { test, expect } from '@playwright/test';

test('Submit Grant Application for ${result.participant.name}', async ({ page }) => {
  // 1. Navigate to Grant Application Form
  // await page.goto('https://target-grant-app.local/form');

  const payload = ${JSON.stringify(payload, null, 2)};

  for (const step of payload.steps) {
    console.log(\`Filling tab: \${step.tabTitle}\`);
    // Click on Tab
    // await page.getByRole('tab', { name: step.tabTitle }).click();

    for (const row of step.rows) {
      console.log(\`  Row \${row.rowIndex}:\`);
      for (const field of row.fields) {
        console.log(\`    \${field.name}: \${field.value}\`);
        // e.g. await page.locator(\`input[name="\${field.name}_\${row.rowIndex}"]\`).fill(String(field.value));
      }
    }
  }

  // Click Save & Submit
  // await page.getByRole('button', { name: 'Übernehmen und Schließen' }).click();
});
`;
}
