import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseExcelBuffer } from '#lib/server/excel';
import { transformSgb16i, buildCompoundOneLineText } from '#lib/grants/sgb16i';
import type { MonthlyRecord, ParticipantInfo } from '#lib/types/grant';

describe('§16i SGB II / ZGS Berlin Transformation Engine', () => {
	const sampleDir = path.resolve('sample_data');
	const claussenPath = path.join(sampleDir, 'Berechnungsblatt Claussen.xlsx');
	const hasClaussen = fs.existsSync(claussenPath);
	const claussenBuffer = hasClaussen ? fs.readFileSync(claussenPath) : null;

	it('should correctly parse Berechnungsblatt Claussen with prior employment and half-month splits', () => {
		if (!claussenBuffer) return;
		const { participant, records, years } = parseExcelBuffer(claussenBuffer);

		expect(participant.name).toContain('André Claussen');
		expect(participant.tariffGroup).toBe('EG2');
		expect(participant.tariffStep).toBe('ES1');
		expect(participant.weeklyHours).toBe(30);
		expect(participant.sachkostenMonthly).toBe(155);
		expect(participant.healthInsuranceName).toBe('DAK');
		expect(participant.defaultAgaRate).toBeCloseTo(0.2314, 4);
		expect(participant.runtimeStart).toBe('01.09.2026');
		expect(participant.runtimeEnd).toBe('15.02.2030');

		// Records spanning 41.5 total month units
		const totalUnits = records.reduce((sum, r) => sum + r.monthUnits, 0);
		expect(totalUnits).toBe(41.5);
		expect(years).toEqual([2026, 2027, 2028, 2029, 2030]);

		// Verify split months in February 2027
		const feb27Part1 = records.find(r => r.year === 2027 && r.month === 2 && r.startDate === '01.02.2027');
		const feb27Part2 = records.find(r => r.year === 2027 && r.month === 2 && r.startDate === '16.02.2027');
		expect(feb27Part1).toBeDefined();
		expect(feb27Part1?.endDate).toBe('15.02.2027');
		expect(feb27Part1?.monthUnits).toBe(0.5);
		expect(feb27Part1?.jcDegressionPct).toBe(100);

		expect(feb27Part2).toBeDefined();
		expect(feb27Part2?.endDate).toBe('28.02.2027');
		expect(feb27Part2?.monthUnits).toBe(0.5);
		expect(feb27Part2?.jcDegressionPct).toBe(90);

		// Verify split months in February 2028
		const feb28Part1 = records.find(r => r.year === 2028 && r.month === 2 && r.startDate === '01.02.2028');
		const feb28Part2 = records.find(r => r.year === 2028 && r.month === 2 && r.startDate === '16.02.2028');
		expect(feb28Part1).toBeDefined();
		expect(feb28Part1?.endDate).toBe('15.02.2028');
		expect(feb28Part1?.monthUnits).toBe(0.5);
		expect(feb28Part1?.jcDegressionPct).toBe(90);

		expect(feb28Part2).toBeDefined();
		expect(feb28Part2?.endDate).toBe('29.02.2028');
		expect(feb28Part2?.monthUnits).toBe(0.5);
		expect(feb28Part2?.jcDegressionPct).toBe(80);
	});

	it('should correctly transform Claussen data into 3 form tabs with 100% mathematical consistency', () => {
		if (!claussenBuffer) return;
		const { participant, records } = parseExcelBuffer(claussenBuffer);
		const result = transformSgb16i(records, participant, {
			includeOffsetRows: true
		});

		expect(result.runtimeMonths).toBe(41.5);
		expect(result.tabs.length).toBe(3);

		// 1. Tab: Jobcenter
		const jcTab = result.tabs[0];
		expect(jcTab.id).toBe('jobcenter');
		expect(jcTab.grandTotal).toBeGreaterThan(90000);

		// First row: 01.09.2026 - 15.02.2027 (5.5 months @ 100%)
		expect(jcTab.rows[0].calculationPeriodText).toBe('01.09.2026-15.02.2027');
		expect(jcTab.rows[0].monthCount).toBe(5.5);
		expect(jcTab.rows[0].percentage).toBe(100);
		expect(jcTab.rows[0].monthlyAmount).toBe(2447.99);

		// Second row: 16.02.2027 - 30.06.2027 (4.5 months @ 90%)
		expect(jcTab.rows[1].calculationPeriodText).toBe('16.02.2027-30.06.2027');
		expect(jcTab.rows[1].monthCount).toBe(4.5);
		expect(jcTab.rows[1].percentage).toBe(90);
		expect(jcTab.rows[1].description).toContain('Degression auf 90% ab 16.02.2027');

		// 2. Tab: Landesmittel
		const landTab = result.tabs[1];
		expect(landTab.id).toBe('landesmittel');
		expect(landTab.grandTotal).toBeGreaterThan(31000);

		// 3. Tab: Sachkosten
		const skTab = result.tabs[2];
		expect(skTab.id).toBe('sachkosten');
		expect(skTab.rows[0].monthCount).toBe(41.5);
		expect(skTab.grandTotal).toBe(6432.50); // 41.5 * 155.00 €
		expect(skTab.rows[0].yearlyAmounts[2026]).toBe(620.00); // 4 * 155 €
		expect(skTab.rows[0].yearlyAmounts[2027]).toBe(1860.00); // 12 * 155 €
		expect(skTab.rows[0].yearlyAmounts[2028]).toBe(1860.00); // 12 * 155 €
		expect(skTab.rows[0].yearlyAmounts[2029]).toBe(1860.00); // 12 * 155 €
		expect(skTab.rows[0].yearlyAmounts[2030]).toBe(232.50); // 1.5 * 155 €

		// Controls check
		expect(result.controls.overallStatus).toBe('MATCH');
		expect(result.controls.totalDelta).toBe(0);
	});

	it('should support standard 60-month full runtime calculation with synthetic data', () => {
		const participant: ParticipantInfo = {
			name: 'Frau Nadine Langner',
			tariffGroup: 'EG1',
			tariffStep: 'ES1',
			runtimeStart: '01.08.2026',
			runtimeEnd: '31.07.2031',
			weeklyHours: 30,
			fullTimeHours: 39,
			sachkostenMonthly: 155,
			childrenCount: 2,
			healthInsuranceName: 'Barmer',
			defaultAgaRate: 0.23815
		};

		// Create 60 standard monthly records (Aug 2026 to Jul 2031)
		const records: MonthlyRecord[] = [];
		let currentDate = new Date(2026, 7, 1); // Aug 2026

		for (let i = 0; i < 60; i++) {
			const y = currentDate.getFullYear();
			const m = currentDate.getMonth() + 1;
			const lastDay = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');

			const fteSalary = y < 2027 ? 2576.77 : y < 2029 ? 2688.48 : 2774.73;
			const partTimeSalary = (fteSalary * 30) / 39;
			const jcFlatRate = partTimeSalary * 0.19;
			const jcTotalGross = partTimeSalary + jcFlatRate;
			const degPct = i < 24 ? 100 : i < 36 ? 90 : i < 48 ? 80 : 70;

			records.push({
				date: `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`,
				year: y,
				month: m,
				monthUnits: 1.0,
				startDate: `01.${mStr}.${y}`,
				endDate: `${String(lastDay).padStart(2, '0')}.${mStr}.${y}`,
				fteSalary,
				partTimeSalary,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: jcFlatRate,
				jcTotalGross,
				jcDegressionPct: degPct,
				jcGrantAmount: (jcTotalGross * degPct) / 100,
				agaRealRate: 0.23815,
				agaRealAmount: partTimeSalary * 0.23815,
				totalEmployerCost: partTimeSalary * 1.23815,
				landSvShortfall: partTimeSalary * (0.23815 - 0.19),
				landDegressionAmount: 0,
				jszAmount: m === 12 ? 1800 : 0,
				jszAgaAmount: m === 12 ? 1800 * 0.23815 : 0,
				isJszMonth: m === 12,
				sachkostenAmount: 155
			});

			currentDate = new Date(y, m, 1);
		}

		const result = transformSgb16i(records, participant, { includeOffsetRows: true });

		expect(result.runtimeMonths).toBe(60);
		expect(result.tabs[2].grandTotal).toBe(9300.00); // 60 * 155 €
		expect(result.controls.overallStatus).toBe('MATCH');
	});

	it('should produce 5-space separated description strings and individual text blocks for every row', () => {
		if (!claussenBuffer) return;
		const { participant, records } = parseExcelBuffer(claussenBuffer);
		const result = transformSgb16i(records, participant, {
			includeOffsetRows: true
		});

		for (const tab of result.tabs) {
			for (const row of tab.rows) {
				expect(row.participantName).toBeDefined();
				expect(row.runtimeText).toBeDefined();
				expect(row.tariffText).toBeDefined();
				expect(row.calculationPeriodText).toBeDefined();
				expect(row.costTypeText).toBeDefined();
				expect(row.description).toBeDefined();

				// If row has an explanation, verify 5 spaces separate explanation and cost type
				if (row.explanationText && row.costTypeText && row.rowNumber > 1 && !row.isOffsetRow) {
					expect(row.description).toContain('     ');
					expect(row.description).toContain(row.explanationText);
					expect(row.description).toContain(row.costTypeText);
				}
			}
		}
	});
});
