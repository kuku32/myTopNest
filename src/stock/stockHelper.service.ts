import { Injectable, NotAcceptableException } from '@nestjs/common';

@Injectable()
export class StockHelperService {
  async returnNewData(dataIn: any[]) {
    if (!dataIn?.length) return [];

    // Sort ascending by date (oldest first)
    // dataIn.sort(
    //   (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    // );

    dataIn = await this.calculateMovingAverage(dataIn, 5, 'MA5');
    dataIn = await this.calculateMovingAverage(dataIn, 10, 'MA10');
    dataIn = await this.calculateMovingAverage(dataIn, 20, 'MA20');
    dataIn = await this.calculateMovingAverage(dataIn, 50, 'MA50');
    dataIn = await this.calculateMovingAverage(dataIn, 100, 'MA100');
    dataIn = await this.calculateMovingAverage(dataIn, 200, 'MA200');
    dataIn = await this.calculateRSI(dataIn);
    dataIn = await this.calculateMACD(dataIn);

    return dataIn;
  }

  /**
   * Simple Moving Average
   */
  async calculateMovingAverage(data: any[], windowSize: number, maLabel: string) {
    if (!data?.length) return [];

    for (let i = 0; i < data.length; i++) {
      if (i >= windowSize - 1) {
        const windowData = data.slice(i - windowSize + 1, i + 1);
        const sum = windowData.reduce((acc, val) => acc + (val?.close ?? 0), 0);
        const average = sum / windowSize;
        data[i][maLabel] = parseFloat(average?.toFixed(2)); // assign to current index
      } else {
        data[i][maLabel] = null; // optional clarity
      }
    }

    return data;
  }

  /**
   * Relative Strength Index (RSI)
   */
  async calculateRSI(data: any[], period = 14) {
    if (!data?.length) return [];

    const gains: number[] = [];
    const losses: number[] = [];

    // Price changes between consecutive closes
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Initial average gain/loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    const rsiArray = Array(data.length).fill(null);

    // Compute RSI from 'period' onward
    for (let i = period; i < data.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      rsiArray[i] = parseFloat(rsi.toFixed(2));
    }

    // Merge RSI into data
    return data.map((item, i) => ({
      ...item,
      RSI: rsiArray[i],
    }));
  }

  /**
   * Exponential Moving Average (EMA)
   */
  async calculateEMA(data: any[], period: number) {
    if (!data?.length || data.length < period) return [];

    const multiplier = 2 / (period + 1);
    const emaArray = Array(data.length).fill(null);

    const sma =
      data.slice(0, period).reduce((sum, val) => sum + val.close, 0) / period;
    emaArray[period - 1] = sma;

    for (let i = period; i < data.length; i++) {
      emaArray[i] =
        (data[i].close - emaArray[i - 1]) * multiplier + emaArray[i - 1];
    }

    return emaArray;
  }

