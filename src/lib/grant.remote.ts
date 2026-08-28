import { form, query, command } from '$app/server';
import * as v from 'valibot';
import fs from 'node:fs';
import path from 'node:path';
import { parseExcelBuffer } from '#lib/server/excel';
import { getGrantScheme, GRANT_SCHEMES } from '#lib/grants/index';
import type {
	GrantTransformationResult,
	GrantTransformationOptions,
	MonthlyRecord,
	ParticipantInfo,
	AgaRatePeriod
} from '#lib/types/grant';

// Remote Query: Get all available grant schemes
export const getAvailableSchemes = query(async () => {
	return GRANT_SCHEMES.map(s => ({
		id: s.id,
		name: s.name,
		description: s.description,
		legalBasis: s.legalBasis,
		defaultTariff: s.defaultTariff
	}));
});

// Remote Command: Recalculate grant output with modified parameters or custom AGA timeline
export const recalculateGrant = command(
	v.object({
		schemeId: v.optional(v.string(), 'sgb16i-berlin'),
		records: v.array(v.any()),
		participant: v.any(),
		options: v.object({
			includeOffsetRows: v.boolean(),
			restrictToYear: v.optional(v.number()),
			customAgaTimeline: v.optional(
				v.array(
					v.object({
						id: v.string(),
						startDate: v.string(),
						endDate: v.string(),
						rate: v.number(),
						label: v.string()
					})
				)
			)
		})
	}),
	async (payload): Promise<GrantTransformationResult> => {
		const scheme = getGrantScheme(payload.schemeId);
		const records = payload.records as MonthlyRecord[];
		const participant = payload.participant as ParticipantInfo;
		const options = payload.options as GrantTransformationOptions;

		return scheme.transform(records, participant, options);
	}
);

// Remote Command: Load bundled sample Excel calculation (dynamically locates any sample workbook in sample_data/)
export const loadSampleCalculation = command(
	v.object({
		includeOffsetRows: v.optional(v.boolean(), true),
		restrictToYear: v.optional(v.number())
	}),
	async ({ includeOffsetRows, restrictToYear }): Promise<GrantTransformationResult> => {
		const sampleDir = path.resolve('sample_data');
		let sampleFilePath = '';

		if (fs.existsSync(sampleDir)) {
			const files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
			if (files.length > 0) {
				sampleFilePath = path.join(sampleDir, files[0]);
			}
		}

		if (!sampleFilePath || !fs.existsSync(sampleFilePath)) {
			const rootFiles = fs.readdirSync(path.resolve('.')).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
			if (rootFiles.length > 0) {
				sampleFilePath = path.resolve(rootFiles[0]);
			}
		}

		if (!sampleFilePath || !fs.existsSync(sampleFilePath)) {
			throw new Error('Keine Beispiel-Excel-Datei gefunden.');
		}

		const buffer = fs.readFileSync(sampleFilePath);
		const { participant, records } = parseExcelBuffer(buffer);
		const scheme = getGrantScheme('sgb16i-berlin');

		return scheme.transform(records, participant, {
			includeOffsetRows: includeOffsetRows ?? true,
			restrictToYear
		});
	}
);

// Remote Command: Direct Base64 / ArrayBuffer spreadsheet processor (works seamlessly with Drag&Drop / File Readers)
export const processExcelFile = command(
	v.object({
		fileBase64: v.string(),
		fileName: v.string(),
		schemeId: v.optional(v.string(), 'sgb16i-berlin'),
		includeOffsetRows: v.optional(v.boolean(), true),
		restrictToYear: v.optional(v.number())
	}),
	async ({ fileBase64, fileName, schemeId, includeOffsetRows, restrictToYear }): Promise<GrantTransformationResult> => {
		try {
			const buffer = Buffer.from(fileBase64, 'base64');
			const { participant, records } = parseExcelBuffer(buffer);
			const scheme = getGrantScheme(schemeId);

			return scheme.transform(records, participant, {
				includeOffsetRows: includeOffsetRows ?? true,
				restrictToYear
			});
		} catch (err: any) {
			throw new Error(`Fehler beim Parsen der Excel-Datei "${fileName}": ${err?.message || err}`);
		}
	}
);

// Remote Form: Standard Form Action
export const uploadExcel = form(
	v.object({
		excelFile: v.optional(v.any()),
		schemeId: v.optional(v.string(), 'sgb16i-berlin'),
		includeOffsetRows: v.optional(v.string(), 'true'),
		restrictToYear: v.optional(v.string())
	}),
	async ({ excelFile, schemeId, includeOffsetRows, restrictToYear }): Promise<GrantTransformationResult> => {
		if (!excelFile || !(excelFile instanceof File)) {
			throw new Error('Bitte wählen Sie eine gültige Excel-Datei (.xlsx) aus.');
		}

		const arrayBuffer = await excelFile.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const { participant, records } = parseExcelBuffer(buffer);

		const scheme = getGrantScheme(schemeId);
		const options: GrantTransformationOptions = {
			includeOffsetRows: includeOffsetRows === 'true' || includeOffsetRows === 'on',
			restrictToYear: restrictToYear ? parseInt(restrictToYear, 10) : undefined
		};

		return scheme.transform(records, participant, options);
	}
);
