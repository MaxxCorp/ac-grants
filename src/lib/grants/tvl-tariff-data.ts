import type { TvlTariffEntry, InsuranceFundDetails } from '#lib/types/grant';

/**
 * Standard Statutory Social Security (Arbeitgeberanteile)
 */
export const STATUTORY_SV_RATES = {
	KV_RATE: 0.073, // 7.30%
	RV_RATE: 0.093, // 9.30%
	AV_RATE: 0.013, // 1.30%
	PV_RATE: 0.018, // 1.80%
	U3_RATE: 0.0015, // 0.15% (Insolvenzumlage)
	VORSORGE_RATE: 0.0,
	FULL_TIME_HOURS_TVL: 39.4 // TV-L Tarifwochenarbeitszeit (Berlin)
} as const;

/**
 * Default statutory insurance funds (fallback when AGA tab is not present)
 */
export const DEFAULT_INSURANCE_FUNDS: InsuranceFundDetails[] = [
	{
		name: 'DAK',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.032,
		zusatzbeitragAg: 0.016,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.013,
		u2Rate: 0.0039,
		u3Rate: 0.0015,
		agaRate: 0.2314
	},
	{
		name: 'AOK BLN-BRB',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.035,
		zusatzbeitragAg: 0.0175,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.018,
		u2Rate: 0.0047,
		u3Rate: 0.0015,
		agaRate: 0.2387
	},
	{
		name: 'Barmer',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.0329,
		zusatzbeitragAg: 0.01645,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.019,
		u2Rate: 0.0042,
		u3Rate: 0.0015,
		agaRate: 0.23815
	},
	{
		name: 'Techniker',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.0269,
		zusatzbeitragAg: 0.01345,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.013,
		u2Rate: 0.0044,
		u3Rate: 0.0015,
		agaRate: 0.22935
	},
	{
		name: 'BIG direkt',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.0369,
		zusatzbeitragAg: 0.01845,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.033,
		u2Rate: 0.0029,
		u3Rate: 0.0015,
		agaRate: 0.25285
	},
	{
		name: 'BKK VBU',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.035,
		zusatzbeitragAg: 0.0175,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.0244,
		u2Rate: 0.0044,
		u3Rate: 0.0015,
		agaRate: 0.2448
	},
	{
		name: 'IKK BLN-BRB',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.0435,
		zusatzbeitragAg: 0.02175,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.0293,
		u2Rate: 0.0046,
		u3Rate: 0.0015,
		agaRate: 0.25415
	},
	{
		name: 'KKH',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.0378,
		zusatzbeitragAg: 0.0189,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.018,
		u2Rate: 0.0044,
		u3Rate: 0.0015,
		agaRate: 0.2398
	},
	{
		name: 'Bahn-BKK',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.0365,
		zusatzbeitragAg: 0.01825,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.032,
		u2Rate: 0.0042,
		u3Rate: 0.0015,
		agaRate: 0.25295
	},
	{
		name: 'MKK',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.035,
		zusatzbeitragAg: 0.0175,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.0244,
		u2Rate: 0.0044,
		u3Rate: 0.0015,
		agaRate: 0.2448
	},
	{
		name: 'Novitas BKK',
		kvRate: 0.073,
		zusatzbeitragTotal: 0.036,
		zusatzbeitragAg: 0.018,
		rvRate: 0.093,
		avRate: 0.013,
		pvRate: 0.018,
		u1Rate: 0.023,
		u2Rate: 0.003,
		u3Rate: 0.0015,
		agaRate: 0.2425
	}
];

/**
 * TV-L Tariff Database (Year 2026 and future/past years)
 */
