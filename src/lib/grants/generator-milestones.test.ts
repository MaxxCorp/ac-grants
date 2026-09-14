import { describe, it, expect } from 'vitest';
import {
	computeStepBaselineDate,
	calculateNextStepAscentInfo,
	resolveTariffStateAtDate,
	calculateMilestones,
	parseDateInput,
	formatDateDMY,
	getInsuranceFundByName
} from './generator-milestones';

describe('generator-milestones - Tariff Progression Continuity', () => {
	const startDate = { year: 2026, month: 10, day: 1 };

	describe('computeStepBaselineDate', () => {
		it('returns start date unchanged when continueTariffProgression is false or undefined (default)', () => {
			const resDefault = computeStepBaselineDate(startDate);
			expect(resDefault).toEqual(startDate);

			const resFalse = computeStepBaselineDate(startDate, { continueTariffProgression: false });
			expect(resFalse).toEqual(startDate);
		});

		it('returns previousTariffStepStartDate when continueTariffProgression is true', () => {
			const res = computeStepBaselineDate(startDate, {
				continueTariffProgression: true,
				previousTariffStepStartDate: '2025-06-01'
			});
			expect(res).toEqual({ year: 2025, month: 6, day: 1 });
		});

		it('subtracts priorExperienceMonths from start date when priorExperienceMonths is provided', () => {
			// 14 months before 01.10.2026 -> 01.08.2025
			const res = computeStepBaselineDate(startDate, {
				continueTariffProgression: true,
				priorExperienceMonths: 14
			});
			expect(res).toEqual({ year: 2025, month: 8, day: 1 });
		});

		it('accepts string startDate as well', () => {
			const res = computeStepBaselineDate('2026-10-01', {
				continueTariffProgression: true,
				priorExperienceMonths: 6
			});
			expect(res).toEqual({ year: 2026, month: 4, day: 1 });
		});
	});

	describe('calculateNextStepAscentInfo', () => {
		it('calculates ascent correctly for default ES2 without prior progression (24 months needed)', () => {
			const ascent = calculateNextStepAscentInfo(2, startDate, startDate);
			expect(ascent.nextStep).toBe(3);
			expect(ascent.totalMonthsRequiredInStep).toBe(24);
			expect(ascent.priorMonthsCredited).toBe(0);
			expect(ascent.remainingMonthsAtNewEmployer).toBe(24);
			expect(ascent.nextAscentDateStr).toBe('01.10.2028');
		});

		it('calculates ascent correctly for ES2 with 16 months of prior experience (8 months remaining)', () => {
			const baseline = { year: 2025, month: 6, day: 1 };
			const ascent = calculateNextStepAscentInfo(2, startDate, baseline);
			expect(ascent.nextStep).toBe(3);
			expect(ascent.totalMonthsRequiredInStep).toBe(24);
			expect(ascent.priorMonthsCredited).toBe(16);
			expect(ascent.remainingMonthsAtNewEmployer).toBe(8);
			expect(ascent.nextAscentDateStr).toBe('01.06.2027');
		});

		it('calculates ascent correctly for ES3 with 20 months of prior experience (16 months remaining of 36)', () => {
			const baseline = { year: 2025, month: 2, day: 1 };
			const ascent = calculateNextStepAscentInfo(3, startDate, baseline);
			expect(ascent.nextStep).toBe(4);
			expect(ascent.totalMonthsRequiredInStep).toBe(36);
			expect(ascent.priorMonthsCredited).toBe(20);
			expect(ascent.remainingMonthsAtNewEmployer).toBe(16);
			expect(ascent.nextAscentDateStr).toBe('01.02.2028');
		});

		it('handles ES6 (final step, no further ascent)', () => {
			const ascent = calculateNextStepAscentInfo(6, startDate, startDate);
			expect(ascent.nextStep).toBeNull();
			expect(ascent.nextAscentDate).toBeNull();
			expect(ascent.nextAscentDateStr).toBe('-');
		});
	});

	describe('resolveTariffStateAtDate with stepBaselineDateOverride', () => {
		it('uses default start date when override is not provided', () => {
			// At month 12 (01.10.2027) for ES2 -> still ES2
			const state1 = resolveTariffStateAtDate(
				{ day: 1, month: 10, year: 2027 },
				startDate,
				'EG2',
				2
			);
			expect(state1.step).toBe(2);

			// At month 24 (01.10.2028) for ES2 -> advances to ES3
			const state2 = resolveTariffStateAtDate(
				{ day: 1, month: 10, year: 2028 },
				startDate,
				'EG2',
				2
			);
			expect(state2.step).toBe(3);
		});

		it('advances earlier when stepBaselineDateOverride is in the past', () => {
			// Baseline is 01.06.2025 (16 months before 01.10.2026)
			// At 01.05.2027 (23 months from baseline) -> still ES2
			const state1 = resolveTariffStateAtDate(
				{ day: 1, month: 5, year: 2027 },
				startDate,
				'EG2',
				2,
				[],
				{ year: 2025, month: 6, day: 1 }
			);
			expect(state1.step).toBe(2);

			// At 01.06.2027 (24 months from baseline) -> advances to ES3!
			const state2 = resolveTariffStateAtDate(
				{ day: 1, month: 6, year: 2027 },
				startDate,
				'EG2',
				2,
				[],
				{ year: 2025, month: 6, day: 1 }
			);
			expect(state2.step).toBe(3);
		});
	});

	describe('getInsuranceFundByName', () => {
		it('resolves BIG direkt gesund with accurate rates', () => {
			const fund = getInsuranceFundByName('BIG direkt gesund');
			expect(fund.name).toBe('BIG direkt gesund');
			expect(fund.zusatzbeitragTotal).toBe(0.0369);
			expect(fund.zusatzbeitragAg).toBe(0.01845);
			expect(fund.u1Rate).toBe(0.033);
			expect(fund.u2Rate).toBe(0.0029);
			expect(fund.u3Rate).toBe(0.0015);
			expect(fund.agaRate).toBe(0.25285);
		});

		it('resolves BIG direkt alias to BIG direkt gesund', () => {
			const fund = getInsuranceFundByName('BIG direkt');
			expect(fund.name).toBe('BIG direkt gesund');
			expect(fund.agaRate).toBe(0.25285);
		});

		it('resolves case-insensitively and falls back gracefully', () => {
			const fund = getInsuranceFundByName('big direkt gesund');
			expect(fund.name).toBe('BIG direkt gesund');

			const fallback = getInsuranceFundByName('Unknown Fund');
			expect(fallback.name).toBe('Barmer');
		});
	});
});
