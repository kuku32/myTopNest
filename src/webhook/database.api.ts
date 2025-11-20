
export function formatDate(date: {
  getFullYear: () => any;
  getMonth: () => number;
  getDate: () => any;
}) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateUnder(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}_${mm}_${dd}`;
}
export function getDateNDaysAgo(n: number) {
  const now = new Date(); // current date and time
  now.setDate(now.getDate() - n); // subtract n days
  return formatDateUnder(now);
}
function getRecentWashSellSymbols(list: { [x: string]: any }, days = 32, limit = 3000) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  const symbolsSet = new Set<string>();

  // Extract and sort keys by date descending
  const sortedKeys = Object.keys(list)
    .map((key) => {
      const match = key.match(/list_day_(\d{4})_(\d{2})_(\d{2})/);
      if (!match) return null;
      const [, year, month, day] = match;
      return { key, date: new Date(`${year}-${month}-${day}T00:00:00Z`) };
    })
    .filter(Boolean)
    .sort((a, b) => b!.date.getTime() - a!.date.getTime()); // newest first

  for (const item of sortedKeys) {
    if (!item) continue;
    const { key, date } = item;
    if (date < cutoff || date > now) continue;

    for (const symbol of list[key]) {
      symbolsSet.add(symbol);
      if (symbolsSet.size >= limit) break; // stop when 20 unique symbols
    }
    if (symbolsSet.size >= limit) break;
  }

  return Array.from(symbolsSet);
}

function turnto(firebaseData: Record<string, Record<string, string>>) {
  const lists: Record<string, string[]> = {};

  for (const [date, symbolsObj] of Object.entries(firebaseData)) {
    const key = `list_day_${date}`;
    const symbols = Object.values(symbolsObj);
    lists[key] = symbols;
  }
  return lists;
}

export function getwashsell30(data: Record<string, Record<string, string>>) {
  const list = turnto(data);
  return getRecentWashSellSymbols(list);
}

// export function getlast10days(data: Record<string, Record<string, string>>) {
//   const list = turnto(data);
//   return getRecentWashSellSymbols(list,10);
// }

export function getlastXdays(data: Record<string, Record<string, string>>, XDAY=5, limit = 50) {
  const list = turnto(data);
  return getRecentWashSellSymbols(list, XDAY,limit);
}

