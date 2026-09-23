/**
 * Interview — one question per screen, every question skippable, real form controls, and a
 * summary with per-answer edit. Stored values are the strings core/interview/normalise.ts parses.
 */

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { INTERVIEW_QUESTIONS, type InterviewQuestion } from '../../core/interview/questions';
import type { InterviewAnswers } from '../../core/types';
import { Progress } from '../../components/Progress';
import { Button } from '../../components/Button';
import {
  FOLLOW_UPS,
  NO_PROMISE_VALUES,
  chipLabel,
  displayAnswer,
  moneyEcho,
  optionLabel,
  parseTextAnswer,
  questionHint,
  questionLabel,
  questionPlaceholder,
  selectedOption,
  type AnswerKey,
} from './answerText';

const TOTAL = INTERVIEW_QUESTIONS.length;
const SUMMARY_STEP = TOTAL;

type AnswerValue = string | string[] | null;

export function Interview({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState(() =>
    state.interview.completed ? SUMMARY_STEP : Math.min(state.interview.currentStep, TOTAL - 1)
  );
  // When editing one answer from the summary, Next/Back return to the summary.
  const [editing, setEditing] = useState(false);

  const goTo = (next: number) => {
    setStep(next);
    dispatch({ type: 'SET_INTERVIEW_STEP', step: next });
    if (next === SUMMARY_STEP) dispatch({ type: 'SET_INTERVIEW_COMPLETED', completed: true });
  };

  const save = (key: AnswerKey, value: AnswerValue) => {
    if (value === null || (Array.isArray(value) && value.length === 0)) {
      dispatch({ type: 'CLEAR_INTERVIEW_ANSWER', key });
    } else {
      dispatch({ type: 'SET_INTERVIEW_ANSWER', key, value });
    }
  };

  const advance = () => {
    if (editing) {
      setEditing(false);
      goTo(SUMMARY_STEP);
    } else {
      goTo(step + 1);
    }
  };

  const back = () => {
    if (editing) {
      setEditing(false);
      goTo(SUMMARY_STEP);
    } else if (step === 0) {
      onBack();
    } else {
      goTo(step - 1);
    }
  };

  if (step >= SUMMARY_STEP) {
    return (
      <InterviewSummary
        answers={state.interview.answers}
        onEdit={index => {
          setEditing(true);
          goTo(index);
        }}
        onBack={() => goTo(TOTAL - 1)}
        onContinue={onDone}
      />
    );
  }

  const question = INTERVIEW_QUESTIONS[step];
  if (!question) return null;

  return (
    <QuestionStep
      key={question.key}
      question={question}
      index={step}
      answers={state.interview.answers}
      editing={editing}
      onAnswer={value => {
        save(question.key, value);
        advance();
      }}
      onSkip={() => {
        save(question.key, null);
        advance();
      }}
      onBack={back}
      {...(step === 0 && !editing
        ? {
            onSkipAll: () => {
              dispatch({ type: 'SET_INTERVIEW_COMPLETED', completed: true });
              onDone();
            },
          }
        : {})}
    />
  );
}

interface QuestionStepProps {
  question: InterviewQuestion;
  index: number;
  answers: InterviewAnswers;
  editing: boolean;
  onAnswer: (value: AnswerValue) => void;
  onSkip: () => void;
  onBack: () => void;
  onSkipAll?: () => void;
}

function QuestionStep({
  question,
  index,
  answers,
  editing,
  onAnswer,
  onSkip,
  onBack,
  onSkipAll,
}: QuestionStepProps) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stored = question.key === 'extras' ? null : answers[question.key];
  const followUp = FOLLOW_UPS[question.key];

  const [text, setText] = useState(
    question.type === 'text' || question.type === 'money' ? (stored ?? '') : ''
  );
  const [choice, setChoice] = useState<string | null>(() => selectedOption(question, stored));
  const [followText, setFollowText] = useState(() =>
    followUp && stored && choice === followUp.trigger && stored !== followUp.trigger
      ? followUp.decompose(stored)
      : ''
  );
  const [extras, setExtras] = useState<string[]>(answers.extras);
  const [custom, setCustom] = useState('');
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errorFieldRef = useRef<HTMLInputElement>(null);

  // Each step is a new screen: move focus to its heading so screen readers announce it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const hintId = `${id}-hint`;
  const echoId = `${id}-echo`;
  const errorId = `${id}-error`;
  const followId = `${id}-follow`;
  const headingId = `${id}-heading`;

  const fail = (message: string) => {
    setError(message);
    // Let the error render before moving focus back to the field that needs fixing.
    queueMicrotask(() => errorFieldRef.current?.focus());
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (question.type === 'multiselect') {
      onAnswer(extras);
      return;
    }
    if (question.type === 'select') {
      if (choice === null || NO_PROMISE_VALUES.has(choice)) return onAnswer(null);
      if (followUp && choice === followUp.trigger) {
        const composed = followUp.compose(followText);
        return composed === null ? fail(t(followUp.error)) : onAnswer(composed);
      }
      return onAnswer(choice);
    }
    const parsed = parseTextAnswer(question.key, text);
    if (parsed === null) return onAnswer(null);
    return parsed.ok ? onAnswer(parsed.value) : fail(t(parsed.error));
  };

  // Number keys pick an option (INTERVIEW_SPEC keyboard details); arrows work natively.
  const onOptionKeys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!question.options) return;
    const n = Number(e.key);
    const opt = Number.isInteger(n) && n >= 1 ? question.options[n - 1] : undefined;
    if (!opt) return;
    e.preventDefault();
    setChoice(opt.value);
    setError(null);
    document.getElementById(`${id}-opt-${opt.value}`)?.focus();
  };

  const addCustom = () => {
    const item = custom.trim();
    if (!item) return;
    if (!extras.includes(item)) setExtras([...extras, item]);
    setCustom('');
    setAnnounce(t('extrasAdded', { item }));
  };

  const label = questionLabel(question);
  const hint = questionHint(question);
  const heading = (
    <h1
      id={headingId}
      ref={headingRef}
      tabIndex={-1}
      className="text-2xl font-semibold leading-snug focus:outline-none"
    >
      {label}
    </h1>
  );
  const describedBy = (...ids: Array<string | false>) => ids.filter(Boolean).join(' ') || undefined;
  const echo =
    question.type === 'money' ? moneyEcho(question.key, text, answers.monthlyRent) : null;
  const inputClass =
    'min-h-[44px] w-full rounded-lg border border-border bg-surface px-3 aria-[invalid=true]:border-differs';

  return (
    <section aria-label={t('interviewNav')} className="flex flex-col gap-4 pt-2">
      <p className="text-sm text-muted">{t('progress', { current: index + 1, total: TOTAL })}</p>
      <Progress
        current={index + 1}
        total={TOTAL}
        label={t('progress', { current: index + 1, total: TOTAL })}
      />

      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:p-6"
      >
        {question.type === 'text' || question.type === 'money' ? (
          <>
            {heading}
            <p id={hintId} className="text-sm text-muted">
              {hint}
            </p>
            <input
              id={`${id}-input`}
              ref={errorFieldRef}
              type="text"
              inputMode={question.type === 'money' ? 'decimal' : 'text'}
              autoComplete={question.key === 'city' ? 'address-level2' : 'off'}
              aria-labelledby={headingId}
              aria-describedby={describedBy(
                hintId,
                question.type === 'money' && echoId,
                !!error && errorId
              )}
              aria-invalid={error ? true : undefined}
              value={text}
              placeholder={questionPlaceholder(question)}
              onChange={e => {
                setText(e.target.value);
                setError(null);
              }}
              className={inputClass}
            />
            {question.type === 'money' && (
              <p
                id={echoId}
                aria-live="polite"
                className={
                  echo ? 'rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900' : 'sr-only'
                }
              >
                {echo}
              </p>
            )}
          </>
        ) : (
          <fieldset aria-describedby={describedBy(hintId)} className="flex min-w-0 flex-col gap-3">
            <legend className="mb-1">{heading}</legend>
            <p id={hintId} className="text-sm text-muted">
              {hint}
            </p>

            {question.type === 'select' &&
              question.options?.map((opt, i) => (
                <label
                  key={opt.value}
                  htmlFor={`${id}-opt-${opt.value}`}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-2 has-[:checked]:border-primary has-[:checked]:bg-green-50"
                >
                  <input
                    id={`${id}-opt-${opt.value}`}
                    type="radio"
                    name={`${id}-choice`}
                    value={opt.value}
                    checked={choice === opt.value}
                    onKeyDown={onOptionKeys}
                    onChange={() => {
                      setChoice(opt.value);
                      setError(null);
                    }}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="flex-1">{optionLabel(question, opt.value)}</span>
                  <span aria-hidden="true" className="text-xs text-muted">
                    {i + 1}
                  </span>
                </label>
              ))}

            {question.type === 'multiselect' && (
              <>
                <div className="flex flex-wrap gap-2">
                  {[
                    ...(question.chips ?? []),
                    ...extras.filter(x => !question.chips?.includes(x)),
                  ].map(chip => (
                    <label
                      key={chip}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-border px-4 has-[:checked]:border-primary has-[:checked]:bg-green-50"
                    >
                      <input
                        type="checkbox"
                        checked={extras.includes(chip)}
                        onChange={() =>
                          setExtras(
                            extras.includes(chip)
                              ? extras.filter(x => x !== chip)
                              : [...extras, chip]
                          )
                        }
                        className="h-5 w-5 accent-primary"
                      />
                      <span>{chipLabel(chip)}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor={`${id}-custom`} className="text-sm font-medium">
                    {t('extrasCustomLabel')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`${id}-custom`}
                      type="text"
                      value={custom}
                      placeholder={t('extrasCustomPlaceholder')}
                      onChange={e => setCustom(e.target.value)}
                      onKeyDown={e => {
                        // Enter adds the item here instead of submitting the whole step.
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustom();
                        }
                      }}
                      className={`${inputClass} flex-1`}
                    />
                    <Button type="button" variant="secondary" onClick={addCustom}>
                      {t('extrasAdd')}
                    </Button>
                  </div>
                  <p aria-live="polite" className="sr-only">
                    {announce}
                  </p>
                </div>
              </>
            )}
          </fieldset>
        )}

        {followUp && choice === followUp.trigger && (
          <div className="flex flex-col gap-2">
            <label htmlFor={followId} className="font-medium">
              {t(followUp.label)}
            </label>
            <input
              id={followId}
              ref={errorFieldRef}
              type="text"
              inputMode={followUp.inputMode}
              aria-describedby={describedBy(!!error && errorId)}
              aria-invalid={error ? true : undefined}
              value={followText}
              placeholder={t(followUp.placeholder)}
              onChange={e => {
                setFollowText(e.target.value);
                setError(null);
              }}
              className={inputClass}
            />
          </div>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-sm font-medium text-differs">
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            {editing ? t('summaryTitle') : t('back')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onSkip}>
              {t('skip')}
            </Button>
            <Button type="submit">{editing ? t('saveAndReturn') : t('next')}</Button>
          </div>
        </div>
      </form>

      {onSkipAll && (
        <Button type="button" variant="ghost" onClick={onSkipAll} className="self-start">
          {t('skipAll')}
        </Button>
      )}
    </section>
  );
}

function InterviewSummary({
  answers,
  onEdit,
  onBack,
  onContinue,
}: {
  answers: InterviewAnswers;
  onEdit: (index: number) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const rows = INTERVIEW_QUESTIONS.map((q, i) => ({ q, i, text: displayAnswer(q, answers) }));
  const allSkipped = rows.every(r => r.text === null);

  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-4 pt-2">
      <h1
        id="summary-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold focus:outline-none"
      >
        {t('summaryTitle')}
      </h1>
      <p className="text-muted">{allSkipped ? t('summaryAllSkipped') : t('summaryIntro')}</p>

      <dl className="divide-y divide-border rounded-xl border border-border">
        {rows.map(({ q, i, text }) => (
          <div key={q.key} className="p-4">
            <dt className="text-sm text-muted">{questionLabel(q)}</dt>
            <dd className="flex flex-wrap items-center justify-between gap-2">
              <span className={text ? 'min-w-0 break-words font-medium' : 'italic text-muted'}>
                {text ?? t('summaryNotAnswered')}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(i)}
                aria-label={t('summaryEditLabel', { question: questionLabel(q) })}
              >
                {t('summaryEdit')}
              </Button>
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('back')}
        </Button>
        <Button type="button" size="lg" onClick={onContinue}>
          {t('addAgreement')}
        </Button>
      </div>
    </section>
  );
}
