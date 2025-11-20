import { Expose, Transform } from 'class-transformer';

export class CoinHistoryDto {
  @Expose()
  @Transform(({ value }) => {
    if (!value) return null;

    const date = new Date(value);
    // Format: YYYY-MM-DD HH:mm:ss (24-hour, ISO-like)
    return date
      .toLocaleString('en-CA', { 
        timeZone: 'America/New_York', // optional: adjust for your region
        hour12: false 
      })
      .replace(',', '');
  })
  date: string;
  @Expose({ name: 'rate' })
  @Transform(({ value }) => (value != null ? Number(value.toFixed(2)) : null))
  close: number;

  @Expose()
  volume: number;

  @Expose()
  cap: number;

  @Expose()
  liquidity: number;
}
