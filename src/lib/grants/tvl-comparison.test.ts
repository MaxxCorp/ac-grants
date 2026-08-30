import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { calculateTvlComparison, calculatePeriodMonths } from './tvl-comparison';
import { getTvlTariffEntry, DEFAULT_INSURANCE_FUNDS } from './tvl-tariff-data';
import { getAwoTariffSalary } from './awo-tariff-data';
import { generateTvlComparisonWorkbook } from './tvl-template-exporter';
import type { MonthlyRecord, ParticipantInfo, InsuranceFundDetails } from '#lib/types/grant';

describe('TV-L Comparison Calculation Engine', () => {
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
			tariffStep: 'ES 2',
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
			tariffStep: 'ES 2',
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
			tariffStep: 'ES 2',
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: 0.2314
		};

		// Case A: Compliant records
		const compliantRecords: MonthlyRecord[] = [
			{
				date: '2026-01-31',
				year: 2026,
				month: 1,
				monthUnits: 1.0,
				startDate: '01.01.2026',
				endDate: '31.01.2026',
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
		expect(resErr.tariffValidation?.discrepancies[0].expectedPartTimeSalary).toBe(2139.93);
		expect(resErr.tariffValidation?.discrepancies[0].recordedPartTimeSalary).toBe(2050.00);
	});
});
