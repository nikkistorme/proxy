import { GameScreen } from './components/GameScreen';
import { GameStoreProvider } from './store/gameStore';

export function App() {
  return (
    <GameStoreProvider>
      <GameScreen />
    </GameStoreProvider>
  );
}
