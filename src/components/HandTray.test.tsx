import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HandTray } from './HandTray';

describe('FS-3 hand tray', () => {
  it("shows the seat's cards and count", () => {
    render(
      <HandTray
        seatId="seat-p1"
        seatName="Player 1"
        cards={[
          { id: 'a', face: { name: 'Imp', fields: {} } },
          { id: 'b', face: { name: 'Ogre', fields: {} } },
        ]}
        onDraw={() => {}}
      />,
    );
    const tray = screen.getByRole('region', { name: "Player 1's hand" });
    expect(within(tray).getByText('2 cards')).toBeInTheDocument();
    const list = within(tray).getByRole('list', { name: "Player 1's hand, 2 cards" });
    expect(within(list).getAllByRole('img').map((card) => card.getAttribute('aria-label'))).toEqual(['Imp', 'Ogre']);
  });

  it('says when the hand is empty, and draws from the Draw button', async () => {
    const onDraw = vi.fn();
    render(<HandTray seatId="seat-p1" seatName="Player 1" cards={[]} onDraw={onDraw} />);
    expect(screen.getByText("No cards in hand. Draw from Player 1's deck to start.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Draw' }));
    expect(onDraw).toHaveBeenCalledTimes(1);
  });
});
