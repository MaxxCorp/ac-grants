import type { OrganizationBgSettings } from '#lib/types/bg';
import { DEFAULT_ORGANIZATION_BG_SETTINGS } from '#lib/grants/bg-calculator';

const STORAGE_KEY = 'ac_grants_org_bg_settings';

/**
 * Loads organization-specific Berufsgenossenschaft settings from localStorage.
 * Falls back to DEFAULT_ORGANIZATION_BG_SETTINGS if not set or during SSR.
 */
export function getOrganizationBgSettings(): OrganizationBgSettings {
	if (typeof window === 'undefined' || !window.localStorage) {
		return JSON.parse(JSON.stringify(DEFAULT_ORGANIZATION_BG_SETTINGS));
	}

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return JSON.parse(JSON.stringify(DEFAULT_ORGANIZATION_BG_SETTINGS));
		}
		const parsed = JSON.parse(raw);
		return {
			...DEFAULT_ORGANIZATION_BG_SETTINGS,
			...parsed,
			bgw: {
				...DEFAULT_ORGANIZATION_BG_SETTINGS.bgw,
				...(parsed.bgw || {})
			},
			vbg: {
				...DEFAULT_ORGANIZATION_BG_SETTINGS.vbg,
				...(parsed.vbg || {})
			}
		};
	} catch (e) {
		console.warn('Failed to parse organization BG settings from localStorage:', e);
		return JSON.parse(JSON.stringify(DEFAULT_ORGANIZATION_BG_SETTINGS));
	}
}

/**
 * Persists organization BG settings to localStorage.
 */
export function saveOrganizationBgSettings(settings: OrganizationBgSettings): void {
	if (typeof window === 'undefined' || !window.localStorage) {
		return;
	}
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (e) {
		console.warn('Failed to save organization BG settings to localStorage:', e);
	}
}

/**
 * Resets organization settings to factory defaults.
 */
export function resetOrganizationBgSettings(): OrganizationBgSettings {
	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			window.localStorage.removeItem(STORAGE_KEY);
		} catch (e) {}
	}
	return JSON.parse(JSON.stringify(DEFAULT_ORGANIZATION_BG_SETTINGS));
}
