import { SessionScreen } from './components/SessionScreen';
import { SessionStoreProvider } from './store/sessionStore';

export function App() {
  return (
    <SessionStoreProvider>
      <SessionScreen />
    </SessionStoreProvider>
  );
}
