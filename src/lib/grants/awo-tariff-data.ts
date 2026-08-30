import type { MonthlyRecord, ParticipantInfo } from '#lib/types/grant';

export interface AwoTariffGroupStep {
	group: string; // 'E1' - 'E15', 'S02' - 'S18'
	step1?: number;
	step2: number;
	step3: number;
	step4: number;
	step5: number;
	step6: number;
}

export interface AwoTariffPeriod {
	id: string; // '2026-01', '2026-09', '2027-07', '2028-07'
	label: string;
	validFromYear: number;
	validFromMonth: number;
	fullTimeHours: number; // 39.0
	scales: Record<string, [number | undefined, number, number, number, number, number]>; // group -> [s1, s2, s3, s4, s5, s6]
}

/**
 * Official AWO Landesverband Berlin e.V. Tariftabellen
 * (Valid ab 2026/01, 2026/09, 2027/07, 2028/07)
 */
export const AWO_TARIFF_PERIODS: AwoTariffPeriod[] = [
	// 1. ab 2026/01
	{
		id: '2026-01',
		label: 'ab 2026/01',
		validFromYear: 2026,
		validFromMonth: 1,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5366.66, 5754.49, 5959.43, 6687.37, 7238.59, 7449.57],
			'E14': [4878.39, 5231.51, 5521.28, 5959.43, 6630.79, 6823.56],
			'E13': [4514.00, 4842.84, 5090.20, 5570.75, 6235.04, 6415.93],
			'E12': [4088.64, 4362.28, 4941.78, 5450.62, 6107.84, 6284.90],
			'E11': [3962.92, 4215.70, 4503.62, 4941.78, 5577.83, 5738.99],
			'E10': [3830.21, 4078.26, 4362.28, 4652.01, 5203.28, 5353.21],
			'E9':  [3432.10, 3671.24, 3827.04, 4257.55, 4623.76, 4756.32],
			'E8':  [3236.53, 3470.04, 3599.84, 3723.19, 3859.51, 3943.89],
			'E7':  [3057.43, 3285.48, 3457.05, 3586.86, 3690.74, 3781.59],
			'E6':  [3009.41, 3235.13, 3361.02, 3489.52, 3573.89, 3664.75],
			'E5':  [2899.63, 3121.83, 3247.72, 3367.32, 3463.53, 3528.45],
			'E4':  [2778.00, 3002.23, 3159.60, 3247.72, 3335.85, 3392.49],
			'E3':  [2745.18, 2964.46, 3027.41, 3128.11, 3209.94, 3279.18],
			'E2':  [2576.77, 2781.91, 2844.86, 2907.80, 3052.57, 3203.67],
			'E1':  [undefined, 2373.63, 2403.43, 2439.24, 2475.05, 2564.54],

			'S18': [4339.51, 4465.35, 5015.70, 5428.42, 6047.52, 6425.85],
			'S17': [3960.15, 4293.39, 4740.51, 5015.70, 5565.98, 5889.31],
			'S16': [3871.17, 4203.99, 4506.63, 4878.09, 5290.84, 5538.48],
			'S15': [3734.28, 4052.61, 4327.82, 4644.24, 5153.26, 5373.37],
			'S14': [3715.70, 4013.11, 4318.91, 4629.97, 4973.95, 5214.69],
			'S13': [3656.16, 3917.27, 4259.00, 4534.13, 4878.09, 5050.05],
			'S12': [3608.70, 3906.73, 4234.40, 4523.30, 4881.03, 5032.37],
			'S11b': [3520.35, 3854.02, 4028.77, 4469.01, 4812.98, 5019.35],
			'S11a': [3452.13, 3783.70, 3957.34, 4396.59, 4740.51, 4946.88],
			'S09': [3280.65, 3578.89, 3840.45, 4224.48, 4585.60, 4864.20],
			'S08b': [3220.07, 3506.89, 3770.43, 4153.80, 4513.18, 4788.73],
			'S08a': [3177.07, 3435.01, 3662.62, 3878.26, 4087.89, 4306.54],
			'S07': [3105.60, 3349.60, 3563.33, 3777.01, 3937.31, 4176.46],
			'S04': [2950.96, 3209.33, 3396.35, 3523.24, 3643.47, 3830.74],
			'S03': [2773.47, 3031.70, 3211.34, 3376.31, 3451.78, 3541.94],
			'S02': [2674.79, 2888.44, 2949.78, 3047.91, 3127.64, 3195.10]
		}
	},

	// 2. ab 2026/09
	{
		id: '2026-09',
		label: 'ab 2026/09',
		validFromYear: 2026,
		validFromMonth: 9,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5516.93, 5915.62, 6126.29, 6874.62, 7441.27, 7658.16],
			'E14': [5014.98, 5377.99, 5675.88, 6126.29, 6816.45, 7014.62],
			'E13': [4640.39, 4978.44, 5232.73, 5726.73, 6409.62, 6595.58],
			'E12': [4203.12, 4484.42, 5080.15, 5603.24, 6278.86, 6460.88],
			'E11': [4073.88, 4333.74, 4629.72, 5080.15, 5734.01, 5899.68],
			'E10': [3937.46, 4192.45, 4484.42, 4782.27, 5348.97, 5503.10],
			'E9':  [3529.60, 3774.03, 3934.20, 4376.76, 4753.23, 4889.50],
			'E8':  [3334.03, 3567.54, 3700.64, 3827.44, 3967.58, 4054.32],
			'E7':  [3154.93, 3382.98, 3554.55, 3687.29, 3794.08, 3887.47],
			'E6':  [3106.91, 3332.63, 3458.52, 3587.23, 3673.96, 3767.36],
			'E5':  [2997.13, 3219.33, 3345.22, 3464.82, 3561.03, 3627.25],
			'E4':  [2875.50, 3099.73, 3257.10, 3345.22, 3433.35, 3489.99],
			'E3':  [2842.68, 3061.96, 3124.91, 3225.61, 3307.44, 3376.68],
			'E2':  [2674.27, 2879.41, 2942.36, 3005.30, 3150.07, 3301.17],
			'E1':  [undefined, 2471.13, 2500.93, 2536.74, 2572.55, 2662.04],

			'S18': [4461.02, 4590.38, 5156.14, 5580.42, 6216.85, 6605.77],
			'S17': [4071.03, 4413.60, 4873.24, 5156.14, 5721.83, 6054.21],
			'S16': [3979.56, 4321.70, 4632.82, 5014.68, 5438.98, 5693.56],
			'S15': [3838.84, 4166.08, 4449.00, 4774.28, 5297.55, 5523.82],
			'S14': [3819.74, 4125.48, 4439.84, 4759.61, 5113.22, 5360.70],
			'S13': [3758.53, 4026.95, 4378.25, 4661.09, 5014.68, 5191.45],
			'S12': [3709.74, 4016.12, 4352.96, 4649.95, 5017.70, 5173.28],
			'S11b': [3618.92, 3961.93, 4141.58, 4594.14, 4947.74, 5159.89],
			'S11a': [3548.79, 3889.64, 4068.15, 4519.69, 4873.24, 5085.39],
			'S09': [3375.65, 3679.10, 3947.98, 4342.77, 4714.00, 5000.40],
			'S08b': [3315.07, 3605.08, 3876.00, 4270.11, 4639.55, 4922.81],
			'S08a': [3272.07, 3531.19, 3765.17, 3986.85, 4202.35, 4427.12],
			'S07': [3200.60, 3444.60, 3663.10, 3882.77, 4047.55, 4293.40],
			'S04': [3045.96, 3304.33, 3491.45, 3621.89, 3745.49, 3938.00],
			'S03': [2868.47, 3126.70, 3306.34, 3471.31, 3548.43, 3641.11],
			'S02': [2769.79, 2983.44, 3044.78, 3142.91, 3222.64, 3290.10]
		}
	},

	// 3. ab 2027/07
	{
		id: '2027-07',
		label: 'ab 2027/07',
		validFromYear: 2027,
		validFromMonth: 7,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5627.27, 6033.93, 6248.82, 7012.11, 7590.10, 7811.32],
			'E14': [5115.28, 5485.55, 5789.40, 6248.82, 6952.78, 7154.91],
			'E13': [4733.20, 5078.01, 5337.38, 5841.26, 6537.81, 6727.49],
			'E12': [4287.18, 4574.11, 5181.75, 5715.30, 6404.44, 6590.10],
			'E11': [4155.36, 4420.41, 4722.31, 5181.75, 5848.69, 6017.67],
			'E10': [4016.21, 4276.30, 4574.11, 4877.92, 5455.95, 5613.16],
			'E9':  [3600.19, 3849.51, 4012.88, 4464.30, 4848.29, 4987.29],
			'E8':  [3400.71, 3638.89, 3774.65, 3903.99, 4046.93, 4135.41],
			'E7':  [3218.03, 3450.64, 3625.64, 3761.04, 3869.96, 3965.22],
			'E6':  [3169.05, 3399.28, 3527.69, 3658.97, 3747.44, 3842.71],
			'E5':  [3057.07, 3283.72, 3412.12, 3534.12, 3632.25, 3699.80],
			'E4':  [2933.01, 3161.72, 3322.24, 3412.12, 3502.02, 3559.79],
			'E3':  [2899.53, 3123.20, 3187.41, 3290.12, 3373.59, 3444.21],
			'E2':  [2727.76, 2937.00, 3001.21, 3065.41, 3213.07, 3367.19],
			'E1':  [undefined, 2520.55, 2550.95, 2587.47, 2624.00, 2715.28],

			'S18': [4550.24, 4682.19, 5259.26, 5692.03, 6341.19, 6737.89],
			'S17': [4152.45, 4501.87, 4970.70, 5259.26, 5836.27, 6175.29],
			'S16': [4059.15, 4408.13, 4725.48, 5114.97, 5547.76, 5807.43],
			'S15': [3915.62, 4249.40, 4537.98, 4869.77, 5403.50, 5634.30],
			'S14': [3896.13, 4207.99, 4528.64, 4854.80, 5215.48, 5467.91],
			'S13': [3833.70, 4107.49, 4465.82, 4754.31, 5114.97, 5295.28],
			'S12': [3783.93, 4096.44, 4440.02, 4742.95, 5118.05, 5276.75],
			'S11b': [3691.30, 4041.17, 4224.41, 4686.02, 5046.69, 5263.09],
			'S11a': [3619.77, 3967.43, 4149.51, 4610.08, 4970.70, 5187.10],
			'S09': [3443.16, 3752.68, 4026.94, 4429.63, 4808.28, 5100.41],
			'S08b': [3381.37, 3677.18, 3953.52, 4355.51, 4732.34, 5021.27],
			'S08a': [3337.51, 3601.81, 3840.47, 4066.59, 4286.40, 4515.66],
			'S07': [3264.61, 3513.49, 3736.36, 3960.43, 4128.50, 4379.27],
			'S04': [3106.88, 3370.42, 3561.28, 3694.33, 3820.40, 4016.76],
			'S03': [2925.84, 3189.23, 3372.47, 3540.74, 3619.40, 3713.93],
			'S02': [2825.19, 3043.11, 3105.68, 3205.77, 3287.09, 3355.90]
		}
	},

	// 4. ab 2028/07
	{
		id: '2028-07',
		label: 'ab 2028/07',
		validFromYear: 2028,
		validFromMonth: 7,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5683.54, 6094.27, 6311.31, 7082.23, 7666.00, 7889.43],
			'E14': [5166.43, 5540.41, 5847.29, 6311.31, 7022.31, 7226.46],
			'E13': [4780.53, 5128.79, 5390.75, 5899.67, 6603.19, 6794.76],
			'E12': [4330.05, 4619.85, 5233.57, 5772.45, 6468.48, 6656.00],
			'E11': [4196.91, 4464.61, 4769.53, 5233.57, 5907.18, 6077.85],
			'E10': [4056.37, 4319.06, 4619.85, 4926.70, 5510.51, 5669.29],
			'E9':  [3636.19, 3888.01, 4053.01, 4508.94, 4896.77, 5037.16],
			'E8':  [3434.72, 3675.28, 3812.40, 3943.03, 4087.40, 4176.76],
			'E7':  [3250.21, 3485.15, 3661.90, 3798.65, 3908.66, 4004.87],
			'E6':  [3200.74, 3433.27, 3562.97, 3695.56, 3784.91, 3881.14],
			'E5':  [3087.64, 3316.56, 3446.24, 3569.46, 3668.57, 3736.80],
			'E4':  [2962.34, 3193.34, 3355.46, 3446.24, 3537.04, 3595.39],
			'E3':  [2928.53, 3154.43, 3219.28, 3323.02, 3407.33, 3478.65],
			'E2':  [2755.04, 2966.37, 3031.22, 3096.06, 3245.20, 3400.86],
			'E1':  [undefined, 2545.76, 2576.46, 2613.34, 2650.24, 2742.43],

			'S18': [4595.74, 4729.01, 5311.85, 5748.95, 6404.60, 6805.27],
			'S17': [4193.97, 4546.89, 5020.41, 5311.85, 5894.63, 6237.04],
			'S16': [4099.74, 4452.21, 4772.73, 5166.12, 5603.24, 5865.50],
			'S15': [3954.78, 4291.89, 4583.36, 4918.47, 5457.54, 5690.64],
			'S14': [3935.09, 4250.07, 4573.93, 4903.35, 5267.63, 5522.59],
			'S13': [3872.04, 4148.56, 4510.48, 4801.85, 5166.12, 5348.23],
			'S12': [3821.77, 4137.40, 4484.42, 4790.38, 5169.23, 5329.52],
			'S11b': [3728.21, 4081.58, 4266.65, 4732.88, 5097.16, 5315.72],
			'S11a': [3655.97, 4007.10, 4191.01, 4656.18, 5020.41, 5238.97],
			'S09': [3477.59, 3790.21, 4067.21, 4473.93, 4856.36, 5151.41],
			'S08b': [3415.18, 3713.95, 3993.06, 4399.07, 4779.66, 5071.48],
			'S08a': [3370.89, 3637.83, 3878.87, 4107.26, 4329.26, 4560.82],
			'S07': [3297.26, 3548.62, 3773.72, 4000.03, 4169.79, 4423.06],
			'S04': [3137.95, 3404.12, 3596.89, 3731.27, 3858.60, 4056.93],
			'S03': [2955.10, 3221.12, 3406.19, 3576.15, 3655.59, 3751.07],
			'S02': [2853.44, 3073.54, 3136.74, 3237.83, 3319.96, 3389.46]
		}
	}
];

