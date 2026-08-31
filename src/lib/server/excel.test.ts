import { describe, it, expect } from 'vitest';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { parseExcelBuffer, parseNumber } from './excel';

describe('Excel Parser', () => {
	it('parses numbers formatted in German and standard styles correctly without truncating thousands', () => {
		expect(parseNumber(2781.91)).toBe(2781.91);
		expect(parseNumber('2781.91')).toBe(2781.91);
		expect(parseNumber('2.781,91')).toBe(2781.91);
		expect(parseNumber('2.781,91 €')).toBe(2781.91);
		expect(parseNumber('2.844,86 €')).toBe(2844.86);
		expect(parseNumber('2139,93')).toBe(2139.93);
		expect(parseNumber('15,9 %')).toBe(15.9);
		expect(parseNumber('1.234.567,89 €')).toBe(1234567.89);
	});

	it.skipIf(!fs.existsSync('Berechnungsblatt Fenske_3.xlsx'))('parses Berechnungsblatt Fenske_3.xlsx including July 2024', () => {
		const buf = fs.readFileSync('Berechnungsblatt Fenske_3.xlsx');
		const parsed = parseExcelBuffer(buf);

		console.log('Participant:', parsed.participant);
		console.log('Total records:', parsed.records.length);
		console.log('Years:', parsed.years);

		const firstRec = parsed.records[0];
		console.log('First Record:', firstRec);

		// July 2024 should be present
		expect(firstRec).toBeDefined();
		expect(firstRec.year).toBe(2024);
		expect(firstRec.month).toBe(7);
		expect(firstRec.startDate).toBe('16.07.2024');
		expect(firstRec.endDate).toBe('31.07.2024');
		expect(firstRec.monthUnits).toBe(0.5);

		// Total duration checks: 16.07.2024 to 15.07.2028 = 48 months total
		const totalUnits = parsed.records.reduce((sum, r) => sum + r.monthUnits, 0);
		console.log('Total Month Units:', totalUnits);
		expect(totalUnits).toBe(48);

		// Verify all 4 JSZ are captured
		const jszRecords = parsed.records.filter(r => r.isJszMonth);
		console.log('JSZ Records count:', jszRecords.length);
		jszRecords.forEach(r => {
			console.log(`JSZ in ${r.date} (${r.year}): amount=${r.jszAmount}, aga=${r.jszAgaAmount}`);
		});
		expect(jszRecords.length).toBe(4);
	});

	it.skipIf(!fs.existsSync('sample_data/Berechnungsblatt Fr. Manuela Beier.xlsx'))('parses sample_data/Berechnungsblatt Fr. Manuela Beier.xlsx and calculates custom start date 16.12.2024 correctly', async () => {
		const { transformSgb16i } = await import('#lib/grants/sgb16i');
		const buf = fs.readFileSync('sample_data/Berechnungsblatt Fr. Manuela Beier.xlsx');
		const parsed = parseExcelBuffer(buf);

		expect(parsed.participant.name).toBe('Frau Manuela Beier');
		expect(parsed.participant.tariffGroup).toBe('EG2');
		expect(parsed.participant.tariffStep).toBe('ES1');
		expect(parsed.participant.runtimeStart).toBe('01.07.2023');
		expect(parsed.participant.runtimeEnd).toBe('15.11.2027');

		// Transform with custom start date 16.12.2024
		const result = transformSgb16i(parsed.records, parsed.participant, {
			includeOffsetRows: true,
			runtimeStartScope: 'custom',
			customStartDate: '16.12.2024',
			runtimeScope: 'exit_date'
		});

		// 16.12.2024 to 15.11.2027 = 35.0 months
		expect(result.runtimeMonths).toBe(35);
		expect(result.years).toEqual([2024, 2025, 2026, 2027]);

		// Tab 0 Jobcenter row 1 starts on 16.12.2024 with 2.5 months
		expect(result.tabs[0].rows[0].calculationPeriodText).toBe('16.12.2024-28.02.2025');
		expect(result.tabs[0].rows[0].monthCount).toBe(2.5);

		// Tab 1 Landesmittel row 1 starts on 16.12.2024 with 2.5 months
		expect(result.tabs[1].rows[0].calculationPeriodText).toBe('16.12.2024-28.02.2025');
		expect(result.tabs[1].rows[0].monthCount).toBe(2.5);

		// Tab 2 Sachkosten: 35.0 months * 221 € = 7,735.00 €
		expect(result.tabs[2].rows[0].calculationPeriodText).toBe('16.12.2024 - 15.11.2027');
		expect(result.tabs[2].rows[0].monthCount).toBe(35);
		expect(result.tabs[2].grandTotal).toBe(7735);

		// Overall controls MATCH
		expect(result.controls.overallStatus).toBe('MATCH');
		expect(result.controls.totalDelta).toBe(0);
	});

	it.skipIf(!fs.existsSync('sample_data/Berechnungsblatt Kersten.xlsx'))('parses sample_data/Berechnungsblatt Kersten.xlsx and detects Erfahrungsstufenwechsel on 01.06.2026', async () => {
		const { transformSgb16i } = await import('#lib/grants/sgb16i');
		const buf = fs.readFileSync('sample_data/Berechnungsblatt Kersten.xlsx');
		const parsed = parseExcelBuffer(buf);

		expect(parsed.participant.name).toBe('Herr Dennis Kersten');
		expect(parsed.participant.tariffGroup).toBe('EG2');
		expect(parsed.participant.tariffStep).toBe('ES1');
		expect(parsed.participant.runtimeStart).toBe('16.06.2025');
		expect(parsed.participant.runtimeEnd).toBe('15.06.2027');

		const result = transformSgb16i(parsed.records, parsed.participant, {
			includeOffsetRows: true
		});

		console.log('--- Jobcenter Rows ---');
		result.tabs[0].rows.forEach(row => {
			console.log(`JC Row ${row.rowNumber}: ${row.calculationPeriodText} | ${row.tariffText} | ${row.monthlyAmount} * ${row.percentage}% * ${row.monthCount} = ${row.totalSum} | Expl: "${row.explanationText}" | Comp: "${row.compoundOneLineText}"`);
		});

		console.log('--- Landesmittel Rows ---');
		result.tabs[1].rows.forEach(row => {
			console.log(`Land Row ${row.rowNumber} (${row.category}): ${row.calculationPeriodText} | ${row.tariffText} | ${row.monthlyAmount} * ${row.percentage}% * ${row.monthCount} = ${row.totalSum} | Expl: "${row.explanationText}" | Comp: "${row.compoundOneLineText}"`);
		});

		// Check Jobcenter rows
		// Row 1: 16.06.2025-31.08.2025 (2.5 months in EG2/ES1)
		expect(result.tabs[0].rows[0].calculationPeriodText).toBe('16.06.2025-31.08.2025');
		expect(result.tabs[0].rows[0].tariffText).toBe('AWO Berlin EG2/ES1');
		expect(result.tabs[0].rows[0].monthCount).toBe(2.5);

		// Row 2: 01.09.2025-31.05.2026 (9.0 months in EG2/ES1, Tariferhöhung zum 01.09.2025)
		expect(result.tabs[0].rows[1].calculationPeriodText).toBe('01.09.2025-31.05.2026');
		expect(result.tabs[0].rows[1].tariffText).toBe('AWO Berlin EG2/ES1');
		expect(result.tabs[0].rows[1].explanationText).toBe('Tariferhöhung zum 01.09.2025');

		// Row 3: 01.06.2026-31.08.2026 (3.0 months in EG2/ES2, Stufenaufstieg ES1->ES2 zum 01.06.2026)
		expect(result.tabs[0].rows[2].calculationPeriodText).toBe('01.06.2026-31.08.2026');
		expect(result.tabs[0].rows[2].tariffText).toBe('AWO Berlin EG2/ES2');
		expect(result.tabs[0].rows[2].monthCount).toBe(3);
		expect(result.tabs[0].rows[2].explanationText).toBe('Stufenaufstieg ES1->ES2 zum 01.06.2026');

		// Row 4: 01.09.2026-15.06.2027 (9.5 months in EG2/ES2, Tariferhöhung zum 01.09.2026)
		expect(result.tabs[0].rows[3].calculationPeriodText).toBe('01.09.2026-15.06.2027');
		expect(result.tabs[0].rows[3].tariffText).toBe('AWO Berlin EG2/ES2');
		expect(result.tabs[0].rows[3].explanationText).toBe('Tariferhöhung zum 01.09.2026 (% Erhöhung ist kleiner als Sockelbetrag)');

		// Tab 2 Landesmittel SV shortfall rows
		expect(result.tabs[1].rows[0].calculationPeriodText).toBe('16.06.2025-31.08.2025');
		expect(result.tabs[1].rows[1].calculationPeriodText).toBe('01.09.2025-31.05.2026');
		expect(result.tabs[1].rows[1].explanationText).toBe('Tariferhöhung zum 01.09.2025');
		expect(result.tabs[1].rows[2].calculationPeriodText).toBe('01.06.2026-31.08.2026');
		expect(result.tabs[1].rows[2].explanationText).toBe('ES Wechsel ES1->ES2 zum 01.06.2026');
		expect(result.tabs[1].rows[3].calculationPeriodText).toBe('01.09.2026-15.06.2027');
		expect(result.tabs[1].rows[3].explanationText).toBe('Tariferhöhung zum 01.09.2026');

		// Controls MATCH
		expect(result.controls.overallStatus).toBe('MATCH');
		expect(result.controls.totalDelta).toBe(0);
	});
});


