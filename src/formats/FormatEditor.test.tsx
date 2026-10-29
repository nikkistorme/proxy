import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { COOP_PVE, PVP_1V1, type FormatItem } from '../model/format';
import { FormatEditor } from './FormatEditor';

const item = (): FormatItem => ({ ...structuredClone(PVP_1V1), id: 'f-a', name: 'Apple' });

/** The editor over a format it keeps up to date, like the screen does through the provider. */
function setup() {
  const saves: FormatItem[] = [];
  const announce = vi.fn();
  const user = userEvent.setup();
  function Harness() {
    const [format, setFormat] = useState(item());
    return (
      <FormatEditor
        format={format}
        onChange={(next) => {
          saves.push(next);
          setFormat(next);
        }}
        announce={announce}
      />
    );
  }
  render(<Harness />);
  return { user, saves, announce, last: () => saves[saves.length - 1] };
}

describe('FS-2 format editor seats', () => {
  it('shows a named field per seat, renames one and saves it', async () => {
    const { user, last } = setup();
    expect(screen.getAllByRole('textbox', { name: /^Seat \d name$/ })).toHaveLength(2);
    const field = screen.getByRole('textbox', { name: 'Seat 2 name' });
    await user.clear(field);
    await user.type(field, 'Rival');
    expect(last()?.seats.map((s) => s.name)).toEqual(['Player 1', 'Rival']);
  });

  it('shows an error for an empty or taken seat name and keeps the last valid name saved', async () => {
    const { user, last } = setup();
    const field = screen.getByRole('textbox', { name: 'Seat 2 name' });
    await user.clear(field);
    expect(field).toHaveAccessibleDescription('Error: A seat needs a name.');
    expect(field).toBeInvalid();
    await user.type(field, 'player 1');
    expect(field).toHaveAccessibleDescription('Error: There is already a seat called Player 1.');
    // Typing saved each valid prefix; the clashing name never saved.
    expect(last()?.seats[1]?.name).toBe('player');
  });

  it('has no way to add or remove a seat', () => {
    setup();
    expect(screen.queryByRole('button', { name: /seat/i })).not.toBeInTheDocument();
  });
});

