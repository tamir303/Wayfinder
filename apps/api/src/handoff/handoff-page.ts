import { AppError } from '../common/app-error';
import type { BookingOption } from '../flights/flights.mapper';

export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SYMBOL: Record<string, string> = { USD: '$', ILS: '₪', EUR: '€', GBP: '£' };
const money = (amount: number, currency: string) => `${SYMBOL[currency] ?? `${currency} `}${amount.toLocaleString('en-US')}`;

const STYLE = `body{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:24px;color:#12202F;background:#fff}
main{max-width:480px;margin:0 auto}h1{font-size:20px;color:#0B6BCB}p{color:#5B6B7B}
form{margin:12px 0}button{width:100%;text-align:left;padding:14px 16px;border:1px solid #D8DFE6;border-radius:12px;background:#fff;font-size:16px;cursor:pointer}
button b{float:right;color:#084C91}.note{font-size:12px}`;

const httpsOrigin = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('PROVIDER_DOWN', 'Provider returned an invalid link');
  }
  if (parsed.protocol !== 'https:') throw new AppError('PROVIDER_DOWN', 'Provider returned an insecure link');
  return parsed.origin;
};

const formFor = (o: BookingOption, id?: string): string => {
  const fields = Object.entries(o.request.fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('');
  return `<form${id ? ` id="${id}"` : ''} method="post" action="${escapeHtml(o.request.url)}">${fields}`;
};

const baseCsp = (formAction: string, script?: string) =>
  ["default-src 'none'", "style-src 'unsafe-inline'", script ? `script-src 'nonce-${script}'` : '', `form-action ${formAction}`, "base-uri 'none'"]
    .filter(Boolean)
    .join('; ');

const shell = (body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Wayfinder</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;

export type RenderedPage = { html: string; csp: string };

/** One provider: auto-submit its POST. Several: let the user choose. `provider` is what gets logged. */
export const renderHandoffPage = (
  options: BookingOption[],
  nonce: string,
  currency: string,
): RenderedPage & { provider: string } => {
  const origins = [...new Set(options.map((o) => httpsOrigin(o.request.url)))];
  const formAction = origins.join(' ');

  if (options.length === 1) {
    const o = options[0]!;
    const html = shell(
      `<h1>Taking you to ${escapeHtml(o.provider)}</h1><p>You will complete your booking on their website. Wayfinder does not process payments.</p>` +
        `${formFor(o, 'go')}<noscript><button type="submit">Continue to ${escapeHtml(o.provider)}</button></noscript></form>` +
        `<script nonce="${nonce}">document.getElementById('go').submit()</script>`,
    );
    return { html, csp: baseCsp(formAction, nonce), provider: o.provider };
  }

  const rows = options
    .map(
      (o) =>
        `${formFor(o)}<button type="submit">${escapeHtml(o.provider)}${o.isAirline ? ' (airline)' : ''}<b>${escapeHtml(money(o.price, currency))}</b></button></form>`,
    )
    .join('');
  const html = shell(
    `<h1>Choose where to book</h1><p>Prices are indicative. You will complete your booking on the provider's website; Wayfinder does not process payments.</p>${rows}`,
  );
  return { html, csp: baseCsp(formAction), provider: 'multiple' };
};

export const renderErrorPage = (message: string): RenderedPage => ({
  html: shell(`<h1>We could not open that booking page</h1><p>${escapeHtml(message)}</p>`),
  csp: baseCsp("'none'"),
});
