import { describe, it, expect } from 'vitest';
import {
	calculateBgwRate,
	calculateVbgRate,
	calculateManualRate,
	calculateEffectiveBgRate,
	DEFAULT_ORGANIZATION_BG_SETTINGS,
	DEFAULT_EFFECTIVE_BG_RATE_DECIMAL,
	BGW_TARIFSTELLEN
} from './bg-calculator';

describe('Berufsgenossenschaft Calculator', () => {
	it('calculates official BGW rate for GTS 14 (Wohlfahrtspflege, non-profit)', () => {
		const res = calculateBgwRate({
			isNonProfit: true,
			tarifstelleCode: 'ts-14',
			ausgleichsumlageRate: 0.08,
			surchargePercentage: 0.0
		});

		// Base: (3.47 * 1.94) / 1000 = 0.0067318
		// Umlage: 0.08 / 1000 = 0.0000800
		// Sum: 0.0068118 -> 0.68118%
		expect(res.provider).toBe('bgw');
		expect(res.rateDecimal).toBeCloseTo(0.0068118, 6);
		expect(res.ratePercent).toBeCloseTo(0.68118, 4);
		expect(res.formulaBreakdown).toContain('3,47');
		expect(res.formulaBreakdown).toContain('1,94');
		expect(res.formulaBreakdown).toContain('0,08');
	});

	it('calculates official BGW rate for GTS 17 (WfbM / Qualifizierungsprojekte)', () => {
		const res = calculateBgwRate({
			isNonProfit: true,
			tarifstelleCode: 'ts-17',
			ausgleichsumlageRate: 0.08,
			surchargePercentage: 0.0
		});

		// Base: (8.40 * 1.94) / 1000 = 0.016296
		// Umlage: 0.08 / 1000 = 0.000080
		// Sum: 0.016376 -> 1.6376%
		expect(res.rateDecimal).toBeCloseTo(0.016376, 6);
		expect(res.ratePercent).toBeCloseTo(1.6376, 4);
	});

	it('applies commercial Beitragsfuß 2.08 when non-profit is false', () => {
		const res = calculateBgwRate({
			isNonProfit: false,
			tarifstelleCode: 'ts-14',
			ausgleichsumlageRate: 0.08,
			surchargePercentage: 0.0
		});

		// Base: (3.47 * 2.08) / 1000 = 0.0072176
		// Umlage: 0.08 / 1000 = 0.000080
		// Sum: 0.0072976 -> 0.72976%
		expect(res.rateDecimal).toBeCloseTo(0.0072976, 6);
		expect(res.formulaBreakdown).toContain('2,08');
	});

	it('applies Beitragsausgleichsverfahren surcharge correctly', () => {
		const withoutSurcharge = calculateBgwRate({
			isNonProfit: true,
			tarifstelleCode: 'ts-14',
			ausgleichsumlageRate: 0.08,
			surchargePercentage: 0.0
		});

		const withSurcharge = calculateBgwRate({
			isNonProfit: true,
			tarifstelleCode: 'ts-14',
			ausgleichsumlageRate: 0.08,
			surchargePercentage: 5.0 // +5% Zuschlag
		});

		// Base: 0.0067318 * 1.05 = 0.00706839
		// Total: 0.00706839 + 0.000080 = 0.00714839
		expect(withSurcharge.rateDecimal).toBeGreaterThan(withoutSurcharge.rateDecimal);
		expect(withSurcharge.rateDecimal).toBeCloseTo(0.00714839, 6);
	});

	it('allows overriding danger class and Beitragsfuß', () => {
		const res = calculateBgwRate({
			isNonProfit: true,
			tarifstelleCode: 'ts-14',
			dangerClassOverride: 2.50,
			beitragsfussOverride: 2.00,
			ausgleichsumlageRate: 0.05
		});

		// Base: (2.50 * 2.00) / 1000 = 0.005000
		// Umlage: 0.05 / 1000 = 0.000050
		// Total: 0.005050 -> 0.505%
		expect(res.rateDecimal).toBeCloseTo(0.005050, 6);
		expect(res.ratePercent).toBeCloseTo(0.505, 4);
	});

	it('calculates VBG rate correctly', () => {
		const res = calculateVbgRate({
			dangerClass: 0.33,
			beitragsfuss: 4.00
		});

		// (0.33 * 4.00) / 1000 = 0.00132 -> 0.132%
		expect(res.provider).toBe('vbg');
		expect(res.rateDecimal).toBeCloseTo(0.00132, 5);
		expect(res.ratePercent).toBeCloseTo(0.132, 3);
	});

	it('calculates manual rate correctly', () => {
		const res = calculateManualRate({ ratePercent: 0.75 });
		expect(res.provider).toBe('manual');
		expect(res.ratePercent).toBe(0.75);
		expect(res.rateDecimal).toBe(0.0075);
	});

	it('resolves default organization settings to ~0.681%', () => {
		const res = calculateEffectiveBgRate(DEFAULT_ORGANIZATION_BG_SETTINGS);
		expect(res.rateDecimal).toBeCloseTo(DEFAULT_EFFECTIVE_BG_RATE_DECIMAL, 4);
		expect(res.ratePercent).toBeCloseTo(0.681, 2);
	});

	it('contains all 15 active official BGW 6. Gefahrtarifstellen', () => {
		expect(BGW_TARIFSTELLEN.length).toBe(15); // TS 8 and 13 are officially not occupied
		const gts14 = BGW_TARIFSTELLEN.find(ts => ts.number === 14);
		expect(gts14).toBeDefined();
		expect(gts14?.dangerClass).toBe(3.47);
		expect(gts14?.dangerClassPrevious).toBe(3.66);

		const gts17 = BGW_TARIFSTELLEN.find(ts => ts.number === 17);
		expect(gts17?.dangerClass).toBe(8.40);
	});
});
