import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { calculateTvlComparison, calculatePeriodMonths, calculateTariffStepAtDate } from './tvl-comparison';
import { getTvlTariffEntry, DEFAULT_INSURANCE_FUNDS } from './tvl-tariff-data';
import { getAwoTariffSalary } from './awo-tariff-data';
import { generateTvlComparisonWorkbook } from './tvl-template-exporter';
import type { MonthlyRecord, ParticipantInfo, InsuranceFundDetails } from '#lib/types/grant';

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

describe('TV-L Comparison Calculation Engine', () => {
	it('calculates experience step at date accurately based on the sequential duration rule (ES s requires s years)', () => {
		// Scenario A: Starting at ES1 on 01.01.2020
		const startA = { day: 1, month: 1, year: 2020 };
		expect(calculateTariffStepAtDate({ day: 1, month: 1, year: 2020 }, startA, 1)).toBe(1);
		expect(calculateTariffStepAtDate({ day: 31, month: 12, year: 2020 }, startA, 1)).toBe(1);
		// After 1 yr in ES1 -> ES2 on 01.01.2021
		expect(calculateTariffStepAtDate({ day: 1, month: 1, year: 2021 }, startA, 1)).toBe(2);
		expect(calculateTariffStepAtDate({ day: 31, month: 12, year: 2022 }, startA, 1)).toBe(2);
		// After 2 yrs in ES2 -> ES3 on 01.01.2023
		expect(calculateTariffStepAtDate({ day: 1, month: 1, year: 2023 }, startA, 1)).toBe(3);
		expect(calculateTariffStepAtDate({ day: 31, month: 12, year: 2025 }, startA, 1)).toBe(3);
		// After 3 yrs in ES3 -> ES4 on 01.01.2026
		expect(calculateTariffStepAtDate({ day: 1, month: 1, year: 2026 }, startA, 1)).toBe(4);
		expect(calculateTariffStepAtDate({ day: 31, month: 12, year: 2029 }, startA, 1)).toBe(4);
		// After 4 yrs in ES4 -> ES5 on 01.01.2030
		expect(calculateTariffStepAtDate({ day: 1, month: 1, year: 2030 }, startA, 1)).toBe(5);
		expect(calculateTariffStepAtDate({ day: 31, month: 12, year: 2034 }, startA, 1)).toBe(5);
		// After 5 yrs in ES5 -> ES6 on 01.01.2035
		expect(calculateTariffStepAtDate({ day: 1, month: 1, year: 2035 }, startA, 1)).toBe(6);

		// Scenario B: Starting at ES2 on 16.11.2022 (e.g. recognized prior experience)
		const startB = { day: 16, month: 11, year: 2022 };
		expect(calculateTariffStepAtDate({ day: 15, month: 11, year: 2024 }, startB, 2)).toBe(2); // 2 years in ES2
		expect(calculateTariffStepAtDate({ day: 16, month: 11, year: 2024 }, startB, 2)).toBe(3); // Advances to ES3 on 16.11.2024
		expect(calculateTariffStepAtDate({ day: 15, month: 11, year: 2027 }, startB, 2)).toBe(3); // 3 years in ES3
		expect(calculateTariffStepAtDate({ day: 16, month: 11, year: 2027 }, startB, 2)).toBe(4); // Advances to ES4 on 16.11.2027

		// Scenario C: Starting at ES3 on 01.08.2023
		const startC = { day: 1, month: 8, year: 2023 };
		expect(calculateTariffStepAtDate({ day: 31, month: 7, year: 2026 }, startC, 3)).toBe(3); // 3 years in ES3
		expect(calculateTariffStepAtDate({ day: 1, month: 8, year: 2026 }, startC, 3)).toBe(4); // Advances to ES4 on 01.08.2026
	});
	it('calculates period months accurately according to TV-L rules', () => {
		// Left period: 01.01.2026 to 15.01.2026
		const left = calculatePeriodMonths('01.01.2026', '15.01.2026', 4);
		expect(left.totalMonths).toBeCloseTo(15 / 31, 4);
		expect(left.monthsPreSwitch).toBeCloseTo(15 / 31, 4);
		expect(left.monthsPostSwitch).toBe(0);

		// Right period: 16.01.2026 to 31.12.2026
		const right = calculatePeriodMonths('16.01.2026', '31.12.2026', 4);
		expect(right.totalMonths).toBeCloseTo(16 / 31 + 11, 4);
		expect(right.monthsPreSwitch).toBeCloseTo(16 / 31 + 2, 4);
		expect(right.monthsPostSwitch).toBe(9);
	});

	it('retrieves tariff entries for E2/2 and E2/3 correctly', () => {
		const e2_2 = getTvlTariffEntry(2026, 'E2/2');
		expect(e2_2).toBeDefined();
		expect(e2_2?.valJanMar).toBe(2853.24);
		expect(e2_2?.valAbApr).toBe(2953.24);
		expect(e2_2?.jszPct).toBe(0.8743);

		const e2_3 = getTvlTariffEntry(2026, 'E2/3');
		expect(e2_3).toBeDefined();
		expect(e2_3?.valJanMar).toBe(2917.80);
		expect(e2_3?.valAbApr).toBe(3017.80);
		expect(e2_3?.jszPct).toBe(0.8743);
	});

	it('reproduces Robert Hartung 2026 TV-L comparison sheet exactly to the cent', () => {
		const participant: ParticipantInfo = {
			name: 'Herr Robert Hartung',
			runtimeStart: '16.01.2023',
			runtimeEnd: '15.01.2028',
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'EG 2',
			tariffStep: 'ES 1',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK (15,9%)',
			defaultAgaRate: 0.2314
		};

		const insuranceFunds: InsuranceFundDetails[] = [
			{
				name: 'DAK',
				kvRate: 0.073,
				zusatzbeitragTotal: 0.032,
				zusatzbeitragAg: 0.016,
				rvRate: 0.093,
				avRate: 0.013,
				pvRate: 0.018,
				u1Rate: 0.013,
				u2Rate: 0.0039,
				u3Rate: 0.0015,
				agaRate: 0.2314
			},
			...DEFAULT_INSURANCE_FUNDS
		];

		const records: MonthlyRecord[] = [
			// Jan 2026 Part 1 (01.01 - 15.01) -> E2/2
			{
				date: '2026-01-15',
				year: 2026,
				month: 1,
				monthUnits: 15 / 31,
				startDate: '01.01.2026',
				endDate: '15.01.2026',
				fteSalary: 2781.91,
				partTimeSalary: 2139.93,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2139.93,
				jcDegressionPct: 80,
				jcGrantAmount: 1711.94,
				agaRealRate: 0.2314,
				agaRealAmount: 239.81,
				totalEmployerCost: 1275.06,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			},
			// Jan 2026 Part 2 (16.01 - 31.01) -> E2/3
			{
				date: '2026-01-31',
				year: 2026,
				month: 1,
				monthUnits: 16 / 31,
				startDate: '16.01.2026',
				endDate: '31.01.2026',
				fteSalary: 2844.85,
				partTimeSalary: 2188.35,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2188.35,
				jcDegressionPct: 80,
				jcGrantAmount: 1750.68,
				agaRealRate: 0.2314,
				agaRealAmount: 261.27,
				totalEmployerCost: 1390.41,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			},
			// Feb 2026 - Mar 2026 -> 2188.35
			...[2, 3].map(m => ({
				date: `2026-0${m}-28`,
				year: 2026,
				month: m,
				monthUnits: 1.0,
				startDate: `01.0${m}.2026`,
				endDate: `28.0${m}.2026`,
				fteSalary: 2844.85,
				partTimeSalary: 2188.35,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2188.35,
				jcDegressionPct: 80,
				jcGrantAmount: 1750.68,
				agaRealRate: 0.2314,
				agaRealAmount: 506.38,
				totalEmployerCost: 2694.73,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			})),
			// Apr 2026 - Dec 2026 -> 2263.35 + Nov JSZ 1923.85
			...[4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
				const lastDay = new Date(2026, m, 0).getDate();
				return {
					date: `2026-${m < 10 ? '0' + m : m}-${lastDay}`,
					year: 2026,
					month: m,
					monthUnits: 1.0,
					startDate: `01.${m < 10 ? '0' + m : m}.2026`,
					endDate: `${lastDay}.${m < 10 ? '0' + m : m}.2026`,
					fteSalary: 2942.35,
					partTimeSalary: 2263.35,
					weeklyHours: 30,
					fullTimeHours: 39,
					jcFlatRateAmount: 0,
					jcTotalGross: 2263.35,
					jcDegressionPct: 80,
					jcGrantAmount: 1810.68,
					agaRealRate: 0.2314,
					agaRealAmount: 523.74,
					totalEmployerCost: 2787.09,
					landSvShortfall: 0,
					landDegressionAmount: 0,
					jszAmount: m === 11 ? 1923.85 : 0,
					jszAgaAmount: m === 11 ? 445.18 : 0,
					sachkostenAmount: 0
				};
			})
		];

		const result = calculateTvlComparison(records, participant, 2026, undefined, insuranceFunds);

		// Left period checks
		expect(result.periodLeft.tariffCode).toBe('E2/2');
		expect(result.periodLeft.startDate).toBe('01.01.2026');
		expect(result.periodLeft.endDate).toBe('15.01.2026');
		expect(result.periodLeft.tvlUmJanMar).toBe(2172.52);
		expect(result.periodLeft.istJanMar).toBe(2139.93);
		expect(result.periodLeft.personalkostenPeriodUm).toBe(1294.48);
		expect(result.periodLeft.personalkostenPeriodIst).toBe(1275.06);
		expect(result.periodLeft.deltaIstTvl).toBeCloseTo(-19.42, 2);

		// Right period checks
		expect(result.periodRight).toBeDefined();
		if (result.periodRight) {
			expect(result.periodRight.tariffCode).toBe('E2/3');
			expect(result.periodRight.startDate).toBe('16.01.2026');
			expect(result.periodRight.endDate).toBe('31.12.2026');
			expect(result.periodRight.tvlUmJanMar).toBe(2221.68);
			expect(result.periodRight.tvlUmAbApr).toBe(2297.82);
			expect(result.periodRight.istJanMar).toBe(2188.35);
			expect(result.periodRight.istAbApr).toBe(2263.35);
			expect(result.periodRight.jszUm).toBe(2008.98);
			expect(result.periodRight.jszIst).toBe(1923.85);
			expect(result.periodRight.personalkostenPeriodUm).toBe(34789.22);
			expect(result.periodRight.personalkostenPeriodIst).toBe(34200.56);
		}

		// Grand totals
		expect(result.totalPersonalkostenTvl).toBe(36083.70);
		expect(result.totalPersonalkostenIst).toBe(35475.62);
		expect(result.totalDifference).toBe(-608.08);
		expect(result.isBesserstellungsverbotCompliant).toBe(true);

		// Export test
		const exportedBytes = generateTvlComparisonWorkbook(result);
		expect(exportedBytes).toBeInstanceOf(Uint8Array);
		expect(exportedBytes.length).toBeGreaterThan(100);

		const exportedWb = XLSX.read(exportedBytes, { type: 'buffer' });
		const expSheet = exportedWb.Sheets['Vergleichsberechnung'];
		expect(expSheet).toBeDefined();
		expect(expSheet['E5']?.v).toBe(participant.name);
		expect(expSheet['E9']?.v).toBe('E2/2');
		expect(expSheet['P2']?.v).toBe('E2/3');
		expect(expSheet['K17']?.v).toBe(2139.93);
		expect(expSheet['V10']?.v).toBe(2188.35);
		expect(expSheet['V21']?.v).toBe(1923.85);
	});

	it('reproduces Marina Schuhmacher 2026 TV-L comparison sheet exactly with no Stufenaufstieg in 2026', () => {
		const participant: ParticipantInfo = {
			name: 'Schuhmacher / Barbara',
			runtimeStart: '16.11.2022',
			runtimeEnd: '15.11.2027',
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'E2',
			tariffStep: 'ES 1', // Starts 16.11.2022 at ES1 -> 16.11.2023 ES2 -> 16.11.2025 ES3 -> stays in ES3 until 15.11.2028
			sachkostenMonthly: 221,
			childrenCount: 2,
			healthInsuranceName: 'AOK Nordost',
			defaultAgaRate: 0.2387
		};

		const insuranceFunds: InsuranceFundDetails[] = [
			{
				name: 'AOK BLN-BRB',
				kvRate: 0.073,
				zusatzbeitragTotal: 0.027,
				zusatzbeitragAg: 0.0135,
				rvRate: 0.093,
				avRate: 0.013,
				pvRate: 0.018,
				u1Rate: 0.013,
				u2Rate: 0.0044,
				u3Rate: 0.0015,
				agaRate: 0.2294
			},
			...DEFAULT_INSURANCE_FUNDS
		];

		// 12 monthly records for 2026 (Jan-Aug: 2188.35 / Sep-Dec: 2263.35 / Nov split due to Degression 80->70% with same FTE salary 2942.36)
		const records2026: MonthlyRecord[] = [
			// Jan - Aug 2026 (8 months in E2/3, 2188.35)
			...[1, 2, 3, 4, 5, 6, 7, 8].map(m => {
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
					jcFlatRateAmount: 415.79,
					jcTotalGross: 2604.14,
					jcDegressionPct: 80,
					jcGrantAmount: 2083.31,
					agaRealRate: 0.2387,
					agaRealAmount: 522.36,
					totalEmployerCost: 2710.71,
					landSvShortfall: 106.57,
					landDegressionAmount: 520.83,
					jszAmount: 0,
					jszAgaAmount: 0,
					sachkostenAmount: 221.00
				};
			}),
			// Sep - Oct 2026 (2 months at 2263.35, Tariferhöhung zum 01.09)
			...[9, 10].map(m => {
				const lastDay = new Date(2026, m, 0).getDate();
				return {
					date: `2026-${String(m).padStart(2, '0')}-${lastDay}`,
					year: 2026,
					month: m,
					monthUnits: 1.0,
					startDate: `01.${String(m).padStart(2, '0')}.2026`,
					endDate: `${lastDay}.${String(m).padStart(2, '0')}.2026`,
					fteSalary: 2942.36,
					partTimeSalary: 2263.35,
					weeklyHours: 30,
					fullTimeHours: 39,
					jcFlatRateAmount: 430.04,
					jcTotalGross: 2693.39,
					jcDegressionPct: 80,
					jcGrantAmount: 2154.71,
					agaRealRate: 0.2387,
					agaRealAmount: 540.26,
					totalEmployerCost: 2803.62,
					landSvShortfall: 110.23,
					landDegressionAmount: 538.68,
					jszAmount: 0,
					jszAgaAmount: 0,
					sachkostenAmount: 221.00
				};
			}),
			// Nov 2026 Part 1 (01.11 - 15.11, Degression 80%, FTE 2942.36)
			{
				date: '2026-11-15',
				year: 2026,
				month: 11,
				monthUnits: 0.5,
				startDate: '01.11.2026',
				endDate: '15.11.2026',
				fteSalary: 2942.36,
				partTimeSalary: 1131.68,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 215.02,
				jcTotalGross: 1346.70,
				jcDegressionPct: 80,
				jcGrantAmount: 1077.36,
				agaRealRate: 0.2387,
				agaRealAmount: 270.13,
				totalEmployerCost: 1401.81,
				landSvShortfall: 55.11,
				landDegressionAmount: 269.34,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 110.50
			},
			// Nov 2026 Part 2 (16.11 - 30.11, Degression 70%, same FTE 2942.36)
			{
				date: '2026-11-30',
				year: 2026,
				month: 11,
				monthUnits: 0.5,
				startDate: '16.11.2026',
				endDate: '30.11.2026',
				fteSalary: 2942.36,
				partTimeSalary: 1131.68,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 215.02,
				jcTotalGross: 1346.70,
				jcDegressionPct: 70,
				jcGrantAmount: 942.69,
				agaRealRate: 0.2387,
				agaRealAmount: 270.13,
				totalEmployerCost: 1401.81,
				landSvShortfall: 55.11,
				landDegressionAmount: 404.01,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 110.50
			},
			// Dec 2026 (Degression 70% + JSZ 1923.85)
			{
				date: '2026-12-31',
				year: 2026,
				month: 12,
				monthUnits: 1.0,
				startDate: '01.12.2026',
				endDate: '31.12.2026',
				fteSalary: 2942.36,
				partTimeSalary: 2263.35,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 430.04,
				jcTotalGross: 2693.39,
				jcDegressionPct: 70,
				jcGrantAmount: 1885.37,
				agaRealRate: 0.2387,
				agaRealAmount: 540.26,
				totalEmployerCost: 2803.62,
				landSvShortfall: 110.23,
				landDegressionAmount: 808.02,
				jszAmount: 1923.85,
				jszAgaAmount: 459.22,
				sachkostenAmount: 221.00
			}
		];

		const customRates = {
			selectedInsuranceName: 'AOK BLN-BRB',
			kkZusatzRate: 0.01345,
			u1Rate: 0.0130,
			u2Rate: 0.0044,
			u3Rate: 0.0015
		};

		const result = calculateTvlComparison(records2026, participant, 2026, customRates, insuranceFunds);

		// Critical assertion: No step upgrade in 2026 for Marina Schuhmacher
		expect(result.inputs.hasStepUpgrade).toBe(false);
		expect(result.periodRight).toBeUndefined();

		// Left period covers the whole year in E2/3
		expect(result.inputs.tariffGroupStepLeft).toBe('E2/3');
		expect(result.periodLeft.tariffCode).toBe('E2/3');
		expect(result.periodLeft.startDate).toBe('01.01.2026');
		expect(result.periodLeft.endDate).toBe('31.12.2026');
		expect(result.periodLeft.totalMonths).toBe(12);

		// Salaries
		expect(result.periodLeft.tvl394JanMar).toBe(2917.80);
		expect(result.periodLeft.tvlUmJanMar).toBe(2221.68);
		expect(result.periodLeft.tvl394AbApr).toBe(3017.80);
		expect(result.periodLeft.tvlUmAbApr).toBe(2297.82);
		expect(result.periodLeft.istJanMar).toBe(2188.35);
		expect(result.periodLeft.istAbApr).toBe(2263.35);

		// JSZ
		expect(result.periodLeft.jsz394).toBe(2638.46);
		expect(result.periodLeft.jszUm).toBe(2008.98);
		expect(result.periodLeft.jszIst).toBe(1923.85);

		// Totals match Excel exactly to the cent
		expect(result.totalPersonalkostenTvl).toBe(36051.95);
		expect(result.totalPersonalkostenIst).toBe(35444.39);
		expect(result.totalDifference).toBe(-607.56);
		expect(result.isBesserstellungsverbotCompliant).toBe(true);
	});

	it('correctly autodetects Krankenkasse from W2 cell string representations', () => {
		const baseParticipant: ParticipantInfo = {
			name: 'Test Person',
			runtimeStart: '01.01.2025',
			runtimeEnd: '31.12.2029',
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'EG 2',
			tariffStep: 'ES 2',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK (15,9%)',
			defaultAgaRate: 0.2314
		};

		const dummyRecords: MonthlyRecord[] = [
			{
				date: '2026-01-31',
				year: 2026,
				month: 1,
				monthUnits: 1.0,
				startDate: '01.01.2026',
				endDate: '31.01.2026',
				fteSalary: 2844.85,
				partTimeSalary: 2188.35,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2188.35,
				jcDegressionPct: 80,
				jcGrantAmount: 1750.68,
				agaRealRate: 0.2314,
				agaRealAmount: 506.38,
				totalEmployerCost: 2694.73,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			}
		];

		// Case 1: DAK (15,9%)
		const resDak = calculateTvlComparison(dummyRecords, { ...baseParticipant, healthInsuranceName: 'DAK (15,9%)' }, 2026);
		expect(resDak.inputs.selectedInsuranceName).toBe('DAK');

		// Case 2: TK (16,0%) -> matches Techniker
		const resTk = calculateTvlComparison(dummyRecords, { ...baseParticipant, healthInsuranceName: 'TK (16,0%)' }, 2026);
		expect(resTk.inputs.selectedInsuranceName).toBe('Techniker');

		// Case 3: AOK Nordost (16,8%) -> matches AOK BLN-BRB
		const resAok = calculateTvlComparison(dummyRecords, { ...baseParticipant, healthInsuranceName: 'AOK Nordost (16,8%)' }, 2026);
		expect(resAok.inputs.selectedInsuranceName).toBe('AOK BLN-BRB');

		// Case 4: Barmer (16,7%)
		const resBarmer = calculateTvlComparison(dummyRecords, { ...baseParticipant, healthInsuranceName: 'Barmer (16,7%)' }, 2026);
		expect(resBarmer.inputs.selectedInsuranceName).toBe('Barmer');
	});

	it('automatically determines whether a 2nd period (Erfahrungsstufenwechsel) is needed', () => {
		const participant: ParticipantInfo = {
			name: 'Herr Robert Hartung',
			runtimeStart: '16.01.2023',
			runtimeEnd: '15.01.2028',
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'EG 2',
			tariffStep: 'ES 1',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK (15,9%)',
			defaultAgaRate: 0.2314
		};

		// 2026 records with split in January (Stufenaufstieg E2/2 -> E2/3)
		const records2026: MonthlyRecord[] = [
			{
				date: '2026-01-15',
				year: 2026,
				month: 1,
				monthUnits: 15 / 31,
				startDate: '01.01.2026',
				endDate: '15.01.2026',
				fteSalary: 2781.91,
				partTimeSalary: 2139.93,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2139.93,
				jcDegressionPct: 80,
				jcGrantAmount: 1711.94,
				agaRealRate: 0.2314,
				agaRealAmount: 239.81,
				totalEmployerCost: 1275.06,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			},
			{
				date: '2026-01-31',
				year: 2026,
				month: 1,
				monthUnits: 16 / 31,
				startDate: '16.01.2026',
				endDate: '31.01.2026',
				fteSalary: 2844.85,
				partTimeSalary: 2188.35,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2188.35,
				jcDegressionPct: 80,
				jcGrantAmount: 1750.68,
				agaRealRate: 0.2314,
				agaRealAmount: 261.27,
				totalEmployerCost: 1390.41,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			}
		];

		const result2026 = calculateTvlComparison(records2026, participant, 2026);
		expect(result2026.inputs.hasStepUpgrade).toBe(true);
		expect(result2026.periodRight).toBeDefined();
		expect(result2026.inputs.tariffGroupStepLeft).toBe('E2/2');
		expect(result2026.inputs.tariffGroupStepRight).toBe('E2/3');

		// 2027 records without split (remains in E2/3 throughout 2027)
		const records2027: MonthlyRecord[] = [
			{
				date: '2027-01-31',
				year: 2027,
				month: 1,
				monthUnits: 1.0,
				startDate: '01.01.2027',
				endDate: '31.01.2027',
				fteSalary: 2942.35,
				partTimeSalary: 2263.35,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2263.35,
				jcDegressionPct: 80,
				jcGrantAmount: 1810.68,
				agaRealRate: 0.2314,
				agaRealAmount: 523.74,
				totalEmployerCost: 2787.09,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			}
		];

		const result2027 = calculateTvlComparison(records2027, participant, 2027);
		expect(result2027.inputs.hasStepUpgrade).toBe(false);
		expect(result2027.periodRight).toBeUndefined();
		expect(result2027.inputs.tariffGroupStepLeft).toBe('E2/3');
		expect(result2027.inputs.startDateLeft).toBe('01.01.2027');
		expect(result2027.inputs.endDateLeft).toBe('31.01.2027');
	});

	it('correctly looks up official AWO Landesverband Berlin e.V. tariff scale values across all 4 periods', () => {
		// Period 1: ab 2026/01
		const p1_e2_2 = getAwoTariffSalary('E2', 2, 2026, 1, 30, 39);
		expect(p1_e2_2?.fteSalary).toBe(2781.91);
		expect(p1_e2_2?.partTimeSalary).toBe(2139.93);

		const p1_e2_3 = getAwoTariffSalary('E2', 3, 2026, 1, 30, 39);
		expect(p1_e2_3?.fteSalary).toBe(2844.86);
		expect(p1_e2_3?.partTimeSalary).toBe(2188.35);

		// Period 2: ab 2026/09
		const p2_e2_2 = getAwoTariffSalary('E2', 2, 2026, 9, 30, 39);
		expect(p2_e2_2?.fteSalary).toBe(2879.41);
		expect(p2_e2_2?.partTimeSalary).toBe(2214.93);

		const p2_e2_3 = getAwoTariffSalary('E2', 3, 2026, 9, 30, 39);
		expect(p2_e2_3?.fteSalary).toBe(2942.36);
		expect(p2_e2_3?.partTimeSalary).toBe(2263.35);

		// Period 3: ab 2027/07
		const p3_e2_3 = getAwoTariffSalary('E2', 3, 2027, 7, 30, 39);
		expect(p3_e2_3?.fteSalary).toBe(3001.21);
		expect(p3_e2_3?.partTimeSalary).toBe(2308.62);

		// Period 4: ab 2028/07
		const p4_e2_3 = getAwoTariffSalary('E2', 3, 2028, 7, 30, 39);
		expect(p4_e2_3?.fteSalary).toBe(3031.22);
		expect(p4_e2_3?.partTimeSalary).toBe(2331.71);

		// SuE groups check (e.g. S08b / S8b Stufe 3 in 2026/01)
		const sue_s8b = getAwoTariffSalary('S8b', 3, 2026, 1, 39, 39);
		expect(sue_s8b?.fteSalary).toBe(3770.43);
	});

	it('detects human error / discrepancies in an uploaded Berechnungsblatt against AWO tariff maps', () => {
		const participant: ParticipantInfo = {
			name: 'Herr Robert Hartung',
			runtimeStart: '16.01.2023',
			runtimeEnd: '15.01.2028',
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'EG 2',
			tariffStep: 'ES 1',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// Case A: Compliant records (Jan 2026 before 16.01 -> ES2)
		const compliantRecords: MonthlyRecord[] = [
			{
				date: '2026-01-15',
				year: 2026,
				month: 1,
				monthUnits: 15 / 31,
				startDate: '01.01.2026',
				endDate: '15.01.2026',
				fteSalary: 2781.91,
				partTimeSalary: 2139.93,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2139.93,
				jcDegressionPct: 80,
				jcGrantAmount: 1711.94,
				agaRealRate: 0.2314,
				agaRealAmount: 495.18,
				totalEmployerCost: 2635.11,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			}
		];
		const resCompliant = calculateTvlComparison(compliantRecords, participant, 2026);
		expect(resCompliant.tariffValidation?.isCompliant).toBe(true);
		expect(resCompliant.tariffValidation?.discrepancyCount).toBe(0);

		// Case B: Discrepant records (Human error in spreadsheet: entered 2050.00 instead of 2139.93)
		const errRecords: MonthlyRecord[] = [
			{
				...compliantRecords[0],
				partTimeSalary: 2050.00,
				fteSalary: 2665.00
			}
		];
		const resErr = calculateTvlComparison(errRecords, participant, 2026);
		expect(resErr.tariffValidation?.isCompliant).toBe(false);
		expect(resErr.tariffValidation?.discrepancyCount).toBe(1);
		expect(resErr.tariffValidation?.discrepancies[0].recordedFteSalary).toBe(2665.00);
		expect(resErr.tariffValidation?.discrepancies[0].expectedFteSalary).toBe(2781.91);
		expect(resErr.tariffValidation?.discrepancies[0].diffFteSalary).toBe(-116.91);

		// Case C: Records prior to 09/2025 (e.g. 2023 / 2024) are skipped without false positives
		const pastRecords: MonthlyRecord[] = [
			{
				...compliantRecords[0],
				year: 2024,
				month: 5,
				date: '2024-05-31',
				fteSalary: 2400.00 // Historical rate before available comparison tables
			}
		];
		const resPast = calculateTvlComparison(pastRecords, participant, 2026);
		expect(resPast.tariffValidation?.skippedPriorTo2025Count).toBe(1);
		expect(resPast.tariffValidation?.checkedCount).toBe(0);
		expect(resPast.tariffValidation?.discrepancyCount).toBe(0);
	});

	it('uses full-time/part-time monthly gross from AWO tariff data even if Berechnungsblatt has partial month amounts', () => {
		const participant: ParticipantInfo = {
			name: 'Herr Robert Hartung',
			runtimeStart: '16.01.2023',
			runtimeEnd: '15.01.2028',
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'EG 2',
			tariffStep: 'ES 1',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// Sheet has prorated amounts in column G (e.g. 1035.45 € for 15 days)
		const recordsWithProratedMonths: MonthlyRecord[] = [
			{
				date: '2026-01-15',
				year: 2026,
				month: 1,
				monthUnits: 15 / 31,
				startDate: '01.01.2026',
				endDate: '15.01.2026',
				fteSalary: 2781.91,
				partTimeSalary: 1035.45, // Prorated 15/31
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 1035.45,
				jcDegressionPct: 80,
				jcGrantAmount: 828.36,
				agaRealRate: 0.2314,
				agaRealAmount: 239.81,
				totalEmployerCost: 1275.06,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			},
			{
				date: '2026-01-31',
				year: 2026,
				month: 1,
				monthUnits: 16 / 31,
				startDate: '16.01.2026',
				endDate: '31.01.2026',
				fteSalary: 2844.85,
				partTimeSalary: 1129.46, // Prorated 16/31
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 1129.46,
				jcDegressionPct: 80,
				jcGrantAmount: 903.57,
				agaRealRate: 0.2314,
				agaRealAmount: 261.27,
				totalEmployerCost: 1390.41,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount: 0
			}
		];

		const res = calculateTvlComparison(recordsWithProratedMonths, participant, 2026);

		// Must use the full monthly baseline salaries from AWO Berlin Tariftabelle, not the prorated 1035.45 €
		expect(res.inputs.istJanMarLeft).toBe(2139.93);
		expect(res.inputs.istAbAprLeft).toBe(2214.93);
		expect(res.inputs.istJanMarRight).toBe(2188.35);
		expect(res.inputs.istAbAprRight).toBe(2263.35);
		expect(res.inputs.hasStepUpgrade).toBe(true);
		expect(res.inputs.tariffGroupStepLeft).toBe('E2/2');
		expect(res.inputs.tariffGroupStepRight).toBe('E2/3');
	});

	it('applies AWO Berlin tariff rules for Jahressonderzahlung (85% September, 01.12., proration) and adapts TV-L comments', () => {
		const participantFullYear: ParticipantInfo = {
			name: 'Erika Mustermann',
			runtimeStart: '01.01.2026',
			runtimeEnd: '31.12.2028',
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'E2',
			tariffStep: 'ES3',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// 12 months for 2026
		const fullYearRecords: MonthlyRecord[] = Array.from({ length: 12 }, (_, idx) => {
			const m = idx + 1;
			const lastDay = new Date(2026, m, 0).getDate();
			const fteSalary = m < 9 ? 2844.86 : 2942.36; // Tariferhöhung in 09/2026
			const partTimeSalary = round2(fteSalary * 30 / 39);
			return {
				date: `2026-${String(m).padStart(2, '0')}-${lastDay}`,
				year: 2026,
				month: m,
				monthUnits: 1.0,
				startDate: `01.${String(m).padStart(2, '0')}.2026`,
				endDate: `${lastDay}.${String(m).padStart(2, '0')}.2026`,
				fteSalary,
				partTimeSalary,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: partTimeSalary * 0.19,
				jcTotalGross: partTimeSalary * 1.19,
				jcDegressionPct: 80,
				jcGrantAmount: partTimeSalary * 1.19 * 0.8,
				agaRealRate: 0.2314,
				agaRealAmount: partTimeSalary * 0.2314,
				totalEmployerCost: partTimeSalary * 1.2314,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: m === 12 ? 1923.85 : 0, // 85% of September salary (2263.35 * 0.85 = 1923.85)
				jszAgaAmount: m === 12 ? 445.18 : 0,
				isJszMonth: m === 12,
				sachkostenAmount: 155
			};
		});

		// 1. Full year comparison: employed on 01.12., 12/12 months
		const resFull = calculateTvlComparison(fullYearRecords, participantFullYear, 2026);
		expect(resFull.inputs.bemerkungen).toBe(
			'Tarif AWO Berlin 10.ÄTV + Tarifeinigung vom 05.05.2026, Jahressonderzahlung 85% vom Septembergehalt (Stichtag 01.12.)'
		);
		expect(resFull.inputs.istJszLeft).toBe(1923.85);

		// 2. Partial year comparison (e.g. started 16.01 -> 11.5 months)
		const partialRecords = fullYearRecords.map((r, i) => i === 0 ? { ...r, monthUnits: 0.5, startDate: '16.01.2026' } : r);
		const participantPartial = { ...participantFullYear, runtimeStart: '16.01.2026' };
		const resPartial = calculateTvlComparison(partialRecords, participantPartial, 2026);
		expect(resPartial.inputs.bemerkungen).toBe(
			'Tarif AWO Berlin 10.ÄTV + Tarifeinigung vom 05.05.2026, Jahressonderzahlung monatsanteilig (11,5/12) 85% vom Septembergehalt, da am 01.12. angestellt'
		);

		// 3. Employee exits before 01.12 (e.g. 30.11.2026) -> No JSZ entitlement
		const exitBeforeDecRecords = fullYearRecords.filter(r => r.month <= 11);
		const participantExitBeforeDec = { ...participantFullYear, runtimeEnd: '30.11.2026' };
		const resExitBeforeDec = calculateTvlComparison(exitBeforeDecRecords, participantExitBeforeDec, 2026);
		expect(resExitBeforeDec.inputs.bemerkungen).toBe(
			'Tarif AWO Berlin 10.ÄTV + Tarifeinigung vom 05.05.2026, kein Anspruch auf Jahressonderzahlung (nicht am 01.12. angestellt)'
		);
		expect(resExitBeforeDec.inputs.istJszLeft).toBe(0);
	});

	it('detects JSZ discrepancies when Berechnungsblatt calculates JSZ without employment on 01.12. or with wrong amount', () => {
		const participant: ParticipantInfo = {
			name: 'Herr Test',
			runtimeStart: '01.01.2026',
			runtimeEnd: '30.11.2026', // Ends before 01.12!
			weeklyHours: 30,
			fullTimeHours: 39,
			tariffGroup: 'E2',
			tariffStep: 'ES3',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// Spreadsheet erroneously calculated JSZ although participant left in November
		const wrongJszRecords: MonthlyRecord[] = [
			{
				date: '2026-11-30',
				year: 2026,
				month: 11,
				monthUnits: 1.0,
				startDate: '01.11.2026',
				endDate: '30.11.2026',
				fteSalary: 2942.36,
				partTimeSalary: 2263.35,
				weeklyHours: 30,
				fullTimeHours: 39,
				jcFlatRateAmount: 0,
				jcTotalGross: 2263.35,
				jcDegressionPct: 80,
				jcGrantAmount: 1810.68,
				agaRealRate: 0.2314,
				agaRealAmount: 523.74,
				totalEmployerCost: 2787.09,
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount: 1500.00, // Error: Should be 0!
				jszAgaAmount: 347.10,
				isJszMonth: true,
				sachkostenAmount: 155
			}
		];

		const res = calculateTvlComparison(wrongJszRecords, participant, 2026);
		expect(res.tariffValidation?.isCompliant).toBe(false);
		expect(res.tariffValidation?.discrepancies.some(d => d.explanation.includes('Jahressonderzahlung'))).toBe(true);
	});
});
