import { form, query, command } from '$app/server';
import * as v from 'valibot';
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
			runtimeScope: v.optional(v.string()),
			customEndDate: v.optional(v.string()),
			runtimeStartScope: v.optional(v.string()),
			customStartDate: v.optional(v.string()),
			restrictToExitDate: v.optional(v.boolean()),
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

// Remote Command: Direct Base64 / ArrayBuffer spreadsheet processor (works seamlessly with Drag&Drop / File Readers)
export const processExcelFile = command(
	v.object({
		fileBase64: v.string(),
		fileName: v.string(),
		schemeId: v.optional(v.string(), 'sgb16i-berlin'),
		includeOffsetRows: v.optional(v.boolean(), true),
		runtimeScope: v.optional(v.string(), 'exit_date'),
		customEndDate: v.optional(v.string()),
		runtimeStartScope: v.optional(v.string(), 'contract_start'),
		customStartDate: v.optional(v.string()),
		restrictToExitDate: v.optional(v.boolean(), true),
		restrictToYear: v.optional(v.number())
	}),
	async ({ fileBase64, fileName, schemeId, includeOffsetRows, runtimeScope, customEndDate, runtimeStartScope, customStartDate, restrictToExitDate, restrictToYear }): Promise<GrantTransformationResult> => {
		try {
			const buffer = Buffer.from(fileBase64, 'base64');
			const { participant, records } = parseExcelBuffer(buffer);
			const scheme = getGrantScheme(schemeId);

			return scheme.transform(records, participant, {
				includeOffsetRows: includeOffsetRows ?? true,
				runtimeScope: (runtimeScope as any) || (restrictToExitDate === false ? 'full_5_years' : 'exit_date'),
				customEndDate,
				runtimeStartScope: (runtimeStartScope as any) || 'contract_start',
				customStartDate,
				restrictToExitDate: restrictToExitDate ?? true,
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
		runtimeScope: v.optional(v.string(), 'exit_date'),
		customEndDate: v.optional(v.string()),
		runtimeStartScope: v.optional(v.string(), 'contract_start'),
		customStartDate: v.optional(v.string()),
		restrictToExitDate: v.optional(v.string(), 'true'),
		restrictToYear: v.optional(v.string())
	}),
	async ({ excelFile, schemeId, includeOffsetRows, runtimeScope, customEndDate, runtimeStartScope, customStartDate, restrictToExitDate, restrictToYear }): Promise<GrantTransformationResult> => {
		if (!excelFile || !(excelFile instanceof File)) {
			throw new Error('Bitte wählen Sie eine gültige Excel-Datei (.xlsx) aus.');
		}

		const arrayBuffer = await excelFile.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const { participant, records } = parseExcelBuffer(buffer);

		const scheme = getGrantScheme(schemeId);
		const options: GrantTransformationOptions = {
			includeOffsetRows: includeOffsetRows === 'true' || includeOffsetRows === 'on',
			runtimeScope: (runtimeScope as any) || (restrictToExitDate === 'false' ? 'full_5_years' : 'exit_date'),
			customEndDate,
			runtimeStartScope: (runtimeStartScope as any) || 'contract_start',
			customStartDate,
			restrictToExitDate: restrictToExitDate !== 'false',
			restrictToYear: restrictToYear ? parseInt(restrictToYear, 10) : undefined
		};

		return scheme.transform(records, participant, options);
	}
);
