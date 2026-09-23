/** Move-in kit — checklist, photo guide, meter readings, timeline */

import type {
  MoveInKit,
  MoveInChecklistItem,
  TimelineEvent,
  MatchRow,
  NormalisedAnswers,
} from '../types.js';

export const ROOMS = [
  'Living Room',
  'Bedroom 1',
  'Bedroom 2',
  'Bedroom 3',
  'Kitchen',
  'Bathroom 1',
  'Bathroom 2',
  'Balcony',
  'Common Areas',
] as const;

export const CHECKLIST_TEMPLATE: Omit<MoveInChecklistItem, 'id' | 'completed'>[] = [
  // Living Room
  { room: 'Living Room', description: 'Walls — cracks, damp, paint condition' },
  { room: 'Living Room', description: 'Ceiling — stains, cracks, fan/light fittings' },
  { room: 'Living Room', description: 'Floor — tiles/wood condition, scratches, stains' },
  { room: 'Living Room', description: 'Windows — glass, frames, locks, curtains/blinds' },
  { room: 'Living Room', description: 'Doors — frame, lock, hinges, handle' },
  { room: 'Living Room', description: 'Electrical — sockets, switches, TV/Internet points' },

  // Bedrooms (template repeated per bedroom)
  { room: 'Bedroom', description: 'Walls — cracks, damp, paint condition' },
  { room: 'Bedroom', description: 'Ceiling — stains, cracks, fan/light fittings' },
  { room: 'Bedroom', description: 'Floor — tiles/wood condition, scratches, stains' },
  { room: 'Bedroom', description: 'Windows — glass, frames, locks, curtains/blinds' },
  { room: 'Bedroom', description: 'Doors — frame, lock, hinges, handle' },
  { room: 'Bedroom', description: 'Built-in wardrobes — doors, shelves, hinges' },
  { room: 'Bedroom', description: 'Electrical — sockets, switches, AC point' },

  // Kitchen
  { room: 'Kitchen', description: 'Walls — tiles, paint, damp near sink' },
  { room: 'Kitchen', description: 'Ceiling — exhaust fan, light' },
  { room: 'Kitchen', description: 'Floor — tiles, stains, drainage' },
  { room: 'Kitchen', description: 'Countertop — scratches, burns, joints' },
  { room: 'Kitchen', description: 'Cabinets — doors, hinges, shelves' },
  { room: 'Kitchen', description: 'Sink — tap, drainage, leaks' },
  { room: 'Kitchen', description: 'Gas pipeline — connection, valve, leak test' },
  { room: 'Kitchen', description: 'Electrical — sockets, switches, appliance points' },

  // Bathrooms
  { room: 'Bathroom', description: 'Walls — tiles, grout, damp' },
  { room: 'Bathroom', description: 'Ceiling — exhaust fan, light' },
  { room: 'Bathroom', description: 'Floor — tiles, drainage, slope' },
  { room: 'Bathroom', description: 'Toilet — flush, seat, leaks' },
  { room: 'Bathroom', description: 'Sink — tap, drainage, cabinet' },
  { room: 'Bathroom', description: 'Shower area — drain, glass partition, taps' },
  { room: 'Bathroom', description: 'Geyser — working, temperature, leaks' },

  // Balcony
  { room: 'Balcony', description: 'Floor — tiles, drainage' },
  { room: 'Balcony', description: 'Railing — stability, rust' },
  { room: 'Balcony', description: 'Clothesline / drying area' },

  // Common Areas
  { room: 'Common Areas', description: 'Main door — lock, hinges, peephole' },
  { room: 'Common Areas', description: 'Lobby / corridor access' },
  { room: 'Common Areas', description: 'Meter box — electricity, water, gas access' },
];

export const PHOTO_GUIDE = [
  'Take wide shots of each room first (all 4 corners)',
  'Then close-ups of any damage: cracks, stains, scratches, broken fittings',
  'Enable date-stamp / timestamp on camera',
  'Photograph all meter readings clearly (electricity, water, gas)',
  'Photo of gas pipeline connection and valve',
  'Photo of all keys and access cards received',
  'Video walkthrough (30-60s) with narration of issues',
  'Save to cloud immediately (Google Photos, iCloud, etc.)',
];

export const METER_TYPES = [
  { id: 'electricity', label: 'Electricity Meter', unit: 'kWh' },
  { id: 'water', label: 'Water Meter', unit: 'kl' },
  { id: 'gas', label: 'Gas Meter', unit: 'm³' },
] as const;

/** Build the full move-in kit */
export function buildMoveInKit(interview: NormalisedAnswers, matches: MatchRow[]): MoveInKit {
  const checklist = buildChecklist();
  const timeline = buildTimeline(interview, matches);

  return {
    checklist,
    meterReadings: {
      electricity: '',
      water: '',
      gas: '',
    },
    timeline,
  };
}