export const TVL_TARIFF_ENTRIES_2026: TvlTariffEntry[] = [
	{
		"code": "E15Ü/1",
		"valJanMar": 6670.37,
		"jszPct": 0.3253,
		"valAbApr": 6857.14,
		"sueZulage": 0
	},
	{
		"code": "E15Ü/2",
		"valJanMar": 7380.67,
		"jszPct": 0.3253,
		"valAbApr": 7587.33,
		"sueZulage": 0
	},
	{
		"code": "E15Ü/3",
		"valJanMar": 8054.8,
		"jszPct": 0.3253,
		"valAbApr": 8280.33,
		"sueZulage": 0
	},
	{
		"code": "E15Ü/4",
		"valJanMar": 8496.92,
		"jszPct": 0.3253,
		"valAbApr": 8734.83,
		"sueZulage": 0
	},
	{
		"code": "E15Ü/5",
		"valJanMar": 8605.68,
		"jszPct": 0.3253,
		"valAbApr": 8846.64,
		"sueZulage": 0
	},
	{
		"code": "E15/1",
		"valJanMar": 5504.26,
		"jszPct": 0.3253,
		"valAbApr": 5658.38,
		"sueZulage": 0
	},
	{
		"code": "E15/2",
		"valJanMar": 5902.04,
		"jszPct": 0.3253,
		"valAbApr": 6067.3,
		"sueZulage": 0
	},
	{
		"code": "E15/3",
		"valJanMar": 6112.24,
		"jszPct": 0.3253,
		"valAbApr": 6283.38,
		"sueZulage": 0
	},
	{
		"code": "E15/4",
		"valJanMar": 6858.84,
		"jszPct": 0.3253,
		"valAbApr": 7050.89,
		"sueZulage": 0
	},
	{
		"code": "E15/5",
		"valJanMar": 7424.19,
		"jszPct": 0.3253,
		"valAbApr": 7632.07,
		"sueZulage": 0
	},
	{
		"code": "E15/6",
		"valJanMar": 7640.58,
		"jszPct": 0.3253,
		"valAbApr": 7854.52,
		"sueZulage": 0
	},
	{
		"code": "E14/1",
		"valJanMar": 5003.49,
		"jszPct": 0.3253,
		"valAbApr": 5143.59,
		"sueZulage": 0
	},
	{
		"code": "E14/2",
		"valJanMar": 5365.66,
		"jszPct": 0.3253,
		"valAbApr": 5515.9,
		"sueZulage": 0
	},
	{
		"code": "E14/3",
		"valJanMar": 5662.85,
		"jszPct": 0.3253,
		"valAbApr": 5821.41,
		"sueZulage": 0
	},
	{
		"code": "E14/4",
		"valJanMar": 6112.24,
		"jszPct": 0.3253,
		"valAbApr": 6283.38,
		"sueZulage": 0
	},
	{
		"code": "E14/5",
		"valJanMar": 6800.81,
		"jszPct": 0.3253,
		"valAbApr": 6991.23,
		"sueZulage": 0
	},
	{
		"code": "E14/6",
		"valJanMar": 6998.52,
		"jszPct": 0.3253,
		"valAbApr": 7194.48,
		"sueZulage": 0
	},
	{
		"code": "E13Ü/2",
		"valJanMar": 4967.01,
		"jszPct": 0.4647,
		"valAbApr": 5106.09,
		"sueZulage": 0
	},
	{
		"code": "E13Ü/3",
		"valJanMar": 5220.71,
		"jszPct": 0.4647,
		"valAbApr": 5366.89,
		"sueZulage": 0
	},
	{
		"code": "E13Ü/4",
		"valJanMar": 6112.24,
		"jszPct": 0.4647,
		"valAbApr": 6283.38,
		"sueZulage": 0
	},
	{
		"code": "E13Ü/5",
		"valJanMar": 6800.81,
		"jszPct": 0.4647,
		"valAbApr": 6991.23,
		"sueZulage": 0
	},
	{
		"code": "E13Ü/6",
		"valJanMar": 6998.52,
		"jszPct": 0.4647,
		"valAbApr": 7194.48,
		"sueZulage": 0
	},
	{
		"code": "E13/1",
		"valJanMar": 4629.74,
		"jszPct": 0.4647,
		"valAbApr": 4759.37,
		"sueZulage": 0
	},
	{
		"code": "E13/2",
		"valJanMar": 4967.01,
		"jszPct": 0.4647,
		"valAbApr": 5106.09,
		"sueZulage": 0
	},
	{
		"code": "E13/3",
		"valJanMar": 5220.71,
		"jszPct": 0.4647,
		"valAbApr": 5366.89,
		"sueZulage": 0
	},
	{
		"code": "E13/4",
		"valJanMar": 5713.58,
		"jszPct": 0.4647,
		"valAbApr": 5873.56,
		"sueZulage": 0
	},
	{
		"code": "E13/5",
		"valJanMar": 6394.91,
		"jszPct": 0.4647,
		"valAbApr": 6573.97,
		"sueZulage": 0
	},
	{
		"code": "E13/6",
		"valJanMar": 6580.44,
		"jszPct": 0.4647,
		"valAbApr": 6764.69,
		"sueZulage": 0
	},
	{
		"code": "E12/1",
		"valJanMar": 4193.48,
		"jszPct": 0.4647,
		"valAbApr": 4310.9,
		"sueZulage": 0
	},
	{
		"code": "E12/2",
		"valJanMar": 4474.13,
		"jszPct": 0.4647,
		"valAbApr": 4599.41,
		"sueZulage": 0
	},
	{
		"code": "E12/3",
		"valJanMar": 5068.49,
		"jszPct": 0.4647,
		"valAbApr": 5210.41,
		"sueZulage": 0
	},
	{
		"code": "E12/4",
		"valJanMar": 5590.37,
		"jszPct": 0.4647,
		"valAbApr": 5746.9,
		"sueZulage": 0
	},
	{
		"code": "E12/5",
		"valJanMar": 6264.45,
		"jszPct": 0.4647,
		"valAbApr": 6439.85,
		"sueZulage": 0
	},
	{
		"code": "E12/6",
		"valJanMar": 6446.05,
		"jszPct": 0.4647,
		"valAbApr": 6626.54,
		"sueZulage": 0
	},
	{
		"code": "E11/1",
		"valJanMar": 4064.54,
		"jszPct": 0.7435,
		"valAbApr": 4178.35,
		"sueZulage": 0
	},
	{
		"code": "E11/2",
		"valJanMar": 4323.79,
		"jszPct": 0.7435,
		"valAbApr": 4444.86,
		"sueZulage": 0
	},
	{
		"code": "E11/3",
		"valJanMar": 4619.1,
		"jszPct": 0.7435,
		"valAbApr": 4748.43,
		"sueZulage": 0
	},
	{
		"code": "E11/4",
		"valJanMar": 5068.49,
		"jszPct": 0.7435,
		"valAbApr": 5210.41,
		"sueZulage": 0
	},
	{
		"code": "E11/5",
		"valJanMar": 5720.84,
		"jszPct": 0.7435,
		"valAbApr": 5881.02,
		"sueZulage": 0
	},
	{
		"code": "E11/6",
		"valJanMar": 5886.14,
		"jszPct": 0.7435,
		"valAbApr": 6050.95,
		"sueZulage": 0
	},
	{
		"code": "E10/1",
		"valJanMar": 3928.42,
		"jszPct": 0.7435,
		"valAbApr": 4038.42,
		"sueZulage": 0
	},
	{
		"code": "E10/2",
		"valJanMar": 4182.83,
		"jszPct": 0.7435,
		"valAbApr": 4299.95,
		"sueZulage": 0
	},
	{
		"code": "E10/3",
		"valJanMar": 4474.13,
		"jszPct": 0.7435,
		"valAbApr": 4599.41,
		"sueZulage": 0
	},
	{
		"code": "E10/4",
		"valJanMar": 4771.29,
		"jszPct": 0.7435,
		"valAbApr": 4904.89,
		"sueZulage": 0
	},
	{
		"code": "E10/5",
		"valJanMar": 5336.7,
		"jszPct": 0.7435,
		"valAbApr": 5486.13,
		"sueZulage": 0
	},
	{
		"code": "E10/6",
		"valJanMar": 5490.47,
		"jszPct": 0.7435,
		"valAbApr": 5644.2,
		"sueZulage": 0
	},
	{
		"code": "E9b/1",
		"valJanMar": 3520.1,
		"jszPct": 0.7435,
		"valAbApr": 3620.1,
		"sueZulage": 0
	},
	{
		"code": "E9b/2",
		"valJanMar": 3765.38,
		"jszPct": 0.7435,
		"valAbApr": 3870.81,
		"sueZulage": 0
	},
	{
		"code": "E9b/3",
		"valJanMar": 3925.17,
		"jszPct": 0.7435,
		"valAbApr": 4035.07,
		"sueZulage": 0
	},
	{
		"code": "E9b/4",
		"valJanMar": 4366.72,
		"jszPct": 0.7435,
		"valAbApr": 4488.99,
		"sueZulage": 0
	},
	{
		"code": "E9b/5",
		"valJanMar": 4742.32,
		"jszPct": 0.7435,
		"valAbApr": 4875.1,
		"sueZulage": 0
	},
	{
		"code": "E9b/6",
		"valJanMar": 4878.28,
		"jszPct": 0.7435,
		"valAbApr": 5014.87,
		"sueZulage": 0
	},
	{
		"code": "E9a/1",
		"valJanMar": 3520.1,
		"jszPct": 0.7435,
		"valAbApr": 3620.1,
		"sueZulage": 0
	},
	{
		"code": "E9a/2",
		"valJanMar": 3765.38,
		"jszPct": 0.7435,
		"valAbApr": 3870.81,
		"sueZulage": 0
	},
	{
		"code": "E9a/3",
		"valJanMar": 3818.66,
		"jszPct": 0.7435,
		"valAbApr": 3925.58,
		"sueZulage": 0
	},
	{
		"code": "E9a/4",
		"valJanMar": 3925.17,
		"jszPct": 0.7435,
		"valAbApr": 4035.07,
		"sueZulage": 0
	},
	{
		"code": "E9a/5",
		"valJanMar": 4366.72,
		"jszPct": 0.7435,
		"valAbApr": 4488.99,
		"sueZulage": 0
	},
	{
		"code": "E9a/6",
		"valJanMar": 4490.04,
		"jszPct": 0.7435,
		"valAbApr": 4615.76,
		"sueZulage": 0
	},
	{
		"code": "E8/1",
		"valJanMar": 3319.52,
		"jszPct": 0.8814,
		"valAbApr": 3419.52,
		"sueZulage": 0
	},
	{
		"code": "E8/2",
		"valJanMar": 3559.02,
		"jszPct": 0.8814,
		"valAbApr": 3659.02,
		"sueZulage": 0
	},
	{
		"code": "E8/3",
		"valJanMar": 3692.14,
		"jszPct": 0.8814,
		"valAbApr": 3795.52,
		"sueZulage": 0
	},
	{
		"code": "E8/4",
		"valJanMar": 3818.66,
		"jszPct": 0.8814,
		"valAbApr": 3925.58,
		"sueZulage": 0
	},
	{
		"code": "E8/5",
		"valJanMar": 3958.47,
		"jszPct": 0.8814,
		"valAbApr": 4069.31,
		"sueZulage": 0
	},
	{
		"code": "E8/6",
		"valJanMar": 4045.01,
		"jszPct": 0.8814,
		"valAbApr": 4158.27,
		"sueZulage": 0
	},
	{
		"code": "E7/1",
		"valJanMar": 3135.83,
		"jszPct": 0.8814,
		"valAbApr": 3235.83,
		"sueZulage": 0
	},
	{
		"code": "E7/2",
		"valJanMar": 3369.72,
		"jszPct": 0.8814,
		"valAbApr": 3469.72,
		"sueZulage": 0
	},
	{
		"code": "E7/3",
		"valJanMar": 3545.69,
		"jszPct": 0.8814,
		"valAbApr": 3645.69,
		"sueZulage": 0
	},
	{
		"code": "E7/4",
		"valJanMar": 3678.84,
		"jszPct": 0.8814,
		"valAbApr": 3781.85,
		"sueZulage": 0
	},
	{
		"code": "E7/5",
		"valJanMar": 3785.37,
		"jszPct": 0.8814,
		"valAbApr": 3891.36,
		"sueZulage": 0
	},
	{
		"code": "E7/6",
		"valJanMar": 3878.56,
		"jszPct": 0.8814,
		"valAbApr": 3987.16,
		"sueZulage": 0
	},
	{
		"code": "E6/1",
		"valJanMar": 3086.57,
		"jszPct": 0.8814,
		"valAbApr": 3186.57,
		"sueZulage": 0
	},
	{
		"code": "E6/2",
		"valJanMar": 3318.08,
		"jszPct": 0.8814,
		"valAbApr": 3418.08,
		"sueZulage": 0
	},
	{
		"code": "E6/3",
		"valJanMar": 3447.2,
		"jszPct": 0.8814,
		"valAbApr": 3547.2,
		"sueZulage": 0
	},
	{
		"code": "E6/4",
		"valJanMar": 3578.99,
		"jszPct": 0.8814,
		"valAbApr": 3679.2,
		"sueZulage": 0
	},
	{
		"code": "E6/5",
		"valJanMar": 3665.52,
		"jszPct": 0.8814,
		"valAbApr": 3768.15,
		"sueZulage": 0
	},
	{
		"code": "E6/6",
		"valJanMar": 3758.72,
		"jszPct": 0.8814,
		"valAbApr": 3863.96,
		"sueZulage": 0
	},
	{
		"code": "E5/1",
		"valJanMar": 2973.97,
		"jszPct": 0.8814,
		"valAbApr": 3073.97,
		"sueZulage": 0
	},
	{
		"code": "E5/2",
		"valJanMar": 3201.87,
		"jszPct": 0.8814,
		"valAbApr": 3301.87,
		"sueZulage": 0
	},
	{
		"code": "E5/3",
		"valJanMar": 3330.99,
		"jszPct": 0.8814,
		"valAbApr": 3430.99,
		"sueZulage": 0
	},
	{
		"code": "E5/4",
		"valJanMar": 3453.66,
		"jszPct": 0.8814,
		"valAbApr": 3553.66,
		"sueZulage": 0
	},
	{
		"code": "E5/5",
		"valJanMar": 3552.34,
		"jszPct": 0.8814,
		"valAbApr": 3652.34,
		"sueZulage": 0
	},
	{
		"code": "E5/6",
		"valJanMar": 3618.92,
		"jszPct": 0.8814,
		"valAbApr": 3720.25,
		"sueZulage": 0
	},
	{
		"code": "E4/1",
		"valJanMar": 2849.24,
		"jszPct": 0.8743,
		"valAbApr": 2949.24,
		"sueZulage": 0
	},
	{
		"code": "E4/2",
		"valJanMar": 3079.22,
		"jszPct": 0.8743,
		"valAbApr": 3179.22,
		"sueZulage": 0
	},
	{
		"code": "E4/3",
		"valJanMar": 3240.61,
		"jszPct": 0.8743,
		"valAbApr": 3340.61,
		"sueZulage": 0
	},
	{
		"code": "E4/4",
		"valJanMar": 3330.99,
		"jszPct": 0.8743,
		"valAbApr": 3430.99,
		"sueZulage": 0
	},
	{
		"code": "E4/5",
		"valJanMar": 3421.39,
		"jszPct": 0.8743,
		"valAbApr": 3521.39,
		"sueZulage": 0
	},
	{
		"code": "E4/6",
		"valJanMar": 3479.47,
		"jszPct": 0.8743,
		"valAbApr": 3579.47,
		"sueZulage": 0
	},
	{
		"code": "E3/1",
		"valJanMar": 2815.57,
		"jszPct": 0.8743,
		"valAbApr": 2915.57,
		"sueZulage": 0
	},
	{
		"code": "E3/2",
		"valJanMar": 3040.47,
		"jszPct": 0.8743,
		"valAbApr": 3140.47,
		"sueZulage": 0
	},
	{
		"code": "E3/3",
		"valJanMar": 3105.03,
		"jszPct": 0.8743,
		"valAbApr": 3205.03,
		"sueZulage": 0
	},
	{
		"code": "E3/4",
		"valJanMar": 3208.32,
		"jszPct": 0.8743,
		"valAbApr": 3308.32,
		"sueZulage": 0
	},
	{
		"code": "E3/5",
		"valJanMar": 3292.25,
		"jszPct": 0.8743,
		"valAbApr": 3392.25,
		"sueZulage": 0
	},
	{
		"code": "E3/6",
		"valJanMar": 3363.27,
		"jszPct": 0.8743,
		"valAbApr": 3463.27,
		"sueZulage": 0
	},
	{
		"code": "E2Ü/1",
		"valJanMar": 2711.2,
		"jszPct": 0.8743,
		"valAbApr": 2811.2,
		"sueZulage": 0
	},
	{
		"code": "E2Ü/2",
		"valJanMar": 2930.72,
		"jszPct": 0.8743,
		"valAbApr": 3030.72,
		"sueZulage": 0
	},
	{
		"code": "E2Ü/3",
		"valJanMar": 3014.64,
		"jszPct": 0.8743,
		"valAbApr": 3114.64,
		"sueZulage": 0
	},
	{
		"code": "E2Ü/4",
		"valJanMar": 3117.96,
		"jszPct": 0.8743,
		"valAbApr": 3217.96,
		"sueZulage": 0
	},
	{
		"code": "E2Ü/5",
		"valJanMar": 3188.97,
		"jszPct": 0.8743,
		"valAbApr": 3288.97,
		"sueZulage": 0
	},
	{
		"code": "E2Ü/6",
		"valJanMar": 3285.81,
		"jszPct": 0.8743,
		"valAbApr": 3385.81,
		"sueZulage": 0
	},
	{
		"code": "E2/1",
		"valJanMar": 2642.84,
		"jszPct": 0.8743,
		"valAbApr": 2742.84,
		"sueZulage": 0
	},
	{
		"code": "E2/2",
		"valJanMar": 2853.24,
		"jszPct": 0.8743,
		"valAbApr": 2953.24,
		"sueZulage": 0
	},
	{
		"code": "E2/3",
		"valJanMar": 2917.8,
		"jszPct": 0.8743,
		"valAbApr": 3017.8,
		"sueZulage": 0
	},
	{
		"code": "E2/4",
		"valJanMar": 2982.36,
		"jszPct": 0.8743,
		"valAbApr": 3082.36,
		"sueZulage": 0
	},
	{
		"code": "E2/5",
		"valJanMar": 3130.84,
		"jszPct": 0.8743,
		"valAbApr": 3230.84,
		"sueZulage": 0
	},
	{
		"code": "E2/6",
		"valJanMar": 3285.81,
		"jszPct": 0.8743,
		"valAbApr": 3385.81,
		"sueZulage": 0
	},
	{
		"code": "E1/2",
		"valJanMar": 2434.49,
		"jszPct": 0.8743,
		"valAbApr": 2534.49,
		"sueZulage": 0
	},
	{
		"code": "E1/3",
		"valJanMar": 2465.06,
		"jszPct": 0.8743,
		"valAbApr": 2565.06,
		"sueZulage": 0
	},
	{
		"code": "E1/4",
		"valJanMar": 2501.78,
		"jszPct": 0.8743,
		"valAbApr": 2601.78,
		"sueZulage": 0
	},
	{
		"code": "E1/5",
		"valJanMar": 2538.51,
		"jszPct": 0.8743,
		"valAbApr": 2638.51,
		"sueZulage": 0
	},
	{
		"code": "E1/6",
		"valJanMar": 2630.3,
		"jszPct": 0.8743,
		"valAbApr": 2730.3,
		"sueZulage": 0
	},
	{
		"code": "S18/1",
		"valJanMar": 4567.91,
		"jszPct": 0.4647,
		"valAbApr": 4695.81,
		"sueZulage": 0
	},
	{
		"code": "S18/2",
		"valJanMar": 4700.37,
		"jszPct": 0.4647,
		"valAbApr": 4831.98,
		"sueZulage": 0
	},
	{
		"code": "S18/3",
		"valJanMar": 5279.68,
		"jszPct": 0.4647,
		"valAbApr": 5427.51,
		"sueZulage": 0
	},
	{
		"code": "S18/4",
		"valJanMar": 5714.12,
		"jszPct": 0.4647,
		"valAbApr": 5874.12,
		"sueZulage": 0
	},
	{
		"code": "S18/5",
		"valJanMar": 6365.82,
		"jszPct": 0.4647,
		"valAbApr": 6544.06,
		"sueZulage": 0
	},
	{
		"code": "S18/6",
		"valJanMar": 6764.05,
		"jszPct": 0.4647,
		"valAbApr": 6953.44,
		"sueZulage": 0
	},
	{
		"code": "S17/1",
		"valJanMar": 4168.58,
		"jszPct": 0.7435,
		"valAbApr": 4285.3,
		"sueZulage": 0
	},
	{
		"code": "S17/2",
		"valJanMar": 4519.36,
		"jszPct": 0.7435,
		"valAbApr": 4645.9,
		"sueZulage": 0
	},
	{
		"code": "S17/3",
		"valJanMar": 4990,
		"jszPct": 0.7435,
		"valAbApr": 5129.72,
		"sueZulage": 0
	},
	{
		"code": "S17/4",
		"valJanMar": 5279.68,
		"jszPct": 0.7435,
		"valAbApr": 5427.51,
		"sueZulage": 0
	},
	{
		"code": "S17/5",
		"valJanMar": 5858.92,
		"jszPct": 0.7435,
		"valAbApr": 6022.97,
		"sueZulage": 0
	},
	{
		"code": "S17/6",
		"valJanMar": 6199.26,
		"jszPct": 0.7435,
		"valAbApr": 6372.84,
		"sueZulage": 0
	},
	{
		"code": "S16/1",
		"valJanMar": 4074.92,
		"jszPct": 0.7435,
		"valAbApr": 4189.02,
		"sueZulage": 0
	},
	{
		"code": "S16/2",
		"valJanMar": 4425.25,
		"jszPct": 0.7435,
		"valAbApr": 4549.16,
		"sueZulage": 0
	},
	{
		"code": "S16/3",
		"valJanMar": 4743.83,
		"jszPct": 0.7435,
		"valAbApr": 4876.66,
		"sueZulage": 0
	},
	{
		"code": "S16/4",
		"valJanMar": 5134.83,
		"jszPct": 0.7435,
		"valAbApr": 5278.61,
		"sueZulage": 0
	},
	{
		"code": "S16/5",
		"valJanMar": 5569.3,
		"jszPct": 0.7435,
		"valAbApr": 5725.24,
		"sueZulage": 0
	},
	{
		"code": "S16/6",
		"valJanMar": 5829.97,
		"jszPct": 0.7435,
		"valAbApr": 5993.21,
		"sueZulage": 0
	},
	{
		"code": "S15/1",
		"valJanMar": 3930.81,
		"jszPct": 0.7435,
		"valAbApr": 4040.87,
		"sueZulage": 180
	},
	{
		"code": "S15/2",
		"valJanMar": 4265.91,
		"jszPct": 0.7435,
		"valAbApr": 4385.36,
		"sueZulage": 180
	},
	{
		"code": "S15/3",
		"valJanMar": 4555.6,
		"jszPct": 0.7435,
		"valAbApr": 4683.16,
		"sueZulage": 180
	},
	{
		"code": "S15/4",
		"valJanMar": 4888.67,
		"jszPct": 0.7435,
		"valAbApr": 5025.55,
		"sueZulage": 180
	},
	{
		"code": "S15/5",
		"valJanMar": 5424.48,
		"jszPct": 0.7435,
		"valAbApr": 5576.37,
		"sueZulage": 180
	},
	{
		"code": "S15/6",
		"valJanMar": 5656.17,
		"jszPct": 0.7435,
		"valAbApr": 5814.54,
		"sueZulage": 180
	},
	{
		"code": "S14/1",
		"valJanMar": 3911.26,
		"jszPct": 0.7435,
		"valAbApr": 4020.78,
		"sueZulage": 180
	},
	{
		"code": "S14/2",
		"valJanMar": 4224.33,
		"jszPct": 0.7435,
		"valAbApr": 4342.61,
		"sueZulage": 180
	},
	{
		"code": "S14/3",
		"valJanMar": 4546.22,
		"jszPct": 0.7435,
		"valAbApr": 4673.51,
		"sueZulage": 180
	},
	{
		"code": "S14/4",
		"valJanMar": 4873.66,
		"jszPct": 0.7435,
		"valAbApr": 5010.12,
		"sueZulage": 180
	},
	{
		"code": "S14/5",
		"valJanMar": 5235.73,
		"jszPct": 0.7435,
		"valAbApr": 5382.33,
		"sueZulage": 180
	},
	{
		"code": "S14/6",
		"valJanMar": 5489.14,
		"jszPct": 0.7435,
		"valAbApr": 5642.84,
		"sueZulage": 180
	},
	{
		"code": "S13/1",
		"valJanMar": 3848.59,
		"jszPct": 0.7435,
		"valAbApr": 3956.35,
		"sueZulage": 180
	},
	{
		"code": "S13/2",
		"valJanMar": 4123.44,
		"jszPct": 0.7435,
		"valAbApr": 4238.9,
		"sueZulage": 180
	},
	{
		"code": "S13/3",
		"valJanMar": 4483.16,
		"jszPct": 0.7435,
		"valAbApr": 4608.69,
		"sueZulage": 180
	},
	{
		"code": "S13/4",
		"valJanMar": 4772.77,
		"jszPct": 0.7435,
		"valAbApr": 4906.41,
		"sueZulage": 180
	},
	{
		"code": "S13/5",
		"valJanMar": 5134.83,
		"jszPct": 0.7435,
		"valAbApr": 5278.61,
		"sueZulage": 180
	},
	{
		"code": "S13/6",
		"valJanMar": 5315.85,
		"jszPct": 0.7435,
		"valAbApr": 5464.69,
		"sueZulage": 180
	},
	{
		"code": "S12/1",
		"valJanMar": 3798.63,
		"jszPct": 0.7435,
		"valAbApr": 3904.99,
		"sueZulage": 180
	},
	{
		"code": "S12/2",
		"valJanMar": 4112.35,
		"jszPct": 0.7435,
		"valAbApr": 4227.5,
		"sueZulage": 180
	},
	{
		"code": "S12/3",
		"valJanMar": 4457.26,
		"jszPct": 0.7435,
		"valAbApr": 4582.06,
		"sueZulage": 180
	},
	{
		"code": "S12/4",
		"valJanMar": 4761.37,
		"jszPct": 0.7435,
		"valAbApr": 4894.69,
		"sueZulage": 180
	},
	{
		"code": "S12/5",
		"valJanMar": 5137.92,
		"jszPct": 0.7435,
		"valAbApr": 5281.78,
		"sueZulage": 180
	},
	{
		"code": "S12/6",
		"valJanMar": 5297.23,
		"jszPct": 0.7435,
		"valAbApr": 5445.55,
		"sueZulage": 180
	},
	{
		"code": "S11b/1",
		"valJanMar": 3705.62,
		"jszPct": 0.7435,
		"valAbApr": 3809.38,
		"sueZulage": 180
	},
	{
		"code": "S11b/2",
		"valJanMar": 4056.87,
		"jszPct": 0.7435,
		"valAbApr": 4170.46,
		"sueZulage": 180
	},
	{
		"code": "S11b/3",
		"valJanMar": 4240.82,
		"jszPct": 0.7435,
		"valAbApr": 4359.56,
		"sueZulage": 180
	},
	{
		"code": "S11b/4",
		"valJanMar": 4704.22,
		"jszPct": 0.7435,
		"valAbApr": 4835.94,
		"sueZulage": 180
	},
	{
		"code": "S11b/5",
		"valJanMar": 5066.3,
		"jszPct": 0.7435,
		"valAbApr": 5208.16,
		"sueZulage": 180
	},
	{
		"code": "S11b/6",
		"valJanMar": 5283.52,
		"jszPct": 0.7435,
		"valAbApr": 5431.46,
		"sueZulage": 180
	},
	{
		"code": "S11a/1",
		"valJanMar": 3633.82,
		"jszPct": 0.7435,
		"valAbApr": 3735.57,
		"sueZulage": 180
	},
	{
		"code": "S11a/2",
		"valJanMar": 3982.85,
		"jszPct": 0.7435,
		"valAbApr": 4094.37,
		"sueZulage": 180
	},
	{
		"code": "S11a/3",
		"valJanMar": 4165.61,
		"jszPct": 0.7435,
		"valAbApr": 4282.25,
		"sueZulage": 180
	},
	{
		"code": "S11a/4",
		"valJanMar": 4627.99,
		"jszPct": 0.7435,
		"valAbApr": 4757.57,
		"sueZulage": 180
	},
	{
		"code": "S11a/5",
		"valJanMar": 4990,
		"jszPct": 0.7435,
		"valAbApr": 5129.72,
		"sueZulage": 180
	},
	{
		"code": "S11a/6",
		"valJanMar": 5207.25,
		"jszPct": 0.7435,
		"valAbApr": 5353.05,
		"sueZulage": 180
	},
	{
		"code": "S9/1",
		"valJanMar": 3453.32,
		"jszPct": 0.7435,
		"valAbApr": 3553.32,
		"sueZulage": 130
	},
	{
		"code": "S9/2",
		"valJanMar": 3767.26,
		"jszPct": 0.7435,
		"valAbApr": 3872.74,
		"sueZulage": 130
	},
	{
		"code": "S9/3",
		"valJanMar": 4042.58,
		"jszPct": 0.7435,
		"valAbApr": 4155.77,
		"sueZulage": 130
	},
	{
		"code": "S9/4",
		"valJanMar": 4446.83,
		"jszPct": 0.7435,
		"valAbApr": 4571.34,
		"sueZulage": 130
	},
	{
		"code": "S9/5",
		"valJanMar": 4826.94,
		"jszPct": 0.7435,
		"valAbApr": 4962.09,
		"sueZulage": 130
	},
	{
		"code": "S9/6",
		"valJanMar": 5120.21,
		"jszPct": 0.7435,
		"valAbApr": 5263.58,
		"sueZulage": 130
	},
	{
		"code": "S8b/1",
		"valJanMar": 3389.55,
		"jszPct": 0.8814,
		"valAbApr": 3489.55,
		"sueZulage": 130
	},
	{
		"code": "S8b/2",
		"valJanMar": 3691.47,
		"jszPct": 0.8814,
		"valAbApr": 3794.83,
		"sueZulage": 130
	},
	{
		"code": "S8b/3",
		"valJanMar": 3968.88,
		"jszPct": 0.8814,
		"valAbApr": 4080.01,
		"sueZulage": 130
	},
	{
		"code": "S8b/4",
		"valJanMar": 4372.42,
		"jszPct": 0.8814,
		"valAbApr": 4494.85,
		"sueZulage": 130
	},
	{
		"code": "S8b/5",
		"valJanMar": 4750.72,
		"jszPct": 0.8814,
		"valAbApr": 4883.74,
		"sueZulage": 130
	},
	{
		"code": "S8b/6",
		"valJanMar": 5040.77,
		"jszPct": 0.8814,
		"valAbApr": 5181.91,
		"sueZulage": 130
	},
	{
		"code": "S8a/1",
		"valJanMar": 3344.29,
		"jszPct": 0.8814,
		"valAbApr": 3444.29,
		"sueZulage": 0
	},
	{
		"code": "S8a/2",
		"valJanMar": 3615.79,
		"jszPct": 0.8814,
		"valAbApr": 3717.03,
		"sueZulage": 0
	},
	{
		"code": "S8a/3",
		"valJanMar": 3855.39,
		"jszPct": 0.8814,
		"valAbApr": 3963.34,
		"sueZulage": 0
	},
	{
		"code": "S8a/4",
		"valJanMar": 4082.39,
		"jszPct": 0.8814,
		"valAbApr": 4196.7,
		"sueZulage": 0
	},
	{
		"code": "S8a/5",
		"valJanMar": 4303.05,
		"jszPct": 0.8814,
		"valAbApr": 4423.54,
		"sueZulage": 0
	},
	{
		"code": "S8a/6",
		"valJanMar": 4533.2,
		"jszPct": 0.8814,
		"valAbApr": 4660.13,
		"sueZulage": 0
	},
	{
		"code": "S7/1",
		"valJanMar": 3269.05,
		"jszPct": 0.8814,
		"valAbApr": 3369.05,
		"sueZulage": 0
	},
	{
		"code": "S7/2",
		"valJanMar": 3525.89,
		"jszPct": 0.8814,
		"valAbApr": 3625.89,
		"sueZulage": 0
	},
	{
		"code": "S7/3",
		"valJanMar": 3750.87,
		"jszPct": 0.8814,
		"valAbApr": 3855.89,
		"sueZulage": 0
	},
	{
		"code": "S7/4",
		"valJanMar": 3975.8,
		"jszPct": 0.8814,
		"valAbApr": 4087.12,
		"sueZulage": 0
	},
	{
		"code": "S7/5",
		"valJanMar": 4144.54,
		"jszPct": 0.8814,
		"valAbApr": 4260.59,
		"sueZulage": 0
	},
	{
		"code": "S7/6",
		"valJanMar": 4396.27,
		"jszPct": 0.8814,
		"valAbApr": 4519.37,
		"sueZulage": 0
	},
	{
		"code": "S4/1",
		"valJanMar": 3106.28,
		"jszPct": 0.8814,
		"valAbApr": 3206.28,
		"sueZulage": 0
	},
	{
		"code": "S4/2",
		"valJanMar": 3378.25,
		"jszPct": 0.8814,
		"valAbApr": 3478.25,
		"sueZulage": 0
	},
	{
		"code": "S4/3",
		"valJanMar": 3575.11,
		"jszPct": 0.8814,
		"valAbApr": 3675.21,
		"sueZulage": 0
	},
	{
		"code": "S4/4",
		"valJanMar": 3708.67,
		"jszPct": 0.8814,
		"valAbApr": 3812.51,
		"sueZulage": 0
	},
	{
		"code": "S4/5",
		"valJanMar": 3835.23,
		"jszPct": 0.8814,
		"valAbApr": 3942.62,
		"sueZulage": 0
	},
	{
		"code": "S4/6",
		"valJanMar": 4032.36,
		"jszPct": 0.8814,
		"valAbApr": 4145.27,
		"sueZulage": 0
	},
	{
		"code": "S3/1",
		"valJanMar": 2919.44,
		"jszPct": 0.8743,
		"valAbApr": 3019.44,
		"sueZulage": 0
	},
	{
		"code": "S3/2",
		"valJanMar": 3191.26,
		"jszPct": 0.8743,
		"valAbApr": 3291.26,
		"sueZulage": 0
	},
	{
		"code": "S3/3",
		"valJanMar": 3380.36,
		"jszPct": 0.8743,
		"valAbApr": 3480.36,
		"sueZulage": 0
	},
	{
		"code": "S3/4",
		"valJanMar": 3554.01,
		"jszPct": 0.8743,
		"valAbApr": 3654.01,
		"sueZulage": 0
	},
	{
		"code": "S3/5",
		"valJanMar": 3633.45,
		"jszPct": 0.8743,
		"valAbApr": 3735.19,
		"sueZulage": 0
	},
	{
		"code": "S3/6",
		"valJanMar": 3728.36,
		"jszPct": 0.8743,
		"valAbApr": 3832.75,
		"sueZulage": 0
	},
	{
		"code": "S2/1",
		"valJanMar": 2815.57,
		"jszPct": 0.8743,
		"valAbApr": 2915.57,
		"sueZulage": 0
	},
	{
		"code": "S2/2",
		"valJanMar": 3040.47,
		"jszPct": 0.8743,
		"valAbApr": 3140.47,
		"sueZulage": 0
	},
	{
		"code": "S2/3",
		"valJanMar": 3105.03,
		"jszPct": 0.8743,
		"valAbApr": 3205.03,
		"sueZulage": 0
	},
	{
		"code": "S2/4",
		"valJanMar": 3208.32,
		"jszPct": 0.8743,
		"valAbApr": 3308.32,
		"sueZulage": 0
	},
	{
		"code": "S2/5",
		"valJanMar": 3292.25,
		"jszPct": 0.8743,
		"valAbApr": 3392.25,
		"sueZulage": 0
	},
	{
		"code": "S2/6",
		"valJanMar": 3363.27,
		"jszPct": 0.8743,
		"valAbApr": 3463.27,
		"sueZulage": 0
	}
];

