/** Demo mode — recorded responses through the same pipeline. The flag lives in app state. */

import { useApp } from '../../state/AppProvider';

export function useDemoMode() {
  const { state, dispatch } = useApp();
  return {
    active: state.demo,
    use: () => dispatch({ type: 'SET_DEMO', demo: true }),
    disable: () => dispatch({ type: 'SET_DEMO', demo: false }),
  };
}
