import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../../state/AppProvider';
import { KeyPanel, ForgetKeyButton, maskKey } from './KeyPanel';
import { API_KEY_KEY } from '../../state/storage';
import { ui } from '../../i18n/en';
import { fakeKey } from '../../../tests/fakeKey';
import { expectNoAxeViolations } from '../../../tests/axe';

const KEY = fakeKey();

function setup(onUseSample?: () => void) {
  const user = userEvent.setup();
  const utils = render(
    <AppProvider>
      <ForgetKeyButton />
      <KeyPanel {...(onUseSample ? { onUseSample } : {})} />
    </AppProvider>
  );
  return { user, ...utils };
}

async function enterKey(user: ReturnType<typeof userEvent.setup>, value = KEY) {
  await user.type(screen.getByLabelText(ui.keyFieldLabel), value);
  await user.click(screen.getByRole('button', { name: ui.keySave }));
}

afterEach(() => sessionStorage.clear());

describe('KeyPanel', () => {
  it('has a real, labelled password field and no axe violations', async () => {
    const { container } = setup();
    const field = screen.getByLabelText(ui.keyFieldLabel);
    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'off');
    await expectNoAxeViolations(container);
  });

  it('rejects something that is not a Gemini key, with a linked error', async () => {
    const { user } = setup();
    await enterKey(user, 'not-a-key');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(ui.keyInvalid);
    expect(screen.getByLabelText(ui.keyFieldLabel)).toHaveAttribute('aria-invalid', 'true');
  });

  it('masks the key once set; the full key is not in the page text until Show', async () => {
    const { user } = setup();
    await enterKey(user);
    expect(screen.getByTestId('key-status')).toHaveTextContent(maskKey(KEY));
    expect(document.body.textContent).not.toContain(KEY);
    await user.click(screen.getByRole('button', { name: ui.showKey }));
    expect(document.body.textContent).toContain(KEY);
    await user.click(screen.getByRole('button', { name: ui.hideKey }));
    expect(document.body.textContent).not.toContain(KEY);
  });

  it('keeps the key in memory only, unless "Remember for this tab" is ticked', async () => {
    const { user } = setup();
    await enterKey(user);
    expect(sessionStorage.getItem(API_KEY_KEY)).toBeNull();
    expect(localStorage.length).toBeLessThanOrEqual(1); // preferences only
    expect(JSON.stringify({ ...localStorage })).not.toContain(KEY);

    await user.click(screen.getByRole('checkbox', { name: ui.rememberKey }));
    expect(sessionStorage.getItem(API_KEY_KEY)).toBe(KEY);
    await user.click(screen.getByRole('checkbox', { name: ui.rememberKey }));
    expect(sessionStorage.getItem(API_KEY_KEY)).toBeNull();
  });

  it('"Forget key" in the header clears memory and tab storage', async () => {
    const { user } = setup();
    await enterKey(user);
    await user.click(screen.getByRole('checkbox', { name: ui.rememberKey }));
    const [headerForget] = screen.getAllByRole('button', { name: ui.forgetKey });
    await user.click(headerForget!);
    expect(screen.queryByTestId('key-status')).toBeNull();
    expect(sessionStorage.getItem(API_KEY_KEY)).toBeNull();
    expect(document.body.textContent).not.toContain(KEY);
  });

  it('offers the sample as a way out when there is no key', async () => {
    const onUseSample = vi.fn();
    const { user } = setup(onUseSample);
    await user.click(screen.getByRole('button', { name: ui.keyUseSample }));
    expect(onUseSample).toHaveBeenCalledOnce();
  });
});
