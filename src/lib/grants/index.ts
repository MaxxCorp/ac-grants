import type { GrantSchemeDefinition, MonthlyRecord, ParticipantInfo, GrantTransformationOptions, GrantTransformationResult, ParticipantDataset } from '#lib/types/grant';
import { transformSgb16i, transformSgb16iMulti } from './sgb16i.js';

export const GRANT_SCHEMES: GrantSchemeDefinition[] = [
	{
		id: 'sgb16i-berlin',
		name: '§ 16i SGB II (Jobcenter + ZGS Berlin Landesmittel)',
		description: 'Teilhabe am Arbeitsmarkt (§ 16i SGB II) mit degressiver Jobcenter-Förderung (100%->90%->80%->70%), ZGS-Landesmittel-Kofinanzierung (SV-Fehlbetrag, Degressionsausgleich, Jahressonderzahlung) und monatlicher Sachkostenpauschale (155 €).',
		defaultTariff: 'AWO Berlin (Tarifeinigung 05.05.2026)',
		legalBasis: '§ 16i SGB II / Landesprogramm Arbeit und Qualifizierung Berlin (ZGS)',
		standardSachkostenMonthly: 155,
		standardJcFlatRatePct: 19,
		transform: (records: MonthlyRecord[], participant: ParticipantInfo, options: GrantTransformationOptions): GrantTransformationResult => {
			return transformSgb16i(records, participant, options);
		},
		transformMulti: (participants: ParticipantDataset[], options: GrantTransformationOptions): GrantTransformationResult => {
			return transformSgb16iMulti(participants, options);
		}
	}
];

export function getGrantScheme(schemeId = 'sgb16i-berlin'): GrantSchemeDefinition {
	const found = GRANT_SCHEMES.find(s => s.id === schemeId);
	return found || GRANT_SCHEMES[0];
}
