import { describe, it, expect } from 'vitest';
import { transformSgb16i, buildCompoundOneLineText, isRecordWithinExitDate, isRecordWithinStartDate, parseDateComponents, getTariffStep, calculateMonthUnits, clipRecordDateRange } from '#lib/grants/sgb16i';
import { normalizeTariffStep } from '#lib/server/excel';
import type { MonthlyRecord, ParticipantInfo } from '#lib/types/grant';

describe('§16i SGB II / ZGS Berlin Transformation Engine', () => {
	it('should correctly parse date components and filter records within exit date and start date', () => {
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

		// Test isRecordWithinStartDate
		expect(isRecordWithinStartDate(record2029, '01.01.2030')).toBe(false);
		expect(isRecordWithinStartDate(recordFeb2030Part1, '16.02.2030')).toBe(false);
		expect(isRecordWithinStartDate(recordFeb2030Part2, '16.02.2030')).toBe(true);
		expect(isRecordWithinStartDate(recordMarch2030, '16.02.2030')).toBe(true);
		expect(isRecordWithinStartDate(record2029, '01.08.2026')).toBe(true);
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

	it('should correctly filter and adapt outputs based on runtimeScope (exit_date, foerderperiode, full_5_years)', () => {
		const participant: ParticipantInfo = {
			name: 'Erika Mustermann',
			tariffGroup: 'EG1',
			tariffStep: 'ES1',
			runtimeStart: '01.08.2026',
			runtimeEnd: '31.08.2028', // 24 months exit date in Cell F2
			weeklyHours: 30,
			fullTimeHours: 39,
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// Provide 60 monthly records (Aug 2026 to Jul 2031)
		const records: MonthlyRecord[] = [];
		let currentDate = new Date(2026, 7, 1);
		for (let i = 0; i < 60; i++) {
			const y = currentDate.getFullYear();
			const m = currentDate.getMonth() + 1;
			const lastDay = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');
			const fteSalary = 2600;
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
				agaRealRate: 0.2314,
				agaRealAmount: partTimeSalary * 0.2314,
				totalEmployerCost: partTimeSalary * 1.2314,
				landSvShortfall: partTimeSalary * (0.2314 - 0.19),
				landDegressionAmount: 0,
				jszAmount: m === 12 ? 1700 : 0,
				jszAgaAmount: m === 12 ? 1700 * 0.2314 : 0,
				isJszMonth: m === 12,
				sachkostenAmount: 155
			});

			currentDate = new Date(y, m, 1);
		}

		// 1. Test exit_date (default: 24 months, until 31.08.2028)
		const resExit = transformSgb16i(records, participant, { includeOffsetRows: false, runtimeScope: 'exit_date' });
		expect(resExit.runtimeMonths).toBe(25); // 2026-08-01 to 2028-08-31 is 25 months
		expect(resExit.years).toEqual([2026, 2027, 2028]);
		expect(resExit.tabs[0].rows[0].runtimeText).toBe('01.08.2026-31.08.2028');
		expect(resExit.tabs[2].rows[0].runtimeText).toBe('01.08.2026 - 31.08.2028');
		expect(resExit.tabs[2].rows[0].explanationText).toBe('JC Antrag bewilligt bis 31.08.2028');
		// CRITICAL: Ensure full records are preserved in rawMonthlyRecords
		expect(resExit.rawMonthlyRecords.length).toBe(60);

		// 2. Test foerderperiode (until 31.12.2029):
		// Laufzeit on all lines remains the contract runtime from cell F2 (01.08.2026-31.08.2028),
		// while the calculation generates additional rows up to 31.12.2029.
		const resFoerder = transformSgb16i(resExit.rawMonthlyRecords, participant, { includeOffsetRows: false, runtimeScope: 'foerderperiode' });
		expect(resFoerder.years).toEqual([2026, 2027, 2028, 2029]);
		expect(resFoerder.runtimeMonths).toBe(41); // Aug 2026 to Dec 2029 = 5 + 12 + 12 + 12 = 41 months
		expect(resFoerder.tabs[0].rows[0].runtimeText).toBe('01.08.2026-31.08.2028');
		expect(resFoerder.tabs[2].rows[0].runtimeText).toBe('01.08.2026 - 31.08.2028');
		expect(resFoerder.tabs[2].rows[0].explanationText).toBe('JC Antrag bewilligt bis 31.08.2028');
		expect(resFoerder.rawMonthlyRecords.length).toBe(60);

		// 3. Test full_5_years (full 60 months, until 31.07.2031):
		// Laufzeit on all lines remains the contract runtime from cell F2 (01.08.2026-31.08.2028),
		// while all 60 months are generated.
		const resFull = transformSgb16i(resFoerder.rawMonthlyRecords, participant, { includeOffsetRows: false, runtimeScope: 'full_5_years' });
		expect(resFull.runtimeMonths).toBe(60);
		expect(resFull.years).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
		expect(resFull.tabs[0].rows[0].runtimeText).toBe('01.08.2026-31.08.2028');
		expect(resFull.tabs[2].rows[0].runtimeText).toBe('01.08.2026 - 31.08.2028');
		expect(resFull.tabs[2].rows[0].explanationText).toBe('JC Antrag bewilligt bis 31.08.2028');
		expect(resFull.rawMonthlyRecords.length).toBe(60);

		// 4. Test custom arbitrary end date (e.g. 31.03.2029)
		const resCustom = transformSgb16i(resFull.rawMonthlyRecords, participant, {
			includeOffsetRows: false,
			runtimeScope: 'custom',
			customEndDate: '31.03.2029'
		});
		expect(resCustom.years).toEqual([2026, 2027, 2028, 2029]);
		expect(resCustom.runtimeMonths).toBe(32); // Aug 2026 to Mar 2029 = 5 + 12 + 12 + 3 = 32 months
		expect(resCustom.tabs[0].rows[0].runtimeText).toBe('01.08.2026-31.08.2028');
		expect(resCustom.tabs[2].rows[0].runtimeText).toBe('01.08.2026 - 31.08.2028');
		expect(resCustom.rawMonthlyRecords.length).toBe(60);

		// 5. Test switching back to exit_date from custom
		const resBack = transformSgb16i(resCustom.rawMonthlyRecords, participant, { includeOffsetRows: false, runtimeScope: 'exit_date' });
		expect(resBack.years).toEqual([2026, 2027, 2028]);
		expect(resBack.runtimeMonths).toBe(25);
		expect(resBack.rawMonthlyRecords.length).toBe(60);
	});

	it('should correctly filter and adapt outputs based on runtimeStartScope and customStartDate', () => {
		const participant: ParticipantInfo = {
			name: 'Erika Mustermann',
			tariffGroup: 'EG1',
			tariffStep: 'ES1',
			runtimeStart: '01.08.2026',
			runtimeEnd: '31.07.2031', // 60 months
			weeklyHours: 30,
			fullTimeHours: 39,
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// 60 monthly records
		const records: MonthlyRecord[] = [];
		let currentDate = new Date(2026, 7, 1);
		for (let i = 0; i < 60; i++) {
			const y = currentDate.getFullYear();
			const m = currentDate.getMonth() + 1;
			const lastDay = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');
			const fteSalary = 2600;
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
				agaRealRate: 0.2314,
				agaRealAmount: partTimeSalary * 0.2314,
				totalEmployerCost: partTimeSalary * 1.2314,
				landSvShortfall: partTimeSalary * (0.2314 - 0.19),
				landDegressionAmount: 0,
				jszAmount: m === 12 ? 1700 : 0,
				jszAgaAmount: m === 12 ? 1700 * 0.2314 : 0,
				isJszMonth: m === 12,
				sachkostenAmount: 155
			});

			currentDate = new Date(y, m, 1);
		}

		// 1. Default contract_start: starts at 01.08.2026
		const resDefault = transformSgb16i(records, participant, {
			includeOffsetRows: false,
			runtimeStartScope: 'contract_start',
			runtimeScope: 'full_5_years'
		});
		expect(resDefault.runtimeMonths).toBe(60);
		expect(resDefault.years).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);

		// 2. Custom start date: 01.08.2028 (Year 3) to 31.07.2029 (12 months slice)
		const resSlice = transformSgb16i(records, participant, {
			includeOffsetRows: false,
			runtimeStartScope: 'custom',
			customStartDate: '01.08.2028',
			runtimeScope: 'custom',
			customEndDate: '31.07.2029'
		});
		expect(resSlice.runtimeMonths).toBe(12);
		expect(resSlice.years).toEqual([2028, 2029]);
		// Tab 1 Jobcenter: First row starts at 01.08.2028
		expect(resSlice.tabs[0].rows[0].calculationPeriodText).toBe('01.08.2028-31.07.2029');
		// Tariff step is computed from original contract start (01.08.2026) -> after 24 months, it is ES2
		expect(resSlice.tabs[0].rows[0].tariffText).toBe('AWO Berlin EG1/ES2');
		// Sachkosten for 12 months = 12 * 155 = 1860 €
		expect(resSlice.tabs[2].grandTotal).toBe(1860);
		expect(resSlice.tabs[2].rows[0].calculationPeriodText).toBe('01.08.2028 - 31.07.2029');
		// Overall status remains MATCH
		expect(resSlice.controls.overallStatus).toBe('MATCH');

		// 3. Custom start date mid-year with partial records
		const resMidYear = transformSgb16i(records, participant, {
			includeOffsetRows: false,
			runtimeStartScope: 'custom',
			customStartDate: '01.01.2029',
			runtimeScope: 'foerderperiode' // until 31.12.2029
		});
		expect(resMidYear.years).toEqual([2029]);
		expect(resMidYear.runtimeMonths).toBe(12);
		expect(resMidYear.tabs[2].grandTotal).toBe(1860);
	});

	it('should accurately calculate month units for full months, half months, and partial day ranges', () => {
		expect(calculateMonthUnits(1, 31, 31)).toBe(1.0);
		expect(calculateMonthUnits(1, 30, 30)).toBe(1.0);
		expect(calculateMonthUnits(1, 28, 28)).toBe(1.0);
		expect(calculateMonthUnits(1, 29, 29)).toBe(1.0);

		// Second half of month (16th to end of month)
		expect(calculateMonthUnits(16, 31, 31)).toBe(0.5);
		expect(calculateMonthUnits(16, 30, 30)).toBe(0.5);
		expect(calculateMonthUnits(16, 28, 28)).toBe(0.5);
		expect(calculateMonthUnits(15, 28, 28)).toBe(0.5);

		// First half of month (1st to 15th)
		expect(calculateMonthUnits(1, 15, 31)).toBe(0.5);
		expect(calculateMonthUnits(1, 15, 30)).toBe(0.5);
		expect(calculateMonthUnits(1, 14, 28)).toBe(0.5);

		// Arbitrary day spans
		expect(calculateMonthUnits(10, 20, 31)).toBe(0.35); // 11 / 31 = 0.3548 -> 0.35
	});

	it('should dynamically clip and prorate when customStartDate or customEndDate starts or ends mid-month', () => {
		const participant: ParticipantInfo = {
			name: 'Frau Manuela Beier',
			tariffGroup: 'EG2',
			tariffStep: 'ES1',
			runtimeStart: '01.07.2023',
			runtimeEnd: '15.11.2027',
			weeklyHours: 30,
			fullTimeHours: 39,
			sachkostenMonthly: 221,
			childrenCount: 0,
			healthInsuranceName: 'Barmer',
			defaultAgaRate: 0.23815
		};

		// 53 monthly records from 07/2023 to 11/2027
		const records: MonthlyRecord[] = [];
		let currentDate = new Date(2023, 6, 1);
		for (let i = 0; i < 53; i++) {
			const y = currentDate.getFullYear();
			const m = currentDate.getMonth() + 1;
			const lastDay = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');
			const fteSalary = y === 2023 ? 2245.27 : (y === 2024 || (y === 2025 && m <= 2)) ? 2441.88 : (y === 2025 && m <= 8) ? 2636.88 : 2781.91;
			const isLast = i === 52;
			const monthUnits = isLast ? 0.5 : 1.0;
			const fullMonthlyPartTime = (fteSalary * 30) / 39;
			const partTimeSalary = fullMonthlyPartTime * monthUnits;
			const jcFlatRate = partTimeSalary * 0.19;
			const jcTotalGross = partTimeSalary + jcFlatRate;
			const degPct = i < 24 ? 100 : i < 36 ? 90 : i < 48 ? 80 : 70;

			records.push({
				date: `${y}-${mStr}-${String(isLast ? 15 : lastDay).padStart(2, '0')}`,
				year: y,
				month: m,
				monthUnits,
				startDate: `01.${mStr}.${y}`,
				endDate: `${String(isLast ? 15 : lastDay).padStart(2, '0')}.${mStr}.${y}`,
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
				landDegressionAmount: (jcTotalGross * (100 - degPct)) / 100,
				jszAmount: m === 12 ? fullMonthlyPartTime * 0.85 : 0,
				jszAgaAmount: m === 12 ? fullMonthlyPartTime * 0.85 * 0.23815 : 0,
				isJszMonth: m === 12,
				sachkostenAmount: 221 * monthUnits
			});

			currentDate = new Date(y, m, 1);
		}

		// 1. Custom start date: 16.12.2024 to contract exit date (15.11.2027)
		const resStart = transformSgb16i(records, participant, {
			includeOffsetRows: true,
			runtimeStartScope: 'custom',
			customStartDate: '16.12.2024',
			runtimeScope: 'exit_date'
		});

		// December 2024 is clipped to 0.5 months -> 0.5 in 2024 + 12 in 2025 + 12 in 2026 + 10.5 in 2027 = 35.0 months
		expect(resStart.runtimeMonths).toBe(35);
		expect(resStart.years).toEqual([2024, 2025, 2026, 2027]);

		// Tab 0 Jobcenter: First row starts at 16.12.2024 with 2.5 months (0.5 in Dec 2024 + 2 in 2025)
		expect(resStart.tabs[0].rows[0].calculationPeriodText.startsWith('16.12.2024')).toBe(true);
		expect(resStart.tabs[0].rows[0].monthCount).toBe(2.5);

		// Tab 2 Sachkosten: 35.0 months * 221 € = 7,735.00 €
		expect(resStart.tabs[2].grandTotal).toBe(7735);
		expect(resStart.tabs[2].rows[0].calculationPeriodText).toBe('16.12.2024 - 15.11.2027');

		// Control checks MATCH with 0 delta
		expect(resStart.controls.overallStatus).toBe('MATCH');
		expect(resStart.controls.totalDelta).toBe(0);

		// 2. Custom end date mid-month: 15.06.2027 (ending mid-month)
		const resEnd = transformSgb16i(records, participant, {
			includeOffsetRows: true,
			runtimeStartScope: 'custom',
			customStartDate: '16.12.2024',
			runtimeScope: 'custom',
			customEndDate: '15.06.2027'
		});

		// 0.5 (Dec 2024) + 12 (2025) + 12 (2026) + 5.5 (Jan-15.Jun 2027) = 30.0 months
		expect(resEnd.runtimeMonths).toBe(30);
		expect(resEnd.tabs[2].grandTotal).toBe(30 * 221); // 6630 €
		expect(resEnd.tabs[2].rows[0].calculationPeriodText).toBe('16.12.2024 - 15.06.2027');
		expect(resEnd.controls.overallStatus).toBe('MATCH');
	});

	it('should generate correct Tab 2 Landesmittel Jahressonderzahlung rows with AWO Berlin tariff comments and exact calculation period', () => {
		const participant: ParticipantInfo = {
			name: 'Test Person',
			runtimeStart: '16.01.2026',
			runtimeEnd: '31.12.2027',
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'EG 2',
			tariffStep: 'ES 2',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// 2026: 11.5 months (started 16.01.2026)
		const records: MonthlyRecord[] = [
			{
				date: '2026-01-31',
				year: 2026,
				month: 1,
				monthUnits: 0.5,
				startDate: '16.01.2026',
				endDate: '31.01.2026',
				fteSalary: 2844.86,
				partTimeSalary: 1094.18,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 1094.18,
				jcDegressionPct: 100,
				jcGrantAmount: 1094.18,
				agaRealRate: 0.2314,
				agaRealAmount: 253.19,
				totalEmployerCost: 1347.37,
				landSvShortfall: 45.30,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 77.5
			},
			...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(m => {
				const lastDay = new Date(2026, m, 0).getDate();
				return {
					date: `2026-${String(m).padStart(2, '0')}-${lastDay}`,
					year: 2026,
					month: m,
					monthUnits: 1.0,
					startDate: `01.${String(m).padStart(2, '0')}.2026`,
					endDate: `${lastDay}.${String(m).padStart(2, '0')}.2026`,
					fteSalary: 2844.86,
					partTimeSalary: 2188.35,
					weeklyHours: 30,
					fullTimeHours: 39,
					jcFlatRateAmount: 0,
					jcTotalGross: 2188.35,
					jcDegressionPct: 100,
					jcGrantAmount: 2188.35,
					agaRealRate: 0.2314,
					agaRealAmount: 506.38,
					totalEmployerCost: 2694.73,
					landSvShortfall: 90.60,
					landDegressionAmount: 0,
					jszAmount: 0,
					jszAgaAmount: 0,
					sachkostenAmount: 155
				};
			}),
			// December with JSZ
			{
				date: '2026-12-31',
				year: 2026,
				month: 12,
				monthUnits: 1.0,
				startDate: '01.12.2026',
				endDate: '31.12.2026',
				fteSalary: 2844.86,
				partTimeSalary: 2188.35,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2188.35,
				jcDegressionPct: 100,
				jcGrantAmount: 2188.35,
				agaRealRate: 0.2314,
				agaRealAmount: 506.38,
				totalEmployerCost: 2694.73,
				landSvShortfall: 90.60,
				landDegressionAmount: 0,
				jszAmount: 1782.57, // 2188.35 * 0.85 * (11.5/12)
				jszAgaAmount: 412.49,
				isJszMonth: true,
				sachkostenAmount: 155
			}
		];

		const result = transformSgb16i(records, participant, { includeOffsetRows: false });

		// Tab 1 is Landesmittel (index 1)
		const jszRow = result.tabs[1].rows.find(r => r.category === 'jsz');
		expect(jszRow).toBeDefined();
		if (jszRow) {
			expect(jszRow.calculationPeriodText).toBe('16.01.2026-31.12.2026');
			expect(jszRow.explanationText).toBe(
				'anteilig für 11,5 Monate (11,5/12), 85% vom Septembergehalt gem. AWO Berlin Tarif (10. ÄTV / TE 05.05.2026), Stichtag 01.12.'
			);
			expect(jszRow.costTypeText).toBe('Jahressonderzahlung 2026');
			expect(jszRow.compoundOneLineText).toContain('anteilig für 11,5 Monate (11,5/12)');
			expect(jszRow.compoundOneLineText).toContain('16.01.2026-31.12.2026');
		}
	});
});
