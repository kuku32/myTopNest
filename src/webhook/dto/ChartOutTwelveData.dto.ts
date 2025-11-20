import { Exclude, Expose, Transform } from 'class-transformer';

export class ChartOutTwelveData {
  @Expose({ name: 'volume' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  volume: number;

  @Expose({ name: 'open' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  open: number;

  @Expose({ name: 'close' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  close: number;

  @Expose({ name: 'low' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  low: number;

  @Expose({ name: 'high' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  high: number;

  @Expose({ name: 'datetime' })
  @Transform(({ value }) => {
    if (!value) return null;
    const date = new Date(value);
    return date.toLocaleString('en-CA', { hour12: false }).replace(',', '');
  })
  date: string;
}


export class ChartOutTwelveDataUTC {
  @Expose({ name: 'volume' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  volume: number;

  @Expose({ name: 'open' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  open: number;

  @Expose({ name: 'close' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  close: number;

  @Expose({ name: 'low' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  low: number;

  @Expose({ name: 'high' })
  @Transform(({ value }) => (value ? Number(value) : 0))
  high: number;

  @Expose({ name: 'datetime' })
  @Transform(({ value }) => {
    if (!value) return null;

    // Create Date object assuming the value is UTC
    const utcDate = new Date(value + 'Z');

    // Convert to America/New_York
    const estString = utcDate.toLocaleString('en-CA', {
      timeZone: 'America/New_York',
      hour12: false,
    });

    // Format similar to your original style (YYYY-MM-DD HH:mm:ss)
    return estString.replace(',', '');
  })
  date: string;
}