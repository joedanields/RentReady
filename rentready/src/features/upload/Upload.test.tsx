import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from '../../state/AppProvider';
import { Upload } from './Upload';
import { ui } from '../../i18n/en';
import { expectNoAxeViolations } from '../../../tests/axe';

function DemoFlag() {
  const { state } = useApp();
  return <span data-testid="demo-flag">{String(state.demo)}</span>;
}

function setup() {
  const user = userEvent.setup();
  const utils = render(
    <AppProvider>
      <Upload onAnalysed={vi.fn()} />
      <DemoFlag />
    </AppProvider>
  );
  const fileInput = () => screen.getByTestId('file-input') as HTMLInputElement;
  return { user, fileInput, ...utils };
}

afterEach(() => sessionStorage.clear());

const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

describe('Upload', () => {
  it('offers upload, paste and the sample, and says files stay in the browser', async () => {
    const { container } = setup();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(ui.addAgreement);
    expect(screen.getByText(ui.uploadIntro)).toBeInTheDocument();
    for (const name of [ui.uploadFile, ui.pasteText, ui.useSample]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: ui.uploadFile })).toHaveAccessibleDescription(
      ui.uploadAccepts
    );
    await expectNoAxeViolations(container);
  });

  it('loads the sample, confirms what was read, and turns on demo mode', async () => {
    const { user, container } = setup();
    await user.click(screen.getByRole('button', { name: ui.useSample }));
    expect(screen.getByRole('status')).toHaveTextContent('Read 14 clauses across 2 pages.');
    expect(screen.getByText(ui.demoSampleBadge)).toBeInTheDocument();
    expect(screen.getByTestId('demo-flag')).toHaveTextContent('true');
    expect(screen.getByRole('button', { name: ui.checkAgreement })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('opens the paste panel, focuses it, and reads pasted text', async () => {
    const { user } = setup();
    const toggle = screen.getByRole('button', { name: ui.pasteText });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const box = screen.getByRole('textbox', { name: ui.pastePanelLabel });
    expect(box).toHaveFocus();
    expect(screen.getByRole('button', { name: ui.readThisText })).toBeDisabled();
    await user.type(
      box,
      '1. The monthly rent is forty thousand rupees.{Enter}2. The deposit is two months.'
    );
    await user.click(screen.getByRole('button', { name: ui.readThisText }));
    expect(screen.getByRole('status')).toHaveTextContent('Read 2 clauses.');
    expect(screen.getByRole('heading', { name: ui.pastedDocName })).toBeInTheDocument();
  });

  it('refuses an .exe renamed .pdf with a fixable message', async () => {
    const { user, fileInput } = setup();
    await user.upload(fileInput(), new File([EXE], 'lease.pdf', { type: 'application/pdf' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(ui['intake.INVALID_FILE']);
    await user.click(screen.getByRole('button', { name: ui.pasteInstead }));
    expect(screen.getByRole('textbox', { name: ui.pastePanelLabel })).toHaveFocus();
  });

  it('says how big an oversized file is', async () => {
    const { user, fileInput } = setup();
    const big = new File(['x'], 'lease.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 14 * 1024 * 1024 });
    await user.upload(fileInput(), big);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That file is 14 MB. Please use a file under 10 MB, or paste the text instead.'
    );
  });

  it('lets the user switch to a different agreement', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: ui.useSample }));
    await user.click(screen.getByRole('button', { name: ui.useDifferentAgreement }));
    expect(screen.getByRole('button', { name: ui.uploadFile })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ui.checkAgreement })).toBeNull();
  });

  it('shows the key panel for a real document when there is no key and no demo', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: ui.pasteText }));
    await user.type(
      screen.getByRole('textbox', { name: ui.pastePanelLabel }),
      '1. The monthly rent is forty thousand rupees, payable in advance.'
    );
    await user.click(screen.getByRole('button', { name: ui.readThisText }));
    expect(screen.getByRole('region', { name: ui.keyManagement })).toBeInTheDocument();
  });
});