function buildChecklist(): MoveInChecklistItem[] {
  const items: MoveInChecklistItem[] = [];
  let id = 0;

  // Add living room items
  for (const item of CHECKLIST_TEMPLATE.filter(i => i.room === 'Living Room')) {
    items.push({ ...item, id: `chk-${++id}`, completed: false });
  }

  // Bedrooms - detect count from context or default to 2
  const bedroomCount = 2; // Could be inferred from interview
  for (let b = 1; b <= bedroomCount; b++) {
    for (const item of CHECKLIST_TEMPLATE.filter(i => i.room === 'Bedroom')) {
      items.push({
        ...item,
        room: `Bedroom ${b}`,
        id: `chk-${++id}`,
        completed: false,
      });
    }
  }

  // Kitchen
  for (const item of CHECKLIST_TEMPLATE.filter(i => i.room === 'Kitchen')) {
    items.push({ ...item, id: `chk-${++id}`, completed: false });
  }

  // Bathrooms - default 2
  for (let b = 1; b <= 2; b++) {
    for (const item of CHECKLIST_TEMPLATE.filter(i => i.room === 'Bathroom')) {
      items.push({
        ...item,
        room: `Bathroom ${b}`,
        id: `chk-${++id}`,
        completed: false,
      });
    }
  }

  // Balcony
  for (const item of CHECKLIST_TEMPLATE.filter(i => i.room === 'Balcony')) {
    items.push({ ...item, id: `chk-${++id}`, completed: false });
  }

  // Common Areas
  for (const item of CHECKLIST_TEMPLATE.filter(i => i.room === 'Common Areas')) {
    items.push({ ...item, id: `chk-${++id}`, completed: false });
  }

  return items;
}

function buildTimeline(interview: NormalisedAnswers, matches: MatchRow[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let id = 0;

  // Find notice period from agreement
  let noticeDays = 30; // default
  const noticeMatch = matches.find(m => m.key === 'noticePeriod' && m.written);
  if (noticeMatch?.written) {
    noticeDays = parseNoticeFromText(noticeMatch.written) ?? 30;
  } else if (interview.noticePeriod) {
    noticeDays = interview.noticePeriod;
  }

  // Find agreement end date
  const durationDays = interview.duration ?? 330; // default 11 months
  const startDate = new Date(); // Today as proxy for move-in

  // Move-in today
  events.push({
    id: `tl-${++id}`,
    label: 'Move-in / Handover',
    date: startDate.toISOString().split('T')[0]!,
    description:
      'Complete inspection checklist, take meter readings, photograph everything, sign inventory.',
  });

  // Notice deadline (if planning to leave at term end)
  const noticeDate = new Date(startDate);
  noticeDate.setDate(noticeDate.getDate() + durationDays - noticeDays);
  events.push({
    id: `tl-${++id}`,
    label: 'Notice deadline (if leaving at term end)',
    date: noticeDate.toISOString().split('T')[0]!,
    description: `Give written notice by this date to leave when the agreement expires (${noticeDays}-day notice).`,
  });

  // Renewal reminder (30 days before expiry)
  const renewalDate = new Date(startDate);
  renewalDate.setDate(renewalDate.getDate() + durationDays - 30);
  events.push({
    id: `tl-${++id}`,
    label: 'Renewal discussion reminder',
    date: renewalDate.toISOString().split('T')[0]!,
    description: 'Start discussing renewal or exit with the owner (30 days before expiry).',
  });

  // Agreement expiry
  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + durationDays);
  events.push({
    id: `tl-${++id}`,
    label: 'Agreement expires',
    date: expiryDate.toISOString().split('T')[0]!,
    description: 'Term ends. Deposit should be refunded within agreed timeline (ideally 15 days).',
  });

  // Deposit refund deadline (15 days after handover)
  const refundDate = new Date(expiryDate);
  refundDate.setDate(refundDate.getDate() + 15);
  events.push({
    id: `tl-${++id}`,
    label: 'Deposit refund deadline (target)',
    date: refundDate.toISOString().split('T')[0]!,
    description: 'Deposit should be refunded by now. Follow up if not received.',
  });

  return events;
}

function parseNoticeFromText(text: string): number | null {
  const cleaned = text.trim().toLowerCase();
  if (cleaned === '15 days') return 15;
  if (cleaned === '1 month') return 30;
  if (cleaned === '2 months') return 60;
  const dayMatch = cleaned.match(/(\d+)\s*days?/);
  if (dayMatch) return parseInt(dayMatch[1]!, 10);
  const monthMatch = cleaned.match(/(\d+)\s*months?/);
  if (monthMatch) return parseInt(monthMatch[1]!, 10) * 30;
  return null;
}

/** Export move-in kit as Markdown */
export function exportMoveInKitAsMarkdown(kit: MoveInKit, interview: NormalisedAnswers): string {
  const lines: string[] = [];

  lines.push('# Move-In Kit');
  lines.push('');
  lines.push(`**Property:** ${interview.city ?? 'Not specified'}`);
  lines.push(
    `**Monthly Rent:** ${interview.monthlyRent ? `₹${interview.monthlyRent.toLocaleString('en-IN')}` : 'Not specified'}`
  );
  lines.push(
    `**Deposit:** ${interview.deposit?.amount ? `₹${interview.deposit.amount.toLocaleString('en-IN')}` : 'Not specified'}`
  );
  lines.push('');

  lines.push('## Inspection Checklist');
  lines.push('');
  let currentRoom = '';
  for (const item of kit.checklist) {
    if (item.room !== currentRoom) {
      currentRoom = item.room;
      lines.push(`### ${currentRoom}`);
      lines.push('');
    }
    lines.push(`- [${item.completed ? 'x' : ' '}] ${item.description}`);
  }
  lines.push('');

  lines.push('## Meter Readings');
  lines.push('');
  for (const meter of METER_TYPES) {
    lines.push(
      `- **${meter.label}:** ${kit.meterReadings[meter.id] || 'Not recorded'} ${meter.unit}`
    );
  }
  lines.push('');

  lines.push('## Timeline');
  lines.push('');
  for (const event of kit.timeline) {
    lines.push(`- **${event.date ?? 'TBD'}** — ${event.label}: ${event.description}`);
  }
  lines.push('');

  lines.push('## Photo Guide');
  lines.push('');
  for (const tip of PHOTO_GUIDE) {
    lines.push(`- ${tip}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('*Generated by RentReady — Information, not legal advice.*');

  return lines.join('\n');
}