describe('FS-2 format editor piles', () => {
  it('adds a shared pile at the end, announces it and focuses its name field', async () => {
    const { user, last, announce } = setup();
    await user.click(screen.getByRole('button', { name: 'Add pile' }));
    expect(last()?.piles.at(-1)).toMatchObject({ name: 'Pile 4' });
    expect(last()?.piles.at(-1)?.id).toMatch(/^pile-/);
    expect(last()?.piles.at(-1)?.ownerSeatId).toBeUndefined();
    expect(announce).toHaveBeenCalledWith('Added pile Pile 4.');
    expect(screen.getByRole('textbox', { name: 'Pile 4 name' })).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Pile 4 owner' })).toHaveValue('');
  });

  it('refuses a pile name another pile has', async () => {
    const { user, last } = setup();
    const field = screen.getByRole('textbox', { name: 'Pile 3 name' });
    await user.clear(field);
    await user.type(field, ' p1 main DECK');
    expect(field).toHaveAccessibleDescription('Error: There is already a pile called P1 main deck.');
    expect(last()?.piles[2]?.name).toBe('p1 main DEC');
  });

  it('changes an owner to a seat or Shared', async () => {
    const { user, last, announce } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pile 3 owner' }), 'Player 2');
    expect(last()?.piles[2]?.ownerSeatId).toBe('seat-p2');
    expect(announce).toHaveBeenCalledWith('Board cards is now owned by Player 2.');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pile 3 owner' }), 'Shared');
    expect(last()?.piles[2]?.ownerSeatId).toBeUndefined();
  });

  it('removes at once, then focuses the next pile’s Remove, else the previous, else Add pile', async () => {
    const { user, last, announce } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove P1 main deck' }));
    expect(last()?.piles.map((p) => p.name)).toEqual(['P2 main deck', 'Board cards']);
    expect(announce).toHaveBeenCalledWith('Removed P1 main deck.');
    expect(screen.getByRole('button', { name: 'Remove P2 main deck' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove Board cards' }));
    expect(screen.getByRole('button', { name: 'Remove P2 main deck' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove P2 main deck' }));
    expect(last()?.piles).toEqual([]);
    expect(screen.getByRole('button', { name: 'Add pile' })).toHaveFocus();
    expect(screen.getByText('This format starts with no piles.')).toBeInTheDocument();
  });
});

describe('FS-2 format editor dice', () => {
  it('turns Uses dice off and on and announces it', async () => {
    const { user, last, announce } = setup();
    const box = screen.getByRole('checkbox', { name: 'Uses dice' });
    expect(box).toBeChecked();
    await user.click(box);
    expect(last()?.usesDice).toBe(false);
    expect(announce).toHaveBeenCalledWith('Dice turned off.');
    await user.click(box);
    expect(last()?.usesDice).toBe(true);
    await waitFor(() => expect(announce).toHaveBeenLastCalledWith('Dice turned on.'));
  });
});

describe('FS-4 format editor counters', () => {
  it('groups fields by seat and labels counters by position', () => {
    setup();
    expect(screen.getAllByRole('group', { name: /^Seat \d$/ })).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'Seat 2 counter 1 name' })).toHaveValue('Life');
    expect(screen.getByRole('textbox', { name: 'Seat 2 counter 2 starting value' })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Remove Player 2 Energy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add counter to Player 1' })).toBeInTheDocument();
  });

  it('adds a counter at 0, announces it and focuses its name field', async () => {
    const { user, last, announce } = setup();
    await user.click(screen.getByRole('button', { name: 'Add counter to Player 1' }));
    const added = last()?.seats[0]?.counters.at(-1);
    expect(added).toMatchObject({ name: 'Counter 3', value: 0 });
    expect(added?.id).toMatch(/^counter-/);
    expect(last()?.seats[1]?.counters).toHaveLength(2);
    expect(announce).toHaveBeenCalledWith('Added counter Counter 3 to Player 1.');
    expect(screen.getByRole('textbox', { name: 'Seat 1 counter 3 name' })).toHaveFocus();
  });

  it('replaces Add counter with a note at 4 counters', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add counter to Player 1' }));
    await user.click(screen.getByRole('button', { name: 'Add counter to Player 1' }));
    expect(screen.queryByRole('button', { name: 'Add counter to Player 1' })).not.toBeInTheDocument();
    expect(screen.getByText('A seat can have up to 4 counters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add counter to Player 2' })).toBeInTheDocument();
  });

  it('removes at once, then focuses the next counter’s Remove, else the previous, else Add counter', async () => {
    const { user, last, announce } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove Player 2 Life' }));
    expect(last()?.seats[1]?.counters.map((c) => c.name)).toEqual(['Energy']);
    expect(announce).toHaveBeenCalledWith('Removed Player 2 Life.');
    expect(screen.getByRole('button', { name: 'Remove Player 2 Energy' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove Player 2 Energy' }));
    expect(last()?.seats[1]?.counters).toEqual([]);
    expect(screen.getByRole('button', { name: 'Add counter to Player 2' })).toHaveFocus();
  });

  it('removes the last counter and focuses the previous one’s Remove', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove Player 1 Energy' }));
    expect(screen.getByRole('button', { name: 'Remove Player 1 Life' })).toHaveFocus();
  });

  it('renames a counter, refuses a name the seat has, and allows another seat’s', async () => {
    const { user, last } = setup();
    const field = screen.getByRole('textbox', { name: 'Seat 1 counter 1 name' });
    await user.clear(field);
    expect(field).toHaveAccessibleDescription('Error: A counter needs a name.');
    await user.type(field, 'energy');
    expect(field).toHaveAccessibleDescription('Error: There is already a counter called Energy.');
    expect(last()?.seats[0]?.counters[0]?.name).toBe('energ');
    await user.clear(field);
    await user.type(field, 'HP');
    expect(last()?.seats[0]?.counters[0]?.name).toBe('HP');
    // Player 2 may still have a Life counter.
    expect(screen.getByRole('textbox', { name: 'Seat 2 counter 1 name' })).toHaveValue('Life');
  });

  it('saves a whole-number starting value, with a leading minus, and refuses the rest', async () => {
    const { user, last } = setup();
    const field = screen.getByRole('textbox', { name: 'Seat 1 counter 1 starting value' });
    expect(field).toHaveAttribute('inputmode', 'text');
    await user.clear(field);
    expect(field).toHaveAccessibleDescription('Error: A starting value is needed.');
    await user.type(field, '30');
    expect(last()?.seats[0]?.counters[0]?.value).toBe(30);
    await user.clear(field);
    await user.type(field, '−4');
    expect(last()?.seats[0]?.counters[0]?.value).toBe(-4);
    await user.clear(field);
    await user.type(field, '1.5');
    expect(field).toHaveAccessibleDescription('Error: The starting value must be a whole number.');
    await user.clear(field);
    await user.type(field, '1000');
    expect(field).toHaveAccessibleDescription('Error: The starting value must be from -999 to 999.');
    expect(last()?.seats[0]?.counters[0]?.value).toBe(100);
  });

  it('lets the environment seat have counters', async () => {
    const saves: FormatItem[] = [];
    const user = userEvent.setup();
    function Env() {
      const [format, setFormat] = useState<FormatItem>({ ...structuredClone(COOP_PVE), id: 'f-b', name: 'Co' });
      return <FormatEditor format={format} onChange={(n) => (saves.push(n), setFormat(n))} announce={vi.fn()} />;
    }
    render(<Env />);
    await user.click(screen.getByRole('button', { name: 'Add counter to Environment' }));
    expect(saves.at(-1)?.seats[2]?.counters).toHaveLength(1);
  });
});
