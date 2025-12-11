import { Expose, Transform } from 'class-transformer';

export class ChartOutTiingo {
  @Expose({name:'ticker'})
  ticker: string

  @Expose({name:'open'})
  open: number

  @Expose({name:'close'})
  close: number

  @Expose({name:'low'})
  low: number

  @Expose({name:'high'})
  high: number

  @Expose({ name: 'date' })
  @Transform(({ value }) => {
    if (!value) return null;
    const date = new Date(value);
    return date.toLocaleString('en-CA', { hour12: false }).replace(',', '');
  })
  date: string;

}
// (EST/EDT)
// @Transform(({ value }) => {
//   if (!value) return null;

//   // Parse the date and convert to Eastern Time
//   const date = new Date(value);
//   return date
//     .toLocaleString('en-CA', {
//       hour12: false,
//       timeZone: 'America/New_York', // forces EST/EDT
//     })
//     .replace(',', '');
// })
// date: string;