  /**
   * Moving Average Convergence Divergence (MACD)
   */
  async calculateMACD(
    data: any[],
    shortPeriod = 12,
    longPeriod = 26,
    signalPeriod = 9
  ) {
    if (!data?.length) return [];
  
    // 1️⃣ Compute short and long EMAs
    const shortEMA = await this.calculateEMA(data, shortPeriod);
    const longEMA = await this.calculateEMA(data, longPeriod);
  
    // 2️⃣ Compute MACD line
    const macdLine = data.map((_, i) =>
      shortEMA[i] != null && longEMA[i] != null
        ? Number((shortEMA[i] - longEMA[i]).toFixed(4))
        : null
    );
  
    // 3️⃣ Compute Signal line as EMA of MACD line
    // Prepare MACD objects for calculateEMA (use only numeric values)
    const macdObjects = macdLine.map((val) => ({ close: val ?? 0 }));
    const signalEMA = await this.calculateEMA(macdObjects, signalPeriod);
  
    // Assign Signal line with proper nulls at the start
    const signalLine = signalEMA.map((v, i) => (i < signalPeriod - 1 ? null : Number(v.toFixed(4))));
  
    // 4️⃣ Compute MACD Histogram
    const histogram = macdLine.map((macd, i) =>
      macd != null && signalLine[i] != null ? Number((macd - signalLine[i]).toFixed(4)) : null
    );
  
    // 5️⃣ Optional: Divergence detection
    const divergence: ('bullish' | 'bearish' | null)[] = Array(data.length).fill(null);
    for (let i = 1; i < data.length; i++) {
      if (histogram[i - 1] != null && histogram[i] != null) {
        if (data[i].close < data[i - 1].close && histogram[i] > histogram[i - 1]) {
          divergence[i] = 'bullish';
        } else if (data[i].close > data[i - 1].close && histogram[i] < histogram[i - 1]) {
          divergence[i] = 'bearish';
        }
      }
    }
  
    // 6️⃣ Merge results
    return data.map((item, i) => ({
      ...item,
      MACDLine: macdLine[i],
      SignalLine: signalLine[i],
      divergence: histogram[i],
      MACDDivergence: divergence[i],
    }));
  }
  
async transformData(data: any[]) {
  const transformedData = {};

  data.forEach((entry: { date: string; }) => {
    const dateKey = entry.date.split(" ")[0]; // Extracting the date part
    if (!transformedData[dateKey]) {
      transformedData[dateKey] = []; // Initializing a list for that date
    }
    transformedData[dateKey].push(entry); // Appending the entry to the list
  });

  return transformedData;
}

async getDateRanges(startDateStr:string, endDateStr:string, daysPerRange:number) {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const ranges = [];

  let currentEndDate = new Date(endDate); // Initialize the end date

  // Loop to generate ranges
  while (currentEndDate >= startDate) {
    let currentStartDate = new Date(currentEndDate); // Initialize start date as the current end date
    currentStartDate.setDate(currentEndDate.getDate() - daysPerRange + 1); // Calculate start date for the range

    // Ensure the currentStartDate doesn't go before the startDate
    if (currentStartDate < startDate) {
      currentStartDate = new Date(startDate);
    }

    // Add the calculated range to the ranges array
    ranges.push({
      start: currentStartDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      end: currentEndDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
    });

    // Update currentEndDate to one day before the currentStartDate to avoid overlap
    currentEndDate = new Date(currentStartDate);
    currentEndDate.setDate(currentEndDate.getDate() - 1);
  }
  console.log(ranges)
  return ranges;
}

async calculateDaysBetween(startDateStr:string, endDateStr:string) {
  // Convert string dates to Date objects
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // Calculate the difference in milliseconds
  const differenceInMillis = endDate.getTime() - startDate.getTime();

  // Convert milliseconds to days (1 day = 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const daysBetween = Math.ceil(differenceInMillis / millisecondsPerDay);
  // if(daysBetween<0){
  //   throw new NotAcceptableException("Startday should before end day");
  // }
  return daysBetween;
}

async getAbbreviatedDay(dateString: string) {
  // Split the date string into components
  const [year, month, day] = dateString.split('-').map(Number);
  // Create a new Date object using the components, subtracting 1 from the month
  const date = new Date(Date.UTC(year, month - 1, day));
  const options: Intl.DateTimeFormatOptions = { weekday: 'short' };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

async getDateThreeDaysAgo(dateString: string) {
  // Create a new Date object from the input string
  const date = new Date(dateString);
  // Subtract 3 days (in milliseconds)
  date.setDate(date.getDate() - 3);
  // Format the date back to 'YYYY-MM-DD'
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
formatDate(date: any) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

getDateNDaysAgo(n: number) {
  const now = new Date(); // current date and time
  now.setDate(now.getDate() - n); // subtract n days
  return this.formatDate(now);
}
formatSymbol(symbol: string) {
  const match = symbol.match(/^([A-Z]+?)(USD|USDT|BTC|ETH|EUR|JPY)$/);
  return match ? `${match[1]}/${match[2]}` : symbol;
}
getmatch1only(symbol: string) {
  const match = symbol.match(/^([A-Z]+?)(USD|USDT|BTC|ETH|EUR|JPY)$/);
  return match ? `${match[1]}` : symbol;
}

 // Common NYSE holidays (update annually)
 private readonly holidays = [
  '2025-01-01', // New Year’s Day
  '2025-01-20', // Martin Luther King Jr. Day
  '2025-02-17', // Presidents’ Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
];

// Half trading days (market closes at 1:00 PM ET)
private readonly halfDays = [
  '2025-11-28', // Day after Thanksgiving
  '2025-12-24', // Christmas Eve
];

isMarketOpen(): boolean {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const day = nyTime.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false; // weekend

  const dateStr = nyTime.toISOString().split('T')[0];
  if (this.holidays.includes(dateStr)) return false;

  const minutes = nyTime.getHours() * 60 + nyTime.getMinutes();
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = this.halfDays.includes(dateStr) ? 13 * 60 : 16 * 60; // 1:00 PM or 4:00 PM

  return minutes >= marketOpen && minutes <= marketClose;
}
}
