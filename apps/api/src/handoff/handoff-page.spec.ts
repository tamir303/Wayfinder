import type { BookingOption } from '../flights/flights.mapper';
import { escapeHtml, renderErrorPage, renderHandoffPage } from './handoff-page';

const option = (over: Partial<BookingOption> = {}): BookingOption => ({
  provider: 'El Al',
  price: 226,
  isAirline: true,
  baggage: ['1 free carry-on'],
  request: { url: 'https://www.google.com/travel/clk/f', fields: { u: 'AAcRjHL_token-123' } },
  ...over,
});

describe('escapeHtml', () => {
  it('escapes the characters that matter in text and attributes', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
  });
});

describe('renderHandoffPage', () => {
  it('auto-submits a POST form for a single provider', () => {
    const { html, csp, provider } = renderHandoffPage([option()], 'NONCE123', 'USD');
    expect(provider).toBe('El Al');
    expect(html).toContain('<form id="go" method="post" action="https://www.google.com/travel/clk/f">');
    expect(html).toContain('<input type="hidden" name="u" value="AAcRjHL_token-123">');
    expect(html).toContain('<script nonce="NONCE123">');
    expect(html).toContain('<noscript>');
    expect(csp).toContain("script-src 'nonce-NONCE123'");
    expect(csp).toContain('form-action https://www.google.com');
    expect(csp).toContain("default-src 'none'");
  });

  it('shows a chooser with one form per provider and no script when there are several', () => {
    const { html, csp, provider } = renderHandoffPage(
      [option(), option({ provider: 'Air France', price: 461, isAirline: false, request: { url: 'https://agency.example/book', fields: { a: '1' } } })],
      'N',
      'USD',
    );
    expect(provider).toBe('multiple');
    expect(html.match(/<form /g)).toHaveLength(2);
    expect(html).toContain('El Al');
    expect(html).toContain('$226');
    expect(html).toContain('Air France');
    expect(html).not.toContain('<script');
    expect(csp).toContain('https://www.google.com');
    expect(csp).toContain('https://agency.example');
    expect(csp).not.toContain('script-src');
  });

  it('escapes provider names, urls and fields coming from the provider', () => {
    const { html } = renderHandoffPage(
      [option({ provider: '<img src=x onerror=alert(1)>', request: { url: 'https://p.example/a?b="c"', fields: { 'n"ame': 'v"><x>' } } })],
      'N',
      'USD',
    );
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('"><x>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('refuses non-https provider urls', () => {
    expect(() => renderHandoffPage([option({ request: { url: 'http://insecure.example', fields: {} } })], 'N', 'USD')).toThrow(
      expect.objectContaining({ code: 'PROVIDER_DOWN' }),
    );
    expect(() => renderHandoffPage([option({ request: { url: 'javascript:alert(1)', fields: {} } })], 'N', 'USD')).toThrow(
      expect.objectContaining({ code: 'PROVIDER_DOWN' }),
    );
  });
});

describe('renderErrorPage', () => {
  it('renders an escaped message with a locked-down CSP', () => {
    const { html, csp } = renderErrorPage('Invalid <b>link</b>');
    expect(html).toContain('Invalid &lt;b&gt;link&lt;/b&gt;');
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('script-src');
  });
});
