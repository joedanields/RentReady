/** App state — Context + useReducer, RESET_ALL clears everything */

import type {
  AppState,
  AppAction,
  InterviewAnswers,
  AnalysisResult,
  AskResult,
  NegotiationResult,
  MoveInKit,
  KeyState,
  Preferences,
} from '../core/types.js';
import { INITIAL_INTERVIEW_ANSWERS } from '../core/interview/questions.js';

export const INITIAL_PREFS: Preferences = {
  language: 'en',
  readingLevel: 'standard',
  theme: 'system',
};

export const INITIAL_KEY: KeyState = {
  key: null,
  remember: false,
  masked: null,
};

export const INITIAL_STATE: AppState = {
  interview: {
    answers: { ...INITIAL_INTERVIEW_ANSWERS },
    currentStep: 0,
    completed: false,
  },
  document: {
    fileName: null,
    fileType: null,
    clauses: [],
    rawText: '',
    pageCount: 0,
    charCount: 0,
    error: null,
  },
  analysis: {
    result: null,
    loading: false,
    error: null,
    stage: '',
  },
  qa: {
    history: [],
    loading: false,
  },
  negotiation: {
    selectedRows: [],
    tone: 'polite',
    channel: 'whatsapp',
    result: null,
    loading: false,
  },
  movein: {
    kit: null,
  },
  preferences: { ...INITIAL_PREFS },
  key: { ...INITIAL_KEY },
  budget: { used: 0, limit: 12 },
  demo: false,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INTERVIEW_ANSWER':
      return {
        ...state,
        interview: {
          ...state.interview,
          answers: {
            ...state.interview.answers,
            [action.key]: action.value,
          },
        },
      };
    case 'CLEAR_INTERVIEW_ANSWER':
      // Skipped / "not sure" answers are stored as empty so they never become a promise to check.
      return {
        ...state,
        interview: {
          ...state.interview,
          answers: {
            ...state.interview.answers,
            [action.key]: action.key === 'extras' ? [] : null,
          },
        },
      };
    case 'SET_INTERVIEW_STEP':
      return {
        ...state,
        interview: { ...state.interview, currentStep: action.step },
      };
    case 'SET_INTERVIEW_COMPLETED':
      return {
        ...state,
        interview: { ...state.interview, completed: action.completed },
      };
    case 'SET_DOCUMENT':
      return {
        ...state,
        document: { ...state.document, ...action.document },
      };
    case 'CLEAR_DOCUMENT':
      // A new agreement invalidates every result derived from the old one.
      return {
        ...state,
        document: structuredClone(INITIAL_STATE.document),
        analysis: structuredClone(INITIAL_STATE.analysis),
        qa: structuredClone(INITIAL_STATE.qa),
        negotiation: structuredClone(INITIAL_STATE.negotiation),
        movein: structuredClone(INITIAL_STATE.movein),
      };
    case 'SET_ANALYSIS':
      return {
        ...state,
        analysis: { ...state.analysis, ...action.analysis },
      };
    case 'ADD_QA':
      return {
        ...state,
        qa: {
          ...state.qa,
          history: [...state.qa.history, { question: action.question, result: action.result }],
        },
      };
    case 'SET_NEGOTIATION_SELECTION':
      return {
        ...state,
        negotiation: { ...state.negotiation, selectedRows: action.rows },
      };
    case 'SET_NEGOTIATION_TONE':
      return {
        ...state,
        negotiation: { ...state.negotiation, tone: action.tone },
      };
    case 'SET_NEGOTIATION_CHANNEL':
      return {
        ...state,
        negotiation: { ...state.negotiation, channel: action.channel },
      };
    case 'SET_NEGOTIATION_RESULT':
      return {
        ...state,
        negotiation: { ...state.negotiation, result: action.result },
      };
    case 'SET_NEGOTIATION_LOADING':
      return {
        ...state,
        negotiation: { ...state.negotiation, loading: action.loading },
      };
    case 'SET_MOVEIN_KIT':
      return {
        ...state,
        movein: { ...state.movein, kit: action.kit },
      };
    case 'TOGGLE_CHECKLIST_ITEM':
      return {
        ...state,
        movein: {
          ...state.movein,
          kit: state.movein.kit
            ? {
                ...state.movein.kit,
                checklist: state.movein.kit.checklist.map(item =>
                  item.id === action.itemId ? { ...item, completed: !item.completed } : item
                ),
              }
            : null,
        },
      };
    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.prefs },
      };
    case 'SET_KEY':
      return {
        ...state,
        key: { ...state.key, key: action.key },
      };
    case 'SET_KEY_REMEMBER':
      return {
        ...state,
        key: { ...state.key, remember: action.remember },
      };
    case 'INCREMENT_BUDGET':
      return {
        ...state,
        budget: { ...state.budget, used: state.budget.used + 1 },
      };
    case 'RESET_BUDGET':
      return {
        ...state,
        budget: { ...state.budget, used: 0 },
      };
    case 'SET_DEMO':
      return { ...state, demo: action.demo };
    case 'RESET_ALL':
      return structuredClone(INITIAL_STATE);
    default:
      return state;
  }
}

export { reducer };
export type { AppState, AppAction };
export type { InterviewAnswers, AnalysisResult, AskResult, NegotiationResult, MoveInKit, KeyState };
