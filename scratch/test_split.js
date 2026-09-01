function getMonthSlices(start, durationMonths) {
	// calculate end
	let totalMonths = (start.year * 12 + start.month - 1);
	if (start.day === 1) {
		totalMonths += durationMonths - 1;
	} else {
		// When starting mid-month (e.g. 16th), duration is full years/months to day-1
		// E.g. 16.11.2022 for 60 months (5 years) ends on 15.11.2027!
		totalMonths += durationMonths;
	}
	const endYear = Math.floor(totalMonths / 12);
	const endMonth = (totalMonths % 12) + 1;
	let endDay = (start.day === 1) ? new Date(endYear, endMonth, 0).getDate() : (start.day - 1);
	if (endDay < 1) endDay = 1;
	const end = { year: endYear, month: endMonth, day: endDay };

	const startYear = start.year;
	const startIndex = start.year * 12 + start.month;
	const endIndex = end.year * 12 + end.month;

	let cumulativeUnits = 0;
	const allRows = [];

	for (let y = startYear; y <= endYear; y++) {
		const yearRows = [];
		for (let m = 1; m <= 12; m++) {
			const monthIndex = y * 12 + m;
			const lastDay = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');
			const yy = String(y).slice(-2);

			if (monthIndex < startIndex || monthIndex > endIndex) {
				// Inactive
				yearRows.push({
					year: y,
					month: m,
					isActive: false,
					dateStr: `${mStr}/${lastDay}/${yy}`,
					monthUnits: 0,
					degression: 0
				});
				continue;
			}

			// Active month
			if (monthIndex === startIndex) {
				// First active month
				const units = (start.day === 1) ? 1.0 : 0.5;
				const dateDay = (start.day === 1) ? lastDay : start.day;
				cumulativeUnits += units;
				yearRows.push({
					year: y,
					month: m,
					isActive: true,
					dateStr: `${mStr}/${dateDay}/${yy}`,
					monthUnits: units,
					degression: 100,
					cumulativeUnits
				});
			} else if (monthIndex === endIndex) {
				// Final active month
				const remainingUnits = durationMonths - cumulativeUnits;
				const units = remainingUnits < 1.0 ? remainingUnits : 1.0;
				const dateDay = (end.day < lastDay) ? end.day : lastDay;
				cumulativeUnits += units;
				let degression = 70;
				if (cumulativeUnits <= 24) degression = 100;
				else if (cumulativeUnits <= 36) degression = 90;
				else if (cumulativeUnits <= 48) degression = 80;

				yearRows.push({
					year: y,
					month: m,
					isActive: true,
					dateStr: `${mStr}/${dateDay}/${yy}`,
					monthUnits: units,
					degression,
					cumulativeUnits
				});
			} else {
				// Intermediate active month
				// Check if a degression threshold (24, 36, 48) is crossed strictly inside this month
				let splitThreshold = null;
				for (const T of [24, 36, 48]) {
					if (cumulativeUnits < T && cumulativeUnits + 1.0 > T) {
						splitThreshold = T;
						break;
					}
				}

				if (splitThreshold !== null) {
					// SPLIT MONTH! 2 rows
					const units1 = splitThreshold - cumulativeUnits; // e.g. 24 - 23.5 = 0.5
					const degression1 = splitThreshold === 24 ? 100 : (splitThreshold === 36 ? 90 : 80);
					cumulativeUnits += units1;

					yearRows.push({
						year: y,
						month: m,
						isActive: true,
						dateStr: `${mStr}/15/${yy}`,
						monthUnits: units1,
						degression: degression1,
						isSplitPart: 1,
						cumulativeUnits
					});

					const units2 = 1.0 - units1; // e.g. 0.5
					const degression2 = splitThreshold === 24 ? 90 : (splitThreshold === 36 ? 80 : 70);
					cumulativeUnits += units2;

					yearRows.push({
						year: y,
						month: m,
						isActive: true,
						dateStr: `${mStr}/${lastDay}/${yy}`,
						monthUnits: units2,
						degression: degression2,
						isSplitPart: 2,
						cumulativeUnits
					});
				} else {
					// Single full month
					cumulativeUnits += 1.0;
					let degression = 100;
					if (cumulativeUnits > 48) degression = 70;
					else if (cumulativeUnits > 36) degression = 80;
					else if (cumulativeUnits > 24) degression = 90;

					yearRows.push({
						year: y,
						month: m,
						isActive: true,
						dateStr: `${mStr}/${lastDay}/${yy}`,
						monthUnits: 1.0,
						degression,
						cumulativeUnits
					});
				}
			}
		}
		allRows.push({ year: y, rows: yearRows });
	}

	return { end, allRows, totalUnits: cumulativeUnits };
}

const res = getMonthSlices({ year: 2022, month: 11, day: 16 }, 60);
console.log('Total cumulative units:', res.totalUnits);
console.log('End Date:', res.end);
res.allRows.forEach(yr => {
	console.log(`=== Year ${yr.year} (${yr.rows.length} rows) ===`);
	yr.rows.forEach(r => {
		if (r.isActive) {
			console.log(`  ${r.dateStr} | units=${r.monthUnits} | deg=${r.degression}% | cum=${r.cumulativeUnits}`);
		}
	});
});
