import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
	transformBerlinerJobCoachingMulti,
	calculateProjectWorkingHours,
	getVwkRate,
	generateStandardJobCoachingDemoDatasets
} from './berliner-jobcoaching';
import { generateFinanzierungsplanWorkbook } from './finanzierungsplan-exporter';

describe('Berliner JobCoaching Grant Instrument', () => {
	it('calculates exact project working hours according to formula', () => {
		// 35h, 25 vacation days
		// 52 - 5 - 2 = 45 weeks -> 45 * 35 / 12 = 131.25 h/month
		expect(calculateProjectWorkingHours(35, 25, 6)).toBe(787.5);
		expect(calculateProjectWorkingHours(35, 25, 2)).toBe(262.5);

		// 39h, 30 vacation days
		// 52 - 6 - 2 = 44 weeks -> 44 * 39 / 12 = 143.0 h/month
		expect(calculateProjectWorkingHours(39, 30, 6)).toBe(858);
		expect(calculateProjectWorkingHours(39, 30, 2)).toBe(286);
	});

	it('returns correct graduated Vwk rate based on staff count', () => {
		expect(getVwkRate(1)).toBe(0.044); // 4.40%
		expect(getVwkRate(2)).toBe(0.0247); // 2.47%
		expect(getVwkRate(3)).toBe(0.0183); // 1.83%
		expect(getVwkRate(4)).toBe(0.0151); // 1.51%
		expect(getVwkRate(10)).toBe(0.0093); // 0.93%
	});

	it('transforms standard employee progression scheme adhering to AWO Berlin Tariff rules', () => {
		// Generates 2 standard sample employees for 2027:
		// 1. Alex Mustercoach: Jobcoach, EG10, 39h, entry 01.01.2026. Stufe 2, Tariferhöhung on 01.07.2027 (+2%).
		// 2. Sam Mustertrainer: Beschäftigungstrainer, EG9, 30h, entry 01.07.2026. Stufenaufstieg to ES2 on 01.07.2027 (+2%).
		const datasets = generateStandardJobCoachingDemoDatasets(2027);

		const result = transformBerlinerJobCoachingMulti(datasets, {
			includeOffsetRows: true,
			runtimeStartScope: 'custom',
			customStartDate: '01.01.2027',
			runtimeScope: 'custom',
			customEndDate: '31.12.2027'
		});

		expect(result.schemeId).toBe('berliner-jobcoaching');
		expect(result.jobCoachingData).toBeDefined();

		const jc = result.jobCoachingData!;
		// Both employees have 2 segments (Jan-Jun and Jul-Dec) -> 4 rows total
		expect(jc.betreuungRows).toHaveLength(4);

		// Row 1: Alex Mustercoach Jan-Jun (EG10/ES2)
		const r1 = jc.betreuungRows[0];
		expect(r1.employeeName).toBe('Alex Mustercoach');
		expect(r1.role).toBe('jobcoach');
		expect(r1.qualification).toBe('JobCoach');
		expect(r1.analogTariff).toBe('AWO Berlin EG10/ES2');
		expect(r1.monthCount).toBe(6);
		expect(r1.weeklyHours).toBe(39);
		expect(r1.vacationDays).toBe(30);
		expect(r1.workingHoursProject).toBe(858);
		expect(r1.monthlyGross).toBe(4192.45);
		expect(r1.monthlyAga).toBe(970.13); // 4192.45 * 0.2314

		// Row 2: Alex Mustercoach Jul-Dec (EG10/ES2 with 2% Tariferhöhung)
		const r2 = jc.betreuungRows[1];
		expect(r2.employeeName).toBe('Alex Mustercoach');
		expect(r2.monthCount).toBe(6);
		expect(r2.monthlyGross).toBe(4276.3);
		expect(r2.monthlyAga).toBe(989.54); // 4276.30 * 0.2314
		expect(r2.note).toContain('Tarifsteigerung zum 01.07.2027');

		// Row 3: Sam Mustertrainer Jan-Jun (EG9/ES1, 30h)
		const r3 = jc.betreuungRows[2];
		expect(r3.employeeName).toBe('Sam Mustertrainer');
		expect(r3.role).toBe('beschaeftigungstrainer');
		expect(r3.qualification).toBe('Beschäftigungstrainer');
		expect(r3.analogTariff).toBe('AWO Berlin EG9/ES1');
		expect(r3.monthCount).toBe(6);
		expect(r3.weeklyHours).toBe(30);
		expect(r3.workingHoursProject).toBe(660); // 44 * 30 / 12 * 6 = 660
		expect(r3.monthlyGross).toBe(2715.08);

		// Row 4: Sam Mustertrainer Jul-Dec (Stufenaufstieg to ES2 + Tariferhöhung)
		const r4 = jc.betreuungRows[3];
		expect(r4.employeeName).toBe('Sam Mustertrainer');
		expect(r4.analogTariff).toBe('AWO Berlin EG9/ES2');
		expect(r4.monthCount).toBe(6);
		expect(r4.monthlyGross).toBe(2961.16);
		expect(r4.note).toContain('Stufenaufstieg');

		// Vwk-Pauschale for 2 staff: 2.47%
		expect(jc.sachkosten.vwkPercentage).toBe(0.0247);
		expect(jc.sachkosten.vwkAmount).toBe(Math.round(jc.totalBetreuung * 0.0247 * 100) / 100);

		// Qualifizierungsbudget for 1 Jobcoach: 666.66 €
		expect(jc.coachCount).toBe(1);
		expect(jc.trainerCount).toBe(1);
		expect(jc.sachkosten.qualifizierungsBudgetTotal).toBe(666.66);

		// Büromaterial: 10 standard items scaled to 12 months
		expect(jc.sachkosten.bueroItems).toHaveLength(10);
		expect(jc.sachkosten.bueroTotal).toBeGreaterThan(0);

		// Test Finanzierungsplan Excel Generation from scratch without external files
		const generatedBuf = generateFinanzierungsplanWorkbook(result);
		expect(generatedBuf).toBeDefined();
		expect(generatedBuf.length).toBeGreaterThan(1000);

		// Parse the generated workbook to verify structure
		const genWb = XLSX.read(generatedBuf, { type: 'buffer' });
		expect(genWb.SheetNames).toContain('2027');
		const sheet = genWb.Sheets['2027'];
		expect(sheet['B12']?.v).toBe('Alex Mustercoach');
		expect(sheet['B31']?.v).toBe('Sam Mustertrainer');
		expect(sheet['J44']?.v).toBe(jc.totalBetreuung);
		expect(sheet['C58']?.v).toBe(jc.totalFunding);
	});
});
