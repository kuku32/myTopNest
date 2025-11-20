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
