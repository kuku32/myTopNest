import { Injectable, NotAcceptableException } from '@nestjs/common';
import { StockData } from './dto/chartData';

@Injectable()
export class StockHelperService {
  async returnNewData(dataIn: any[]) {
    if (!dataIn?.length) return [];

    // Sort ascending by date (oldest first)
    // dataIn.sort(
    //   (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    // );

    dataIn = await this.calculateMovingAverage(dataIn, 5, 'MA5');
    dataIn = await this.calculateMovingAverage(dataIn, 9, 'MA9');
    dataIn = await this.calculateMovingAverage(dataIn, 10, 'MA10');
    dataIn = await this.calculateMovingAverage(dataIn, 15, 'MA15');
    dataIn = await this.calculateMovingAverage(dataIn, 20, 'MA20');
    dataIn = await this.calculateMovingAverage(dataIn, 50, 'MA50');
    dataIn = await this.calculateMovingAverage(dataIn, 100, 'MA100');
    dataIn = await this.calculateMovingAverage(dataIn, 200, 'MA200');
    dataIn = await this.calculateRSI(dataIn);
    dataIn = await this.calculateStochasticRSI(dataIn);
    dataIn = await this.calculateMACD(dataIn);

    return dataIn;
  }

  /**
   * Simple Moving Average
   */
  async calculateMovingAverage(
    data: any[],
    windowSize: number,
    maLabel: string,
  ) {
    if (!data?.length) return [];

    for (let i = 0; i < data.length; i++) {
      if (i >= windowSize - 1) {
        const windowData = data.slice(i - windowSize + 1, i + 1);
        const sum = windowData.reduce((acc, val) => acc + (val?.close ?? 0), 0);
        const average = sum / windowSize;
        data[i][maLabel] = parseFloat(average?.toFixed(9)); // assign to current index
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
      rsiArray[i] = parseFloat(rsi.toFixed(9));
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
    signalPeriod = 9,
  ) {
    if (!data?.length) return [];

    // 1️⃣ Compute short and long EMAs
    const shortEMA = await this.calculateEMA(data, shortPeriod);
    const longEMA = await this.calculateEMA(data, longPeriod);

    // 2️⃣ Compute MACD line
    const macdLine = data.map((_, i) =>
      shortEMA[i] != null && longEMA[i] != null
        ? Number((shortEMA[i] - longEMA[i]).toFixed(7))
        : null,
    );

    // 3️⃣ Compute Signal line as EMA of MACD line
    // Prepare MACD objects for calculateEMA (use only numeric values)
    const macdObjects = macdLine.map((val) => ({ close: val ?? 0 }));
    const signalEMA = await this.calculateEMA(macdObjects, signalPeriod);

    // Assign Signal line with proper nulls at the start
    const signalLine = signalEMA.map((v, i) =>
      i < signalPeriod - 1 ? null : Number(v.toFixed(7)),
    );

    // 4️⃣ Compute MACD Histogram
    const histogram = macdLine.map((macd, i) =>
      macd != null && signalLine[i] != null
        ? Number((macd - signalLine[i]).toFixed(7))
        : null,
    );

    // 5️⃣ Optional: Divergence detection
    const divergence: ('bullish' | 'bearish' | null)[] = Array(
      data.length,
    ).fill(null);
    for (let i = 1; i < data.length; i++) {
      if (histogram[i - 1] != null && histogram[i] != null) {
        if (
          data[i].close < data[i - 1].close &&
          histogram[i] > histogram[i - 1]
        ) {
          divergence[i] = 'bullish';
        } else if (
          data[i].close > data[i - 1].close &&
          histogram[i] < histogram[i - 1]
        ) {
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

  /**
   * Calculate 3, 3, 14, 14 Stochastic RSI
   */
  async calculateStochasticRSI(
    data: any[],
    rsiPeriod: number = 14,
    stochPeriod: number = 14,
    kSmoothing: number = 3,
    dSmoothing: number = 3,
  ) {
    if (!data?.length) return [];

    // Step 1: Calculate RSI first
    const rsiData = await this.calculateRSI(data, rsiPeriod);
    const stochRSIArray: number[] = Array(data.length).fill(null);
    const kArray: number[] = Array(data.length).fill(null); // K values (Stochastic RSI)
    const dArray: number[] = Array(data.length).fill(null); // D values (3-period smoothing of K)

    // Step 2: Calculate Stochastic RSI (K)
    for (let i = stochPeriod - 1; i < data.length; i++) {
      const rsiWindow = rsiData.slice(i - stochPeriod + 1, i + 1); // Get RSI window for the period
      const minRSI = Math.min(...rsiWindow.map((item) => item.RSI)); // Get min RSI in the window
      const maxRSI = Math.max(...rsiWindow.map((item) => item.RSI)); // Get max RSI in the window

      if (maxRSI !== minRSI) {
        // Calculate Stochastic RSI (K)
        const stochRSI = (rsiData[i].RSI - minRSI) / (maxRSI - minRSI);
        stochRSIArray[i] = parseFloat(stochRSI.toFixed(9)); // Store the Stochastic RSI value
      } else {
        stochRSIArray[i] = null; // Set null if maxRSI equals minRSI (to avoid division by zero)
      }
    }

    // Step 3: Calculate K (Fast Stochastic RSI)
    for (let i = kSmoothing - 1; i < data.length; i++) {
      const kWindow = stochRSIArray.slice(i - kSmoothing + 1, i + 1);
      const kAverage =
        kWindow.reduce((acc, val) => (val !== null ? acc + val : acc), 0) /
        kSmoothing;
      kArray[i] = parseFloat(kAverage.toFixed(9));
    }

    // Step 4: Calculate D (Slow Stochastic RSI) - 3-period moving average of K
    for (let i = dSmoothing - 1; i < data.length; i++) {
      const dWindow = kArray.slice(i - dSmoothing + 1, i + 1);
      const dAverage =
        dWindow.reduce((acc, val) => (val !== null ? acc + val : acc), 0) /
        dSmoothing;
      dArray[i] = parseFloat(dAverage.toFixed(9));
    }

    // Step 5: Merge K and D values into the data
    return data.map((item, i) => ({
      ...item,
      StochRSI_K: kArray[i], // K (Stochastic RSI)
      StochRSI_D: dArray[i], // D (Slow Stochastic RSI)
    }));
  }

  async transformData(data: any[]) {
    const transformedData = {};

    data.forEach((entry: { date: string }) => {
      const dateKey = entry.date.split(' ')[0]; // Extracting the date part
      if (!transformedData[dateKey]) {
        transformedData[dateKey] = []; // Initializing a list for that date
      }
      transformedData[dateKey].push(entry); // Appending the entry to the list
    });

    return transformedData;
  }

  async getDateRanges(
    startDateStr: string,
    endDateStr: string,
    daysPerRange: number,
  ) {
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
    console.log(ranges);
    return ranges;
  }

  async calculateDaysBetween(startDateStr: string, endDateStr: string) {
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
    '2026-01-01', // New Year’s Day
    '2026-01-19', // Martin Luther King Jr. Day
    '2026-02-16', // Presidents’ Day
    '2026-04-03', // Good Friday
    '2026-05-25', // Memorial Day
    '2026-06-19', // Juneteenth
    '2026-07-04', // Independence Day
    '2026-09-07', // Labor Day
    '2026-11-26', // Thanksgiving
    '2026-12-25', // Christmas
  ];

  // Half trading days (market closes at 1:00 PM ET)
  private readonly halfDays = [
    '2026-11-27', // Day after Thanksgiving
    '2026-12-24', // Christmas Eve
  ];

  isMarketOpen(): boolean {
    const now = new Date();
    const nyTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
    );

    const day = nyTime.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return false; // weekend

    const dateStr = nyTime.toISOString().split('T')[0];
    if (this.holidays.includes(dateStr)) return false;

    const minutes = nyTime.getHours() * 60 + nyTime.getMinutes();
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = this.halfDays.includes(dateStr) ? 13 * 60 : 16 * 60; // 1:00 PM or 4:00 PM

    return minutes >= marketOpen && minutes <= marketClose;
  }

  async earlyBuyInRSI(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety

    const isDivergenceNegative = last.divergence != null && last.divergence < 0;
    const isRSISetup =
      last.RSI != null &&
      prev.RSI != null &&
      last.RSI < 40 &&
      last.RSI > prev.RSI;
    const isMACDRising =
      last.MACDLine != null &&
      prev.MACDLine != null &&
      last.MACDLine > prev.MACDLine;

    return (
      isDivergenceNegative &&
      isRSISetup &&
      isMACDRising &&
      last.close > last.MA200
    );
  }

  async earlySellInRSI(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety

    const isDivergenceNegative = last.divergence != null && last.divergence > 0;
    const isRSISetup =
      last.RSI != null &&
      prev.RSI != null &&
      last.RSI > 60 &&
      last.RSI < prev.RSI;
    const isMACDRising =
      last.MACDLine != null &&
      prev.MACDLine != null &&
      last.MACDLine < prev.MACDLine;

    return isDivergenceNegative && isRSISetup && isMACDRising;
  }

  async macdCrossAB(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    return last.divergence > 0 && prev.divergence < 0;
  }
  async macdCrossBL(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    return last.divergence < 0 && prev.divergence > 0;
  }
  async macdCrossAB_BL0(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    return (
      last.divergence > 0 &&
      prev.divergence < 0 &&
      (last.MACDLine < 0 ||
        last.SignalLine < 0 ||
        prev.MACDLine < 0 ||
        prev.SignalLine < 0)
    );
  }
  private readonly forexHolidays = [
    '2026-01-01', // New Year's Day (global)
    '2026-12-25', // Christmas
    '2026-12-26', // Boxing Day (some brokers close)
  ];

  isForexMarketOpen(): boolean {
    const now = new Date();
    // Convert to Eastern Time
    const nyTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
    );

    const day = nyTime.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const hours = nyTime.getHours();
    const dateStr = nyTime.toISOString().split('T')[0];

    // Check global holidays (rare, but some brokers close)
    if (this.forexHolidays.includes(dateStr)) return false;

    // Forex market opens Sunday 5 PM ET
    if (day === 0 && hours < 17) return false; // before 5 PM Sunday

    // Forex market closes Friday 5 PM ET
    if (day === 5 && hours >= 17) return false; // after 5 PM Friday

    // Closed all Saturday
    if (day === 6) return false;

    return true; // otherwise open
  }
  async priceAbAll1or5or15MinBUY(
    last: StockData,
    prev: StockData,
  ): Promise<boolean> {
    if (!last) return false; // safety
    const highestLast = Math.max(
      last.MA5,
      last.MA10,
      last.MA20,
      last.MA50,
      last.MA100,
      last.MA200,
    );
    const LastaboveAll = last.close > highestLast;

    const highestPrev = Math.max(
      prev.MA5,
      prev.MA10,
      prev.MA20,
      prev.MA50,
      prev.MA100,
      prev.MA200,
    );
    const PrevBlowAll = prev.close < highestPrev;
    return LastaboveAll && PrevBlowAll;
  }
  async priceAbMA200BUY(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    const LastAbMA200 = last.high > last.MA200;
    const PrevBlMa200 = prev.low < prev.MA200;
    return LastAbMA200 && PrevBlMa200;
  }

  async AbMA200BUY_MACDCR(last: StockData, prev: StockData): Promise<boolean> {
    return (await this.macdCrossAB(last, prev)) && last.close > last.MA200;
  }

  async priceBlMA200SELL(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    const LastAbMA200 = last.low < last.MA200;
    const PrevBlMa200 = prev.high > prev.MA200;
    return LastAbMA200 && PrevBlMa200;
  }

  async priceBlAll1or5or15MinSELL(
    last: StockData,
    prev: StockData,
  ): Promise<boolean> {
    if (!last) return false; // safety
    const lowestLast = Math.min(
      last.MA5,
      last.MA10,
      last.MA20,
      last.MA50,
      last.MA100,
      last.MA200,
    );
    const blowAll = last.low < lowestLast;
    return blowAll && last.divergence < 0;
  }

  async Over200NUpBuy(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    return last.divergence > 0 && (await this.priceAbMA200BUY(last, prev));
  }

  async Under200NDownSell(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    return last.divergence < 0 && (await this.priceBlMA200SELL(last, prev));
  }

  /**
BUY ALL
   */
  async BlMA200_MA20_MA50_MA100_BUY(
    last: StockData,
    prev: StockData,
  ): Promise<boolean> {
    if (!last || !prev) return false; // safety
    const BlMa200 = last.MA200 > last.close;
    const abMa20 = last.high > last.MA20 && prev.low < prev.MA20;
    const abMa50 = last.high > last.MA50 && prev.low < prev.MA50;
    const abMa100 = last.high > last.MA100 && prev.low < prev.MA100;
    const MacdLine_divergen = last.divergence > 0;
    return abMa50 && MacdLine_divergen && BlMa200;
  }

  async ABMA200_macdCrossAB_BUY(
    last: StockData,
    prev: StockData,
  ): Promise<boolean> {
    if (!last || !prev) return false; // safety
    const ABMa200 = last.MA200 < last.close;
    return ABMa200 && (await this.macdCrossAB(last, prev));
  }

  /**
SELL ALL
   */
  async BlMA200_MA20_MA50_MA100_SELL(
    last: StockData,
    prev: StockData,
  ): Promise<boolean> {
    if (!last || !prev) return false; // safety
    const BlMa200 = last.MA200 > last.close;
    const blMA20 = last.low < last.MA20 && prev.high > prev.MA20;
    const blMA50 = last.low < last.MA50 && prev.high > prev.MA50;
    const blMA100 = last.low < last.MA100 && prev.high > prev.MA100;
    const MacdLine_divergen = last.divergence < 0;
    return (blMA20 || blMA50 || blMA100) && MacdLine_divergen && BlMa200;
  }

  async ABMA200_macdCrossBL_SELL(
    last: StockData,
    prev: StockData,
  ): Promise<boolean> {
    if (!last || !prev) return false; // safety
    const ABMa200 = last.MA200 > last.close;
    return ABMa200 && (await this.macdCrossBL(last, prev));
  }

  async RSI_28(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    const RSI28 = last.RSI < 28 || prev.RSI < 28;
    const RSIUP = last.RSI > prev.RSI;
    return RSI28 && RSIUP;
  }

  async BlMA200_MA50_BUY(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    const BlMa200 = last.MA200 > last.close;
    const abMa50 = last.high > last.MA50 && prev.low < prev.MA50;
    const MacdLine_divergen = last.divergence > 0;
    return abMa50 && MacdLine_divergen && BlMa200;
  }

  async StochRSIBuy_HOLD(last: StockData, prev: StockData): Promise<{upside:boolean, upside80:boolean}> {
    if (!last || !prev) return {upside:false, upside80:false}; // safety
    const stockRSILAUP= last.StochRSI_K - last.StochRSI_D > 0
    const stockRSIPRUP= prev.StochRSI_K - prev.StochRSI_D > 0
    const compare2day = stockRSILAUP >= stockRSIPRUP
    const inrange2080=  last.StochRSI_K < 80  && prev.StochRSI_K < 80
    return {
      upside : stockRSILAUP && compare2day,
      upside80 : stockRSILAUP && stockRSIPRUP && inrange2080
    };
  }
}
