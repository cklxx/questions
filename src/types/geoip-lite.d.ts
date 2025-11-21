declare module 'geoip-lite' {
  export interface Lookup {
    country?: string;
  }

  export function lookup(ip: string): Lookup | null;

  const geoip: {
    lookup: typeof lookup;
  };

  export default geoip;
}
