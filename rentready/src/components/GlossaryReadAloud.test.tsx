import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Glossary } from './Glossary';
import { ReadAloud } from './ReadAloud';
import { ui } from '../i18n/en';
import { expectNoAxeViolations } from '../../tests/axe';

describe('Glossary', () => {
  it('opens and closes definitions with real buttons (not hover), including Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<Glossary />);
    const term = screen.getByRole('button', { name: ui.glossaryLockIn });
    expect(term).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(ui['glossary.lockIn'])).not.toBeVisible();

    await user.click(term);
    expect(term).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(ui['glossary.lockIn'])).toBeVisible();
    await expectNoAxeViolations(container);

    await user.keyboard('{Escape}');
    expect(term).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });
});

describe('ReadAloud', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing where speech synthesis is unsupported', () => {
    const { container } = render(<ReadAloud text="Hello" what="x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('plays with an Indian English voice, pauses, resumes and stops', async () => {
    const speak = vi.fn();
    const speech = {
      speak,
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      getVoices: () => [{ lang: 'en-IN', name: 'India' }],
    };
    vi.stubGlobal('speechSynthesis', speech);
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = '';
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      }
    );
    const user = userEvent.setup();
    render(<ReadAloud text="Your deposit is high." what="Deposit" />);
    expect(screen.getByRole('group', { name: 'Read aloud: Deposit' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: ui.readAloudPlay }));
    const utterance = speak.mock.calls[0]![0] as { text: string; lang: string; voice: unknown };
    expect(utterance).toMatchObject({ text: 'Your deposit is high.', lang: 'en-IN' });
    expect(utterance.voice).toEqual({ lang: 'en-IN', name: 'India' });

    await user.click(screen.getByRole('button', { name: ui.readAloudPause }));
    expect(speech.pause).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: ui.readAloudPlay }));
    expect(speech.resume).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: ui.readAloudStop }));
    expect(speech.cancel).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: ui.readAloudStop })).toBeNull();
  });
});