function round2(v: number): number {
	return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Normalizes tariff group key (e.g. "EG 2" -> "E2", "S 8b" -> "S08b", "S8b" -> "S08b", "S9" -> "S09").
 */
export function normalizeAwoGroupKey(rawGroup: string): string {
	const clean = rawGroup.toUpperCase().replace(/\s+/g, '').replace(/^EG/, 'E');
	// Handle SuE single digit padding like S8b -> S08b, S9 -> S09
	const sMatch = clean.match(/^S(\d)([A-Z]?)$/);
	if (sMatch) {
		return `S0${sMatch[1]}${sMatch[2] || ''}`;
	}
	return clean;
}

/**
 * Finds the applicable AWO tariff period for a specific year and month.
 */
export function getApplicableAwoPeriod(year: number, month: number): AwoTariffPeriod {
	// Look from newest to oldest
	const dateVal = year * 100 + month;
	for (let i = AWO_TARIFF_PERIODS.length - 1; i >= 0; i--) {
		const p = AWO_TARIFF_PERIODS[i];
		const pVal = p.validFromYear * 100 + p.validFromMonth;
		if (dateVal >= pVal) {
			return p;
		}
	}
	return AWO_TARIFF_PERIODS[0];
}

/**
 * Looks up the official AWO full-time (39h) and part-time salary for a given group, step, year, month, and weekly hours.
 */
export function getAwoTariffSalary(
	group: string,
	step: number,
	year: number,
	month: number,
	weeklyHours = 30,
	fullTimeHours = 39.0
): { fteSalary: number; partTimeSalary: number; periodLabel: string } | null {
	const period = getApplicableAwoPeriod(year, month);
	const groupKey = normalizeAwoGroupKey(group);
	let groupScales = period.scales[groupKey];
	if (!groupScales) {
		const foundKey = Object.keys(period.scales).find(k => k.toLowerCase() === groupKey.toLowerCase());
		if (foundKey) {
			groupScales = period.scales[foundKey];
		}
	}
	if (!groupScales) return null;

	const stepIdx = Math.max(1, Math.min(6, step)) - 1;
	const fteSalary = groupScales[stepIdx];
	if (fteSalary === undefined) return null;

	const partTimeSalary = round2((fteSalary / (fullTimeHours || period.fullTimeHours)) * weeklyHours);
	return {
		fteSalary,
		partTimeSalary,
		periodLabel: period.label
	};
}

export interface TariffDiscrepancy {
	recordDate: string;
	year: number;
	month: number;
	group: string;
	step: string;
	recordedFteSalary: number;
	expectedFteSalary: number;
	recordedPartTimeSalary: number;
	expectedPartTimeSalary: number;
	diffPartTime: number;
	isDiscrepancy: boolean;
	explanation: string;
}

export interface TariffValidationReport {
	isCompliant: boolean;
	checkedCount: number;
	discrepancyCount: number;
	discrepancies: TariffDiscrepancy[];
	summaryText: string;
}

/**
 * Validates an array of monthly records from an uploaded Berechnungsblatt against the official AWO tariff tables.
 */
export function validateBerechnungsblattTariff(
	records: MonthlyRecord[],
	participant: ParticipantInfo
): TariffValidationReport {
	const discrepancies: TariffDiscrepancy[] = [];
	let checkedCount = 0;

	for (const rec of records) {
		const stepNum = parseInt((participant.tariffStep.match(/\d+/) || ['1'])[0], 10);
		// Check if record falls in an anniversary step upgrade
		const awoTariff = getAwoTariffSalary(
			participant.tariffGroup,
			stepNum,
			rec.year,
			rec.month,
			rec.weeklyHours || participant.weeklyHours,
			rec.fullTimeHours || participant.fullTimeHours || 39.0
		);

		if (!awoTariff) continue;
		checkedCount++;

		const expectedPt = round2(awoTariff.partTimeSalary * (rec.monthUnits || 1.0));
		const diffPt = round2(rec.partTimeSalary - expectedPt);
		const fteDiff = round2(rec.fteSalary - awoTariff.fteSalary);

		// Toleranz 0.05 € for rounding variations
		const isDiscrepancy = Math.abs(diffPt) > 0.05 && Math.abs(fteDiff) > 0.05;

		if (isDiscrepancy) {
			discrepancies.push({
				recordDate: rec.date,
				year: rec.year,
				month: rec.month,
				group: participant.tariffGroup,
				step: participant.tariffStep,
				recordedFteSalary: rec.fteSalary,
				expectedFteSalary: awoTariff.fteSalary,
				recordedPartTimeSalary: rec.partTimeSalary,
				expectedPartTimeSalary: expectedPt,
				diffPartTime: diffPt,
				isDiscrepancy: true,
				explanation: `Monat ${rec.month}/${rec.year}: Berechnungsblatt = ${rec.partTimeSalary.toFixed(2)} € vs. AWO-Tariftabelle (${awoTariff.periodLabel}) = ${expectedPt.toFixed(2)} € (Diff: ${diffPt > 0 ? '+' : ''}${diffPt.toFixed(2)} €)`
			});
		}
	}

	const isCompliant = discrepancies.length === 0;
	return {
		isCompliant,
		checkedCount,
		discrepancyCount: discrepancies.length,
		discrepancies,
		summaryText: isCompliant
			? `Alle ${checkedCount} geprüften Entgelte stimmen mit den offiziellen AWO-Tariftabellen überein.`
			: `${discrepancies.length} Abweichung(en) zwischen Berechnungsblatt und offiziellen AWO-Tariftabellen gefunden.`
	};
}
