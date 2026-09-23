/** Core domain types — pure TypeScript, no React, no DOM APIs beyond fetch/TextEncoder/crypto */

export type ProtectionId =
  | 'DEPOSIT_AMOUNT'
  | 'DEPOSIT_REFUND_TIMELINE'
  | 'DEPOSIT_DEDUCTION_BASIS'
  | 'RENT_AMOUNT'
  | 'RENT_DUE_DATE'
  | 'RENT_INCREASE'
  | 'MAINTENANCE_CHARGES'
  | 'REPAIRS_MAJOR'
  | 'REPAIRS_MINOR'
  | 'NOTICE_TENANT'
  | 'NOTICE_LANDLORD'
  | 'LOCK_IN'
  | 'ENTRY_NOTICE'
  | 'ESSENTIAL_SERVICES'
  | 'SUBLET_GUESTS'
  | 'RENEWAL'
  | 'SALE_OF_PROPERTY'
  | 'REGISTRATION_STAMPING'
  | 'INVENTORY_HANDOVER'
  | 'DISPUTE_RESOLUTION';

export interface InterviewAnswers {
  city: string | null;
  monthlyRent: string | null;
  deposit: string | null;
  duration: string | null;
  lockIn: string | null;
  noticePeriod: string | null;
  maintenance: string | null;
  repairs: string | null;
  increase: string | null;
  extras: string[];
}

export interface NormalisedAnswers {
  city: string | null;
  monthlyRent: number | null;
  deposit: { amount: number | null; months: number | null } | null;
  duration: number | null;
  lockIn: number | null;
  noticePeriod: number | null;
  maintenance: 'me' | 'owner' | 'split' | 'not_discussed' | null;
  repairs: 'me' | 'owner' | 'split' | 'not_discussed' | null;
  increase: number | null;
  extras: string[];
}

export interface Clause {
  id: string;
  label: string | null;
  heading: string | null;
  text: string;
  page: number | null;
  pageEnd: number | null;
  order: number;
}

export type VerifiedQuoteStatus = 'verified' | 'fuzzy' | 'unverified';

export interface VerifiedQuote {
  clauseId: string;
  quote: string;
  status: VerifiedQuoteStatus;
  start?: number;
  end?: number;
}

export type Verdict = 'matches' | 'differs' | 'not_covered' | 'unclear';
export type Severity = 'HIGH' | 'MEDIUM' | 'INFO';

export interface MatchRow {
  key: keyof InterviewAnswers;
  agreed: string;
  written: string | null;
  verdict: Verdict;
  severity: Severity;
  evidence: VerifiedQuote | null;
  note: string;
  suggestedQuestion: string | null;
}

export interface GapRow {
  id: ProtectionId;
  title: string;
  state: 'present' | 'absent' | 'unclear';
  evidence: VerifiedQuote | null;
  whyItMatters: string;
  requestWording: string | null;
}

export interface RuleHit {
  ruleId: string;
  clauseId: string | null;
  severity: Severity;
  title: string;
  message: string;
  basis: string;
  questions: string[];
  lastReviewed: string;
}

export interface AskResult {
  status: 'answered' | 'not_in_document' | 'needs_professional';
  answer: string;
  citations: VerifiedQuote[];
  missingInfo: string[];
  suggestedQuestions: string[];
}

export interface AnalysisResult {
  overview: string;
  matches: MatchRow[];
  gaps: GapRow[];
  rules: RuleHit[];
}

export interface NegotiationItem {
  rowId: string;
  ask: string;
  reason: string;
  suggestedWording: string;
}

export interface NegotiationResult {
  message: string;
  items: NegotiationItem[];
}

export interface MoveInChecklistItem {
  id: string;
  room: string;
  description: string;
  completed: boolean;
}

export interface MoveInKit {
  checklist: MoveInChecklistItem[];
  meterReadings: Record<string, string>;
  timeline: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  label: string;
  date: string | null;
  description: string;
}

