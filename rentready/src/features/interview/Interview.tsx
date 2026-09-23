/** Interview screens — one question per step, skippable, keyboard navigable, live money echo */

import { useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { INTERVIEW_QUESTIONS } from '../../core/interview/questions';
import { parseMoney, formatMoney } from '../../core/interview/normalise';
import { Progress } from '../../components/Progress';
import { Button } from '../../components/Button';

export function Interview({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState(state.interview.currentStep);
  const [textValue, setTextValue] = useState('');
  const [customExtra, setCustomExtra] = useState('');

  const total = INTERVIEW_QUESTIONS.length;
  const question = INTERVIEW_QUESTIONS[step];
  if (!question) return null;

  const currentAnswer = state.interview.answers[question.key];
  const currentExtras = state.interview.answers.extras ?? [];

  const advance = () => {
    dispatch({ type: 'SET_INTERVIEW_STEP', step });
    if (step < total - 1) {
      setStep(step + 1);
      setTextValue('');
    } else {
      dispatch({ type: 'SET_INTERVIEW_COMPLETED', completed: true });
      onDone();
    }
  };

  const handleSelect = (v: string) => {
    dispatch({ type: 'SET_INTERVIEW_ANSWER', key: question.key, value: v });
    advance();
  };

  const handleMulti = (v: string) => {
    const next = currentExtras.includes(v)
      ? currentExtras.filter(x => x !== v)
      : [...currentExtras, v];
    dispatch({ type: 'SET_INTERVIEW_ANSWER', key: 'extras', value: next });
  };

  const moneyEcho =
    question.type === 'money' && textValue.trim() ? parseMoney(textValue) : null;
  const moneyText =
    (question.type === 'money' || question.type === 'text') &&
    typeof currentAnswer === 'string' &&
    currentAnswer
      ? currentAnswer
      : textValue;

  return (
    <section aria-label="Interview" className="flex flex-col gap-4 pt-2">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{t('progress', { current: step + 1, total })}</span>
      </div>
      <Progress current={step + 1} total={total} />

      <form
        onSubmit={e => {
          e.preventDefault();
          if (question.type === 'select' || question.type === 'multiselect') return;
          if ((question.type === 'text' || question.type === 'money') && textValue.trim()) {
            dispatch({ type: 'SET_INTERVIEW_ANSWER', key: question.key, value: textValue.trim() });
          }
          advance();
        }}
        className="rounded-xl border border-border p-6"
      >
        <legend className="mb-1 block text-lg font-medium">{question.label}</legend>
        <p className="mb-4 text-sm text-muted">{question.hint}</p>

        {question.type === 'select' && question.options && (
          <div role="radiogroup" aria-label={question.label} className="flex flex-col gap-2">
            {question.options.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={currentAnswer === opt.value}
                onClick={() => handleSelect(opt.value)}
                className="min-h-[44px] w-full rounded-lg border border-border px-4 text-left hover:border-primary"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {question.type === 'multiselect' && question.chips && (
          <div className="flex flex-col gap-3">
            <div role="group" aria-label={question.label} className="flex flex-wrap gap-2">
              {question.chips.map(chip => (
                <button
                  key={chip}
                  type="button"
                  role="checkbox"
                  aria-checked={currentExtras.includes(chip)}
                  onClick={() => handleMulti(chip)}
                  className={`min-h-[44px] rounded-full border px-4 text-sm ${
                    currentExtras.includes(chip)
                      ? 'border-primary bg-primary text-white'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <label htmlFor="extra-custom" className="sr-only">
                Add your own promise
              </label>
              <input
                id="extra-custom"
                type="text"
                value={customExtra}
                onChange={e => setCustomExtra(e.target.value)}
                placeholder={question.placeholder}
                className="min-h-[44px] flex-1 rounded-lg border border-border px-3"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (customExtra.trim()) {
                    dispatch({
                      type: 'SET_INTERVIEW_ANSWER',
                      key: 'extras',
                      value: [...currentExtras, customExtra.trim()]
                    });
                    setCustomExtra('');
                  }
                }}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        )}

        {(question.type === 'text' || question.type === 'money') && (
          <div className="flex flex-col gap-3">
            <label htmlFor={`interview-${question.key}`} className="sr-only">
              {question.label}
            </label>
            <input
              id={`interview-${question.key}`}
              type="text"
              inputMode={question.type === 'money' ? 'numeric' : 'text'}
              value={moneyText}
              onChange={e => setTextValue(e.target.value)}
              placeholder={question.placeholder}
              className="min-h-[44px] w-full rounded-lg border border-border px-3"
            />
            {moneyEcho !== null && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
                {formatMoney(moneyEcho)}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            {t('back')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={advance}>
              {t('skip')}
            </Button>
            {(question.type === 'text' || question.type === 'money') && (
              <Button type="submit">{t('next')}</Button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}