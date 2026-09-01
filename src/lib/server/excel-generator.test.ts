import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
	generateBerechnungsblattExcel,
	calculateMilestones,
	COLOR_STUFENAUFSTIEG,
	COLOR_TARIFERHOEHUNG,
	COLOR_EXIT
} from './excel-generator';
import { parseExcelBuffer } from './excel';
import { transformSgb16i } from '#lib/grants/sgb16i';

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

		// Check AGA rate parsed on records
		expect(parsed.records[0].agaRealRate).toBeCloseTo(0.23815, 4);

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
});