export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface KeyState {
  key: string | null;
  remember: boolean;
  masked: string | null;
}

export interface BudgetState {
  used: number;
  limit: number;
}

export interface Preferences {
  language: 'en' | 'hi';
  readingLevel: 'simple' | 'standard';
  theme: 'light' | 'dark' | 'system';
}

export interface DocumentState {
  fileName: string | null;
  fileType: 'pdf' | 'docx' | 'text' | null;
  clauses: Clause[];
  rawText: string;
  pageCount: number;
  charCount: number;
  error: string | null;
}

export interface InterviewState {
  answers: InterviewAnswers;
  currentStep: number;
  completed: boolean;
}

export interface AnalysisState {
  result: AnalysisResult | null;
  loading: boolean;
  error: AppError | null;
  stage: string;
}

export interface QAState {
  history: Array<{ question: string; result: AskResult }>;
  loading: boolean;
}

export interface NegotiationState {
  selectedRows: string[];
  tone: 'polite' | 'direct';
  channel: 'whatsapp' | 'email';
  result: NegotiationResult | null;
  loading: boolean;
}

export interface MoveInState {
  kit: MoveInKit | null;
}

export type AppState = {
  interview: InterviewState;
  document: DocumentState;
  analysis: AnalysisState;
  qa: QAState;
  negotiation: NegotiationState;
  movein: MoveInState;
  preferences: Preferences;
  key: KeyState;
  budget: BudgetState;
};

export type AppAction =
  | { type: 'SET_INTERVIEW_ANSWER'; key: keyof InterviewAnswers; value: string | string[] }
  | { type: 'SET_INTERVIEW_STEP'; step: number }
  | { type: 'SET_INTERVIEW_COMPLETED'; completed: boolean }
  | { type: 'SET_DOCUMENT'; document: Partial<DocumentState> }
  | { type: 'SET_ANALYSIS'; analysis: Partial<AnalysisState> }
  | { type: 'ADD_QA'; question: string; result: AskResult }
  | { type: 'SET_NEGOTIATION_SELECTION'; rows: string[] }
  | { type: 'SET_NEGOTIATION_TONE'; tone: 'polite' | 'direct' }
  | { type: 'SET_NEGOTIATION_CHANNEL'; channel: 'whatsapp' | 'email' }
  | { type: 'SET_NEGOTIATION_RESULT'; result: NegotiationResult }
  | { type: 'SET_NEGOTIATION_LOADING'; loading: boolean }
  | { type: 'SET_MOVEIN_KIT'; kit: MoveInKit }
  | { type: 'TOGGLE_CHECKLIST_ITEM'; itemId: string }
  | { type: 'SET_PREFERENCES'; prefs: Partial<Preferences> }
  | { type: 'SET_KEY'; key: string | null }
  | { type: 'SET_KEY_REMEMBER'; remember: boolean }
  | { type: 'INCREMENT_BUDGET' }
  | { type: 'RESET_BUDGET' }
  | { type: 'RESET_ALL' };

export interface ModelMatchFinding {
  key: string;
  found: boolean;
  writtenValue: string | null;
  clauseId: string | null;
  quote: string | null;
  ambiguity: string | null;
}

export interface ModelProtectionFinding {
  id: string;
  state: 'present' | 'absent' | 'unclear';
  summary: string | null;
  clauseId: string | null;
  quote: string | null;
}

export interface ModelAnalysisResponse {
  overview: string;
  matchFindings: ModelMatchFinding[];
  protectionFindings: ModelProtectionFinding[];
}

export interface ModelAskResponse {
  status: 'answered' | 'not_in_document' | 'needs_professional';
  answer: string;
  citations: Array<{ clauseId: string; quote: string }>;
  missingInfo: string[];
  suggestedQuestions: string[];
}

export interface ModelNegotiationResponse {
  message: string;
  items: Array<{
    rowId: string;
    ask: string;
    reason: string;
    suggestedWording: string;
  }>;
}