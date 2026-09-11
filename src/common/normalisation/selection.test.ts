import { describe, expect, it } from 'vitest';
import { selectAddress, selectEmail, selectPhone } from './selection';
import { address, contact } from '../../testing/factories';

describe('stable destination selection', () => {
  it('selects primary addresses and stable ties, then first/none fallbacks', () => {
    const first = address({ line1: 'First' });

    const second = address({ line1: 'Second', primary: true });

    const third = address({ line1: 'Third', primary: true });

    const input = Object.freeze([first, second, third]);

    expect(selectAddress(input)).toBe(second);
    expect(input).toEqual([first, second, third]);
    expect(selectAddress([first, address()])).toBe(first);
    expect(selectAddress([])).toBeUndefined();
  });

  it('selects only emails, preferring the first primary then the first email', () => {
    const first = contact('email', 'first@example.org');

    const primary = contact('email', 'primary@example.org', true);

    const later = contact('email', 'later@example.org', true);

    const other = contact('other', 'other@example.org', true);

    const input = Object.freeze([other, first, primary, later]);

    expect(selectEmail(input)).toBe(primary);
    expect(input).toEqual([other, first, primary, later]);
    expect(selectEmail([other, first])).toBe(first);
    expect(selectEmail([other])).toBeUndefined();
    expect(selectEmail([])).toBeUndefined();
  });

  it('selects the first primary across mobile/landline, then mobile, then landline', () => {
    const landline = contact('telephone', '+442079001234');

    const mobile = contact('mobile', '+447700900123');

    const primaryLandline = contact('telephone', '+442079005678', true);

    const primaryMobile = contact('mobile', '+447700900456', true);

    const other = contact('other', '123', true);

    const input = Object.freeze([
      other,
      mobile,
      primaryLandline,
      primaryMobile,
    ]);

    expect(selectPhone(input)).toBe(primaryLandline);
    expect(input).toEqual([other, mobile, primaryLandline, primaryMobile]);
    expect(selectPhone([primaryMobile, primaryLandline])).toBe(primaryMobile);
    expect(selectPhone([landline, mobile, contact('mobile', 'later')])).toBe(
      mobile,
    );
    expect(selectPhone([other, landline, contact('telephone', 'later')])).toBe(
      landline,
    );
    expect(
      selectPhone([other, contact('email', 'email@example.org', true)]),
    ).toBeUndefined();
    expect(selectPhone([])).toBeUndefined();
  });
});
