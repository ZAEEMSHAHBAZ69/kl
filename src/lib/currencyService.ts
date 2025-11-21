import { supabase } from './supabase';

interface ExchangeRate {
  currency_code: string;
  usd_rate: number;
  rate_date: string;
}

const exchangeRateCache: Map<string, { rate: number; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 60 * 1000;

export async function getExchangeRate(currencyCode: string): Promise<number> {
  if (currencyCode === 'USD') {
    return 1.0;
  }

  const cached = exchangeRateCache.get(currencyCode);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.rate;
  }

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('usd_rate, rate_date')
      .eq('currency_code', currencyCode)
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn(`No exchange rate found for ${currencyCode}, defaulting to 1.0`);
      return 1.0;
    }

    exchangeRateCache.set(currencyCode, {
      rate: data.usd_rate,
      timestamp: Date.now(),
    });

    return data.usd_rate;
  } catch (error) {
    console.error(`Error fetching exchange rate for ${currencyCode}:`, error);
    return 1.0;
  }
}

export async function convertToUSD(amount: number, fromCurrency: string): Promise<number> {
  const rate = await getExchangeRate(fromCurrency);
  return amount * rate;
}

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$',
    CHF: 'CHF ',
    CNY: '¥',
    INR: '₹',
    BRL: 'R$',
    MXN: 'MX$',
    NZD: 'NZ$',
    SGD: 'S$',
    HKD: 'HK$',
    KRW: '₩',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    ZAR: 'R',
    THB: '฿',
    PLN: 'zł',
    RUB: '₽',
  };

  const symbol = currencySymbols[currencyCode] || currencyCode + ' ';

  // Currencies that don't use decimal places
  if (['JPY', 'KRW'].includes(currencyCode)) {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }

  // Format with proper thousands separators and 2 decimal places
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${symbol}${formattedAmount}`;
}

export async function getAllExchangeRates(): Promise<Map<string, number>> {
  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('currency_code, usd_rate')
      .order('rate_date', { ascending: false });

    if (error || !data) {
      return new Map([['USD', 1.0]]);
    }

    const ratesMap = new Map<string, number>();
    const seenCurrencies = new Set<string>();

    for (const rate of data) {
      if (!seenCurrencies.has(rate.currency_code)) {
        ratesMap.set(rate.currency_code, rate.usd_rate);
        seenCurrencies.add(rate.currency_code);
      }
    }

    return ratesMap;
  } catch (error) {
    console.error('Error fetching all exchange rates:', error);
    return new Map([['USD', 1.0]]);
  }
}