/**
 * Registry of tariffs by year
 */
export const TVL_TARIFF_BY_YEAR: Record<number, { switchMonth: number; switchMonthName: string; entries: TvlTariffEntry[] }> = {
	2026: {
		switchMonth: 4, // April
		switchMonthName: 'April',
		entries: TVL_TARIFF_ENTRIES_2026
	}
};

/**
 * Normalizes tariff codes like "EG2", "EG 2", "E 2/2", "E2-2", "E2/ES2" -> "E2/2"
 */
export function normalizeTvlTariffCode(code: string, fallbackGroup = 'E2', fallbackStep = '2'): string {
	if (!code) return `${fallbackGroup}/${fallbackStep}`;
	let s = code.trim().toUpperCase().replace(/\s+/g, '');
	
	// If already in format "E2/2" or "S8B/1"
	if (/^[A-Z0-9Ü]+\/[0-9]+$/.test(s)) {
		return s;
	}
	
	// If format "EG2" or "E2"
	const match = s.match(/^(?:EG|E|S)([0-9A-ZÜ]+?)(?:\/|ES|-)?([0-9])?$/);
	if (match) {
		const prefix = s.startsWith('S') ? 'S' : 'E';
		const grp = match[1];
		const stp = match[2] || fallbackStep;
		return `${prefix}${grp}/${stp}`;
	}
	
	return s;
}

/**
 * Retrieves tariff entry by year and code (e.g. 2026, 'E2/2')
 */
export function getTvlTariffEntry(year: number, code: string): TvlTariffEntry | null {
	const table = TVL_TARIFF_BY_YEAR[year] || TVL_TARIFF_BY_YEAR[2026];
	const norm = normalizeTvlTariffCode(code);
	const found = table.entries.find(e => e.code.toUpperCase() === norm.toUpperCase());
	if (found) return found;

	// Fallback to simple matching if exact code not found
	const loose = table.entries.find(e => {
		const cleanA = e.code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
		const cleanB = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
		return cleanA === cleanB;
	});
	return loose || null;
}

/**
 * Returns all available tariff codes for a given year
 */
export function getAllTvlTariffCodes(year: number = 2026): string[] {
	const table = TVL_TARIFF_BY_YEAR[year] || TVL_TARIFF_BY_YEAR[2026];
	return table.entries.map(e => e.code);
}
