/**
 * Currency codes offered in settings.
 *
 * The field used to be free text, which let a typo through to `fmtMoney` —
 * `Intl` rejects an unknown code, so the app fell back to printing the raw
 * letters and every price in the app quietly lost its symbol. Picking from a
 * list makes that unrepresentable.
 */

export interface Currency {
  code: string
  name: string
  region: string
}

export const CURRENCIES: Currency[] = [
  { code: 'IDR', name: 'Indonesian Rupiah', region: 'Asia-Pacific' },
  { code: 'SGD', name: 'Singapore Dollar', region: 'Asia-Pacific' },
  { code: 'MYR', name: 'Malaysian Ringgit', region: 'Asia-Pacific' },
  { code: 'THB', name: 'Thai Baht', region: 'Asia-Pacific' },
  { code: 'VND', name: 'Vietnamese Dong', region: 'Asia-Pacific' },
  { code: 'PHP', name: 'Philippine Peso', region: 'Asia-Pacific' },
  { code: 'CNY', name: 'Chinese Yuan', region: 'Asia-Pacific' },
  { code: 'JPY', name: 'Japanese Yen', region: 'Asia-Pacific' },
  { code: 'KRW', name: 'South Korean Won', region: 'Asia-Pacific' },
  { code: 'HKD', name: 'Hong Kong Dollar', region: 'Asia-Pacific' },
  { code: 'TWD', name: 'New Taiwan Dollar', region: 'Asia-Pacific' },
  { code: 'INR', name: 'Indian Rupee', region: 'Asia-Pacific' },
  { code: 'AUD', name: 'Australian Dollar', region: 'Asia-Pacific' },
  { code: 'NZD', name: 'New Zealand Dollar', region: 'Asia-Pacific' },

  { code: 'USD', name: 'US Dollar', region: 'Americas' },
  { code: 'CAD', name: 'Canadian Dollar', region: 'Americas' },
  { code: 'BRL', name: 'Brazilian Real', region: 'Americas' },
  { code: 'MXN', name: 'Mexican Peso', region: 'Americas' },

  { code: 'EUR', name: 'Euro', region: 'Europe' },
  { code: 'GBP', name: 'British Pound', region: 'Europe' },
  { code: 'CHF', name: 'Swiss Franc', region: 'Europe' },
  { code: 'SEK', name: 'Swedish Krona', region: 'Europe' },
  { code: 'NOK', name: 'Norwegian Krone', region: 'Europe' },
  { code: 'DKK', name: 'Danish Krone', region: 'Europe' },
  { code: 'PLN', name: 'Polish Złoty', region: 'Europe' },
  { code: 'CZK', name: 'Czech Koruna', region: 'Europe' },
  { code: 'TRY', name: 'Turkish Lira', region: 'Europe' },
  { code: 'RUB', name: 'Russian Ruble', region: 'Europe' },

  { code: 'AED', name: 'UAE Dirham', region: 'Middle East & Africa' },
  { code: 'SAR', name: 'Saudi Riyal', region: 'Middle East & Africa' },
  { code: 'ZAR', name: 'South African Rand', region: 'Middle East & Africa' },
  { code: 'NGN', name: 'Nigerian Naira', region: 'Middle East & Africa' },
  { code: 'EGP', name: 'Egyptian Pound', region: 'Middle East & Africa' },
]

/**
 * The symbol the browser will actually print for a code, in the user's own
 * locale — read out of `Intl` rather than kept in a table here, so the hint
 * beside each option can never disagree with what the reports render.
 *
 * Empty when there is nothing to add: plenty of currencies have no glyph in a
 * given locale and `Intl` hands back the code itself, which beside a label
 * that already opens with the code reads as a stutter — "IDR — Indonesian
 * Rupiah  IDR".
 */
export function currencySymbol(code: string): string {
  try {
    const symbol = Intl.NumberFormat(undefined, { style: 'currency', currency: code })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? ''
    return symbol === code ? '' : symbol
  } catch {
    return ''
  }
}
