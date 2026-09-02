import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
	generateBerechnungsblattExcel,
	calculateMilestones,
	COLOR_STUFENAUFSTIEG,
	COLOR_TARIFERHOEHUNG,
	COLOR_EXIT,
	COLOR_UMGRUPPIERUNG
} from './excel-generator';
import { parseExcelBuffer } from './excel';
import { transformSgb16i } from '#lib/grants/sgb16i';
import type { BerechnungsblattGeneratorOptions } from '#lib/types/grant';

describe('Berechnungsblatt Generator', () => {
	it('calculates milestones for 5 years: Stufenaufstiege, Tariferhöhungen, planned exit', () => {
		const milestones = calculateMilestones({
			employeeName: 'Max Mustermann',
			startDate: '2026-10-01',
			durationMonths: 60,
			tariffGroup: 'EG2',
			tariffStep: 'ES1'
		});

		console.log('Generated Milestones:', milestones);

		// Must have Stufenaufstieg to ES2 after 12 months (in month 13 -> 10/2027)
		const step2 = milestones.find(m => m.type === 'stufenaufstieg' && m.newStep === 'ES2');
		expect(step2).toBeDefined();
		expect(step2?.year).toBe(2027);
		expect(step2?.month).toBe(10);
		expect(step2?.color).toBe(COLOR_STUFENAUFSTIEG);

		// Must have Stufenaufstieg to ES3 after further 24 months (in month 37 -> 10/2029)
		const step3 = milestones.find(m => m.type === 'stufenaufstieg' && m.newStep === 'ES3');
		expect(step3).toBeDefined();
		expect(step3?.year).toBe(2029);
		expect(step3?.month).toBe(10);
		expect(step3?.color).toBe(COLOR_STUFENAUFSTIEG);

		// Must have Tariferhöhung for July 2027 (07/2027) and July 2028 (07/2028)
		const tarif2027 = milestones.find(m => m.type === 'tariferhoehung' && m.year === 2027 && m.month === 7);
		expect(tarif2027).toBeDefined();
		expect(tarif2027?.color).toBe(COLOR_TARIFERHOEHUNG);

		const tarif2028 = milestones.find(m => m.type === 'tariferhoehung' && m.year === 2028 && m.month === 7);
		expect(tarif2028).toBeDefined();

		// Must have planned exit at month 60 (09/2031)
		const exit = milestones.find(m => m.type === 'exit');
		expect(exit).toBeDefined();
		expect(exit?.year).toBe(2031);
		expect(exit?.month).toBe(9);
		expect(exit?.color).toBe(COLOR_EXIT);
	});

	it('generates a valid .xlsx buffer that parses and validates with 100% MATCH in transformSgb16i', async () => {
		const buf = await generateBerechnungsblattExcel({
			employeeName: 'Frau Sabine Testerin',
			startDate: '2026-10-01',
			durationMonths: 60,
			tariffGroup: 'EG2',
			tariffStep: 'ES1',
			healthInsuranceName: 'Barmer',
			jobcenterId: 'JC-12345/26',
			zgsId: 'ZGS-2026-789',
			weeklyHours: 30,
			sachkostenMonthly: 155
		});

		expect(buf).toBeInstanceOf(Buffer);
		expect(buf.length).toBeGreaterThan(10000);

		// 1. Verify with ExcelJS directly: sheets, fills, formulas
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buf as any);

		expect(wb.worksheets.map(ws => ws.name)).toContain('Gehalt');
		expect(wb.worksheets.map(ws => ws.name)).toContain('AGA');

		const wsGehalt = wb.getWorksheet('Gehalt')!;
		expect(wsGehalt.getCell('A2').value).toBe('Frau Sabine Testerin');
		expect(wsGehalt.getCell('B2').value).toBe('EG2');
		expect(wsGehalt.getCell('C2').value).toBe('ES1');
		expect(wsGehalt.getCell('F1').value).toBe('JC-12345/26');
		expect(wsGehalt.getCell('J1').value).toBe('ZGS-2026-789');
		expect(wsGehalt.getCell('W2').value).toBe('Barmer');

		// Check repurposed headers in Row 3
		expect(wsGehalt.getCell('P3').value).toBe('Krankenkasse');
		expect(wsGehalt.getCell('Q3').value).toBe('KV+ZB (AG)');
		expect(wsGehalt.getCell('R3').value).toBe('RV+AV+PV (AG)');
		expect(wsGehalt.getCell('S3').value).toBe('Umlagen U1-U3');
		expect(wsGehalt.getCell('T3').value).toBe('AGA-Gesamtsatz');
		expect(wsGehalt.getCell('U3').value).toBe('AGAreal');
		expect(wsGehalt.getCell('V3').value).toBe('Gehalt AN + AGAreal');
		expect(wsGehalt.getCell('W3').value).toBe('BG-Kosten');
		expect(wsGehalt.getCell('X3').value).toBe('Gesamtkosten inkl. BG');
		expect(wsGehalt.getCell('Y3').value).toBe('Anteil JC');
		expect(wsGehalt.getCell('Z3').value).toBe('Anteil ZGS');
		expect(wsGehalt.getCell('AA3').value).toBe('Anteil Degression');
		expect(wsGehalt.getCell('AB3').value).toBe('SK-Land');

		// Check AGA sheet rows
		const wsAga = wb.getWorksheet('AGA')!;
		expect(wsAga.getCell('A5').value).toBe('DAK');

		// 2. Parse using existing parseExcelBuffer
		const parsed = parseExcelBuffer(buf);

		expect(parsed.participant.name).toBe('Frau Sabine Testerin');
		expect(parsed.participant.tariffGroup).toBe('EG2');
		expect(parsed.participant.tariffStep).toBe('ES1');
		expect(parsed.participant.jobcenterId).toBe('JC-12345/26');
		expect(parsed.participant.zgsId).toBe('ZGS-2026-789');
		expect(parsed.participant.healthInsuranceName).toBe('Barmer');
		expect(parsed.participant.weeklyHours).toBe(30);

		// Must have exactly 60 active monthly records
		expect(parsed.records.length).toBe(60);
		const totalUnits = parsed.records.reduce((sum, r) => sum + r.monthUnits, 0);
		expect(totalUnits).toBe(60);

		// Check first and last record dates
		expect(parsed.records[0].year).toBe(2026);
		expect(parsed.records[0].month).toBe(10);
		expect(parsed.records[59].year).toBe(2031);
		expect(parsed.records[59].month).toBe(9);
		
		// Check AGA and BG rate parsed on records
		expect(parsed.records[0].agaRealRate).toBeCloseTo(0.23815, 4);
		expect(parsed.records[0].bgRate).toBeCloseTo(0.018, 3);
		expect(parsed.records[0].bgAmount).toBeGreaterThan(30);
		expect(parsed.records[0].totalEmployerCostWithBg).toBeCloseTo(
			parsed.records[0].totalEmployerCost + parsed.records[0].bgAmount!,
			2
		);

		// Check JSZ records: 5 years of runtime -> 5 JSZ entries
		const jszRecords = parsed.records.filter(r => r.isJszMonth);
		expect(jszRecords.length).toBe(5);

		// 3. Transform with SGB 16i
		const result = transformSgb16i(parsed.records, parsed.participant, {
			includeOffsetRows: true
		});

		expect(result.controls.overallStatus).toBe('MATCH');
		expect(result.controls.totalDelta).toBe(0);
		expect(result.runtimeMonths).toBe(60);
		expect(result.tabs.length).toBe(3); // Jobcenter, Landesmittel, Sachkosten
	});

	it('handles mid-month start (e.g. 16.10.2026), generating 2 lines in each degression transition month (Month 24, 36, 48)', async () => {
		const options: BerechnungsblattGeneratorOptions = {
			employeeName: 'Herr Michael Splitmann',
			startDate: '2026-10-16',
			durationMonths: 60,
			tariffGroup: 'EG2',
			tariffStep: 'ES1',
			healthInsuranceName: 'Barmer',
			weeklyHours: 30,
			fullTimeHours: 39,
			sachkostenMonthly: 155,
			childrenCount: 0,
			jszPercentage: 85
		};

		const buf = await generateBerechnungsblattExcel(options);
		const parsed = parseExcelBuffer(buf);

		expect(parsed.participant.name).toBe('Herr Michael Splitmann');
		expect(parsed.participant.runtimeStart).toBe('16.10.2026');
		expect(parsed.participant.runtimeEnd).toBe('15.10.2031');

		// 60 full-time-equivalent months, but split lines make parsed records > 60
		const totalUnits = parsed.records.reduce((sum, r) => sum + r.monthUnits, 0);
		expect(totalUnits).toBeCloseTo(60, 2);

		// Initial month 10/2026 has 1 record with 0.5 units at 100%
		const oct2026 = parsed.records.filter(r => r.year === 2026 && r.month === 10);
		expect(oct2026.length).toBe(1);
		expect(oct2026[0].monthUnits).toBe(0.5);
		expect(oct2026[0].jcDegressionPct).toBe(100);

		// Degression transition 1: Month 24 (October 2028) must have 2 records!
		// Line 1: 0.5 units at 100%
		// Line 2: 0.5 units at 90%
		const oct2028 = parsed.records.filter(r => r.year === 2028 && r.month === 10);
		expect(oct2028.length).toBe(2);
		expect(oct2028[0].monthUnits).toBe(0.5);
		expect(oct2028[0].jcDegressionPct).toBe(100);
		expect(oct2028[1].monthUnits).toBe(0.5);
		expect(oct2028[1].jcDegressionPct).toBe(90);

		// Degression transition 2: Month 36 (October 2029) must have 2 records!
		// Line 1: 0.5 units at 90%
		// Line 2: 0.5 units at 80%
		const oct2029 = parsed.records.filter(r => r.year === 2029 && r.month === 10);
		expect(oct2029.length).toBe(2);
		expect(oct2029[0].monthUnits).toBe(0.5);
		expect(oct2029[0].jcDegressionPct).toBe(90);
		expect(oct2029[1].monthUnits).toBe(0.5);
		expect(oct2029[1].jcDegressionPct).toBe(80);

		// Degression transition 3: Month 48 (October 2030) must have 2 records!
		// Line 1: 0.5 units at 80%
		// Line 2: 0.5 units at 70%
		const oct2030 = parsed.records.filter(r => r.year === 2030 && r.month === 10);
		expect(oct2030.length).toBe(2);
		expect(oct2030[0].monthUnits).toBe(0.5);
		expect(oct2030[0].jcDegressionPct).toBe(80);
		expect(oct2030[1].monthUnits).toBe(0.5);
		expect(oct2030[1].jcDegressionPct).toBe(70);

		// Final month October 2031 has 1 record with 0.5 units at 70%
		const oct2031 = parsed.records.filter(r => r.year === 2031 && r.month === 10);
		expect(oct2031.length).toBe(1);
		expect(oct2031[0].monthUnits).toBe(0.5);
		expect(oct2031[0].jcDegressionPct).toBe(70);

		// SGB 16i transformation must achieve 100% MATCH
		const result = transformSgb16i(parsed.records, parsed.participant, {
			includeOffsetRows: true
		});

		expect(result.controls.overallStatus).toBe('MATCH');
		expect(result.controls.totalDelta).toBe(0);
		expect(result.runtimeMonths).toBe(60);
	});

	it('handles arbitrary reclassifications (EG/ES change) at arbitrary dates with milestone and color highlight', async () => {
		const options: BerechnungsblattGeneratorOptions = {
			employeeName: 'Frau Tanja Umgruppiert',
			startDate: '2026-10-01',
			durationMonths: 60,
			tariffGroup: 'EG2',
			tariffStep: 'ES1',
			healthInsuranceName: 'Barmer',
			reclassifications: [
				{
					id: 'rec-1',
					effectiveDate: '2028-10-01',
					tariffGroup: 'EG3',
					tariffStep: 'ES2',
					note: 'Höhergruppierung zur Fachkraft'
				}
			]
		};

		// Check milestone detection
		const milestones = calculateMilestones(options);
		const umgMilestone = milestones.find(m => m.type === 'umgruppierung');
		expect(umgMilestone).toBeDefined();
		expect(umgMilestone?.year).toBe(2028);
		expect(umgMilestone?.month).toBe(10);
		expect(umgMilestone?.color).toBe(COLOR_UMGRUPPIERUNG);
		expect(umgMilestone?.newGroup).toBe('EG3');

		// Generate workbook
		const buf = await generateBerechnungsblattExcel(options);
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buf as any);
		const wsGehalt = wb.getWorksheet('Gehalt')!;

		// Month 25 (October 2028) row should be highlighted purple
		// Find the row for October 2028
		let oct2028Row = 0;
		for (let r = 4; r <= 80; r++) {
			const val = String(wsGehalt.getCell(`A${r}`).value || '');
			if (val.includes('10/31/28') || val.includes('10/15/28') || val.includes('10.2028')) {
				oct2028Row = r;
				break;
			}
		}
		expect(oct2028Row).toBeGreaterThan(0);
		const cellA = wsGehalt.getCell(`A${oct2028Row}`);
		const fill = cellA.fill as any;
		expect(fill).toBeDefined();
		expect(fill.fgColor?.argb).toContain(COLOR_UMGRUPPIERUNG);

		// Footnotes should contain the reclassification
		let hasReclassFootnote = false;
		for (let r = 70; r <= 130; r++) {
			const fn = wsGehalt.getCell(`A${r}`).value;
			if (fn && String(fn).includes('Höhergruppierung zur Fachkraft')) {
				hasReclassFootnote = true;
				break;
			}
		}
		expect(hasReclassFootnote).toBe(true);

		// Parse back and verify salary reflects EG3
		const parsed = parseExcelBuffer(buf);
		const recBefore = parsed.records.find(r => r.year === 2028 && r.month === 9)!;
		const recAfter = parsed.records.find(r => r.year === 2028 && r.month === 10)!;

		// EG3 is higher than EG2
		expect(recAfter.fteSalary).toBeGreaterThan(recBefore.fteSalary);

		// SGB 16i transformation remains 100% MATCH
		const result = transformSgb16i(parsed.records, parsed.participant, {
			includeOffsetRows: true
		});
		expect(result.controls.overallStatus).toBe('MATCH');
		expect(result.controls.totalDelta).toBe(0);
	});

	it('computes Berufsgenossenschaft (BG) costs across time in separate column W and total in column X', async () => {
		const options: BerechnungsblattGeneratorOptions = {
			employeeName: 'Herr Bernd BG-Tester',
			startDate: '2026-10-01',
			durationMonths: 60,
			tariffGroup: 'EG2',
			tariffStep: 'ES1',
			healthInsuranceName: 'Barmer',
			bgRate: 0.018,
			customBgTimeline: [
				{
					id: 'bg-1',
					startDate: '2026-10-01',
					endDate: '2028-09-30',
					rate: 0.018,
					label: 'BGW Standard 1,80%'
				},
				{
					id: 'bg-2',
					startDate: '2028-10-01',
					endDate: '2031-09-30',
					rate: 0.022,
					label: 'BGW Erhöht 2,20%'
				}
			]
		};

		const buf = await generateBerechnungsblattExcel(options);
		const parsed = parseExcelBuffer(buf);

		expect(parsed.records.length).toBe(60);

		// Month 1: October 2026 (1.80%)
		const month1 = parsed.records[0];
		expect(month1.bgRate).toBeCloseTo(0.018, 3);
		expect(month1.bgAmount).toBeCloseTo(month1.partTimeSalary * 0.018, 2);
		expect(month1.totalEmployerCostWithBg).toBeCloseTo(month1.totalEmployerCost + month1.bgAmount!, 2);

		// Month 25: October 2028 (2.20%)
		const month25 = parsed.records[24];
		expect(month25.bgRate).toBeCloseTo(0.022, 3);
		expect(month25.bgAmount).toBeCloseTo(month25.partTimeSalary * 0.022, 2);
		expect(month25.totalEmployerCostWithBg).toBeCloseTo(month25.totalEmployerCost + month25.bgAmount!, 2);

		// SGB 16i transformation remains 100% MATCH
		const result = transformSgb16i(parsed.records, parsed.participant, {
			includeOffsetRows: true
		});
		expect(result.controls.overallStatus).toBe('MATCH');
		expect(result.controls.totalDelta).toBe(0);
	});
});
