import { describe, it, expect } from 'vitest';
import { transformSgb16i, buildCompoundOneLineText, isRecordWithinExitDate, parseDateComponents, getTariffStep } from '#lib/grants/sgb16i';
import { normalizeTariffStep } from '#lib/server/excel';
import type { MonthlyRecord, ParticipantInfo } from '#lib/types/grant';

describe('§16i SGB II / ZGS Berlin Transformation Engine', () => {
	it('should correctly parse date components and filter records within exit date', () => {
		expect(parseDateComponents('15.02.2030')).toEqual({ day: 15, month: 2, year: 2030 });
		expect(parseDateComponents('2030-02-15')).toEqual({ day: 15, month: 2, year: 2030 });
		expect(parseDateComponents('15/02/2030')).toEqual({ day: 15, month: 2, year: 2030 });

		const record2029: MonthlyRecord = {
			date: '2029-12-31',
			year: 2029,
			month: 12,
			monthUnits: 1.0,
			startDate: '01.12.2029',
			endDate: '31.12.2029',
			fteSalary: 2774.73,
			partTimeSalary: 2134.41,
			weeklyHours: 30,
			fullTimeHours: 39,
			jcFlatRateAmount: 405.54,
			jcTotalGross: 2539.95,
			jcDegressionPct: 70,
			jcGrantAmount: 1777.97,
			agaRealRate: 0.2314,
			agaRealAmount: 493.90,
			totalEmployerCost: 2628.31,
			landSvShortfall: 88.36,
			landDegressionAmount: 0,
			jszAmount: 0,
			jszAgaAmount: 0,
			sachkostenAmount: 155
		};

		const recordFeb2030Part1: MonthlyRecord = {
			...record2029,
			date: '2030-02-15',
			year: 2030,
			month: 2,
			monthUnits: 0.5,
			startDate: '01.02.2030',
			endDate: '15.02.2030'
		};

		const recordFeb2030Part2: MonthlyRecord = {
			...record2029,
			date: '2030-02-28',
			year: 2030,
			month: 2,
			monthUnits: 0.5,
			startDate: '16.02.2030',
			endDate: '28.02.2030'
		};

		const recordMarch2030: MonthlyRecord = {
			...record2029,
			date: '2030-03-31',
			year: 2030,
			month: 3,
			monthUnits: 1.0,
			startDate: '01.03.2030',
			endDate: '31.03.2030'
		};

		expect(isRecordWithinExitDate(record2029, '15.02.2030')).toBe(true);
		expect(isRecordWithinExitDate(recordFeb2030Part1, '15.02.2030')).toBe(true);
		expect(isRecordWithinExitDate(recordFeb2030Part2, '15.02.2030')).toBe(false);
		expect(isRecordWithinExitDate(recordMarch2030, '15.02.2030')).toBe(false);
	});

	it('should support standard 60-month full runtime calculation with synthetic data', () => {
		const participant: ParticipantInfo = {
			name: 'Teilnehmer/in Muster',
			tariffGroup: 'EG1',
			tariffStep: 'ES1',
			runtimeStart: '01.08.2026',
			runtimeEnd: '31.07.2031',
			weeklyHours: 30,
			fullTimeHours: 39,
			sachkostenMonthly: 155,
			childrenCount: 2,
			healthInsuranceName: 'GKV',
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

	it('should produce 5-space separated description strings and correct component layout', () => {
		const singleLine = buildCompoundOneLineText(
			'Muster Teilnehmer',
			'01.09.2026-15.02.2030',
			'AWO Berlin EG2/ES1',
			'01.09.2026-15.02.2027',
			'Degression auf 90% ab 16.02.2027',
			'AG-Brutto, inkl. 19% Pauschale'
		);

		expect(singleLine).toContain('     ');
		const parts = singleLine.split('     ');
		expect(parts.length).toBe(6);
		expect(parts[0]).toBe('Muster Teilnehmer');
		expect(parts[1]).toBe('01.09.2026-15.02.2030');
		expect(parts[2]).toBe('AWO Berlin EG2/ES1');
		expect(parts[3]).toBe('01.09.2026-15.02.2027');
		expect(parts[4]).toBe('Degression auf 90% ab 16.02.2027');
		expect(parts[5]).toBe('AG-Brutto, inkl. 19% Pauschale');
	});

	it('should correctly calculate AWO experience level raises from starting level ES1 (1yr -> ES2, 2yr -> ES3, 3yr -> ES4)', () => {
		const start = '01.08.2026';
		const makeRec = (year: number, month: number): MonthlyRecord => ({
			date: `${year}-${String(month).padStart(2, '0')}-01`,
			year,
			month,
			monthUnits: 1.0,
			startDate: `01.${String(month).padStart(2, '0')}.${year}`,
			endDate: `30.${String(month).padStart(2, '0')}.${year}`,
			fteSalary: 2500,
			partTimeSalary: 2000,
			weeklyHours: 30,
			fullTimeHours: 39,
			jcFlatRateAmount: 380,
			jcTotalGross: 2380,
			jcDegressionPct: 100,
			jcGrantAmount: 2380,
			agaRealRate: 0.23,
			agaRealAmount: 460,
			totalEmployerCost: 2460,
			landSvShortfall: 80,
			landDegressionAmount: 0,
			jszAmount: 0,
			jszAgaAmount: 0,
			sachkostenAmount: 155
		});

		// 0 to 11 months: ES1
		expect(getTariffStep(makeRec(2026, 8), start, 'ES1')).toBe('ES1');
		expect(getTariffStep(makeRec(2027, 7), start, 'ES1')).toBe('ES1');

		// After 1 year (12 months) -> ES2 (stay for 2 years = 24 months, months 12 to 35)
		expect(getTariffStep(makeRec(2027, 8), start, 'ES1')).toBe('ES2');
		expect(getTariffStep(makeRec(2029, 7), start, 'ES1')).toBe('ES2');

		// After 1+2 = 3 years (36 months) -> ES3 (stay for 3 years = 36 months, months 36 to 71)
		expect(getTariffStep(makeRec(2029, 8), start, 'ES1')).toBe('ES3');
		expect(getTariffStep(makeRec(2032, 7), start, 'ES1')).toBe('ES3');

		// After 1+2+3 = 6 years (72 months) -> ES4 (stay for 4 years = 48 months, months 72 to 119)
		expect(getTariffStep(makeRec(2032, 8), start, 'ES1')).toBe('ES4');
		expect(getTariffStep(makeRec(2036, 7), start, 'ES1')).toBe('ES4');

		// After 1+2+3+4 = 10 years (120 months) -> ES5 (stay for 5 years = 60 months, months 120 to 179)
		expect(getTariffStep(makeRec(2036, 8), start, 'ES1')).toBe('ES5');
		expect(getTariffStep(makeRec(2041, 7), start, 'ES1')).toBe('ES5');

		// After 1+2+3+4+5 = 15 years (180 months) -> ES6
		expect(getTariffStep(makeRec(2041, 8), start, 'ES1')).toBe('ES6');
	});

	it('should correctly calculate AWO experience level raises when starting at higher levels (e.g. ES2, ES3)', () => {
		const start = '01.08.2026';
		const makeRec = (year: number, month: number): MonthlyRecord => ({
			date: `${year}-${String(month).padStart(2, '0')}-01`,
			year,
			month,
			monthUnits: 1.0,
			startDate: `01.${String(month).padStart(2, '0')}.${year}`,
			endDate: `30.${String(month).padStart(2, '0')}.${year}`,
			fteSalary: 2500,
			partTimeSalary: 2000,
			weeklyHours: 30,
			fullTimeHours: 39,
			jcFlatRateAmount: 380,
			jcTotalGross: 2380,
			jcDegressionPct: 100,
			jcGrantAmount: 2380,
			agaRealRate: 0.23,
			agaRealAmount: 460,
			totalEmployerCost: 2460,
			landSvShortfall: 80,
			landDegressionAmount: 0,
			jszAmount: 0,
			jszAgaAmount: 0,
			sachkostenAmount: 155
		});

		// Starting at ES2: stay 2 years (24 months) in ES2, then advance to ES3
		expect(getTariffStep(makeRec(2026, 8), start, 'ES2')).toBe('ES2');
		expect(getTariffStep(makeRec(2028, 7), start, 'ES2')).toBe('ES2');
		expect(getTariffStep(makeRec(2028, 8), start, 'ES2')).toBe('ES3'); // After 2 years in ES2 -> ES3
		expect(getTariffStep(makeRec(2031, 7), start, 'ES2')).toBe('ES3'); // 3 years in ES3
		expect(getTariffStep(makeRec(2031, 8), start, 'ES2')).toBe('ES4'); // After 2+3 = 5 years -> ES4

		// Starting at ES3: stay 3 years (36 months) in ES3, then advance to ES4
		expect(getTariffStep(makeRec(2026, 8), start, 'ES3')).toBe('ES3');
		expect(getTariffStep(makeRec(2029, 7), start, 'ES3')).toBe('ES3');
		expect(getTariffStep(makeRec(2029, 8), start, 'ES3')).toBe('ES4'); // After 3 years in ES3 -> ES4
	});

	it('should incorporate starting tariff group (B2) and starting experience level (C2) into full transform output', () => {
		const participant: ParticipantInfo = {
			name: 'Max Mustermann',
			tariffGroup: 'EG2',
			tariffStep: 'ES2',
			runtimeStart: '01.08.2026',
			runtimeEnd: '31.07.2031',
			weeklyHours: 30,
			fullTimeHours: 39,
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// 36 months of records (Aug 2026 to Jul 2029)
		const records: MonthlyRecord[] = [];
		let currentDate = new Date(2026, 7, 1);
		for (let i = 0; i < 36; i++) {
			const y = currentDate.getFullYear();
			const m = currentDate.getMonth() + 1;
			const lastDay = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');

			const fteSalary = 2800;
			const partTimeSalary = (fteSalary * 30) / 39;
			const jcFlatRate = partTimeSalary * 0.19;
			const jcTotalGross = partTimeSalary + jcFlatRate;
			const degPct = i < 24 ? 100 : 90;

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
				agaRealRate: 0.2314,
				agaRealAmount: partTimeSalary * 0.2314,
				totalEmployerCost: partTimeSalary * 1.2314,
				landSvShortfall: partTimeSalary * (0.2314 - 0.19),
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 155
			});

			currentDate = new Date(y, m, 1);
		}

		const result = transformSgb16i(records, participant, { includeOffsetRows: false });

		// Tab 1 Jobcenter: First group is Aug 2026 - Jul 2028 (ES2, 100%) -> tariffText is 'AWO Berlin EG2/ES2'
		const jcRow1 = result.tabs[0].rows[0];
		expect(jcRow1.tariffText).toBe('AWO Berlin EG2/ES2');
		expect(jcRow1.monthCount).toBe(24);

		// Second group is Aug 2028 onwards: Stufenaufstieg to ES3 AND degression to 90%
		const jcRow2 = result.tabs[0].rows[1];
		expect(jcRow2.tariffText).toBe('AWO Berlin EG2/ES3');
		expect(jcRow2.explanationText).toContain('Stufenaufstieg ES2->ES3');
		expect(jcRow2.explanationText).toContain('Degression auf 90%');
	});

	it('should correctly normalize various representations of experience levels from cell C2', () => {
		expect(normalizeTariffStep('1')).toBe('ES1');
		expect(normalizeTariffStep('ES1')).toBe('ES1');
		expect(normalizeTariffStep('ES 1')).toBe('ES1');
		expect(normalizeTariffStep('Stufe 1')).toBe('ES1');
		expect(normalizeTariffStep('2')).toBe('ES2');
		expect(normalizeTariffStep('ES2')).toBe('ES2');
		expect(normalizeTariffStep('ES 2')).toBe('ES2');
		expect(normalizeTariffStep('3')).toBe('ES3');
		expect(normalizeTariffStep('ES3')).toBe('ES3');
		expect(normalizeTariffStep('4')).toBe('ES4');
		expect(normalizeTariffStep('5')).toBe('ES5');
		expect(normalizeTariffStep('6')).toBe('ES6');
		expect(normalizeTariffStep('')).toBe('ES1');
		expect(normalizeTariffStep(null)).toBe('ES1');
		expect(normalizeTariffStep(undefined)).toBe('ES1');
	});
});
