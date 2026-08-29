import { describe, it, expect } from 'vitest';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { parseExcelBuffer } from './excel';

describe('Excel Parser', () => {
	it('parses Berechnungsblatt Fenske_3.xlsx including July 2024', () => {
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
});
