import { describe, it, expect } from 'vitest';
import { generateStandardSgb16iDemoDatasets, transformSgb16iMulti } from './sgb16i';
import { generateStandardJobCoachingDemoDatasets, transformBerlinerJobCoachingMulti } from './berliner-jobcoaching';
import { validateBerechnungsblattTariff } from './awo-tariff-data';

describe('Demo data tariff compliance check', () => {
	it('ensures SGB 16i demo data is 100% compliant with AWO tariff tables and JSZ rules', () => {
		const datasets = generateStandardSgb16iDemoDatasets();
		expect(datasets).toHaveLength(2);

		for (const ds of datasets) {
			const report = validateBerechnungsblattTariff(ds.records, ds.participant);
			expect(report.isCompliant).toBe(true);
			expect(report.discrepancyCount).toBe(0);
			expect(report.discrepancies).toHaveLength(0);
			expect(report.jszAudits?.every((a) => a.isCompliant)).toBe(true);
		}

		const transResult = transformSgb16iMulti(datasets, { includeOffsetRows: true });
		expect(transResult.controls.overallStatus).toBe('MATCH');
		expect(transResult.controls.totalDelta).toBe(0);
		expect(transResult.tariffValidation?.isCompliant).toBe(true);
		expect(transResult.tariffValidation?.discrepancies).toHaveLength(0);

		for (const p of transResult.participants || []) {
			expect(p.tariffValidation?.isCompliant).toBe(true);
			expect(p.tariffValidation?.discrepancies).toHaveLength(0);
		}
	});

	it('ensures Berliner JobCoaching demo data is 100% compliant with AWO tariff tables and JSZ rules', () => {
		const datasets = generateStandardJobCoachingDemoDatasets(2027);
		expect(datasets).toHaveLength(2);

		for (const ds of datasets) {
			const report = validateBerechnungsblattTariff(ds.records, ds.participant);
			expect(report.isCompliant).toBe(true);
			expect(report.discrepancyCount).toBe(0);
			expect(report.discrepancies).toHaveLength(0);
			expect(report.jszAudits?.every((a) => a.isCompliant)).toBe(true);
		}

		const jcResult = transformBerlinerJobCoachingMulti(datasets, {
			includeOffsetRows: true,
			runtimeStartScope: 'custom',
			customStartDate: '01.01.2027',
			runtimeScope: 'custom',
			customEndDate: '31.12.2027'
		});

		expect(jcResult.controls.overallStatus).toBe('MATCH');
		expect(jcResult.tariffValidation?.isCompliant).toBe(true);
		expect(jcResult.tariffValidation?.discrepancies).toHaveLength(0);

		for (const p of jcResult.participants || []) {
			expect(p.tariffValidation?.isCompliant).toBe(true);
			expect(p.tariffValidation?.discrepancies).toHaveLength(0);
		}
	});
});
