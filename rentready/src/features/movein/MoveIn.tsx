/** Move-in kit — inspection checklist, meters, timeline, photo guide, export */

import { useEffect } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { Button } from '../../components/Button';
import {
  buildMoveInKit,
  exportMoveInKitAsMarkdown,
  METER_TYPES,
  PHOTO_GUIDE,
} from '../../core/movein/checklist';
import { normaliseAnswers } from '../../core/interview/normalise';

export function MoveIn({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useApp();
  const analysis = state.analysis.result;

  useEffect(() => {
    if (!state.movein.kit) {
      const kit = buildMoveInKit(
        normaliseAnswers(state.interview.answers),
        analysis?.matches ?? []
      );
      dispatch({ type: 'SET_MOVEIN_KIT', kit });
    }
  }, [state.movein.kit, state.interview.answers, analysis?.matches, dispatch]);

  const kit = state.movein.kit;
  if (!kit) return null;

  const toggle = (id: string) => dispatch({ type: 'TOGGLE_CHECKLIST_ITEM', itemId: id });

  const rooms = [...new Set(kit.checklist.map(i => i.room))];

  const total = kit.checklist.length;
  const done = kit.checklist.filter(i => i.completed).length;

  const download = () => {
    const md = exportMoveInKitAsMarkdown(kit, normaliseAnswers(state.interview.answers));
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rentready-movein-kit.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="movein-title" className="space-y-5 pt-2">
      <div className="flex items-center justify-between gap-3">
        <h1 id="movein-title" className="text-2xl font-semibold">
          {t('moveInKit')}
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={download}>
            {t('downloadMd')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t('back')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="text-sm text-muted">{t('progress', { current: done, total })}</div>
        <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
      </div>

      <section aria-labelledby="checklist-heading">
        <h2 id="checklist-heading" className="mb-2 font-semibold">
          {t('inspectionChecklist')}
        </h2>
        {rooms.map(room => (
          <div key={room} className="mb-3">
            <h3 className="mb-1 text-sm font-medium text-muted">{room}</h3>
            <ul className="space-y-1">
              {kit.checklist
                .filter(i => i.room === room)
                .map(item => (
                  <li key={item.id}>
                    <label className="flex min-h-[44px] items-center gap-3 rounded-lg border border-border px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => toggle(item.id)}
                        className="h-5 w-5"
                      />
                      <span className={item.completed ? 'text-muted line-through' : ''}>
                        {item.description}
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="meters-heading">
        <h2 id="meters-heading" className="mb-2 font-semibold">
          {t('meterReadings')}
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {METER_TYPES.map(meter => (
            <label
              key={meter.id}
              className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm"
            >
              <span className="text-muted">{meter.label}</span>
              <input
                type="text"
                value={kit.meterReadings[meter.id] ?? ''}
                placeholder="0"
                className="min-h-[44px] rounded-lg border border-border px-3"
                onChange={e =>
                  dispatch({
                    type: 'SET_MOVEIN_KIT',
                    kit: {
                      ...kit,
                      meterReadings: { ...kit.meterReadings, [meter.id]: e.target.value },
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="mb-2 font-semibold">
          {t('timeline')}
        </h2>
        <ol className="space-y-2">
          {kit.timeline.map(event => (
            <li key={event.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{event.label}</span>
                {event.date && <span className="text-muted">{event.date}</span>}
              </div>
              <p className="mt-1 text-muted">{event.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="photo-heading">
        <h2 id="photo-heading" className="mb-2 font-semibold">
          {t('photoGuide')}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {PHOTO_GUIDE.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
