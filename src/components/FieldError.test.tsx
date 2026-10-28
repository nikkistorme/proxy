import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldControl, FieldError } from './FieldError';

function Field({ invalid }: { invalid: boolean }) {
  return (
    <div>
      <label htmlFor="name">Name</label>
      <FieldControl invalid={invalid}>
        <input id="name" aria-invalid={invalid} aria-describedby={invalid ? 'name-error' : undefined} />
      </FieldControl>
      {invalid && <FieldError id="name-error">A pile needs a name.</FieldError>}
    </div>
  );
}

describe('A11Y-13 error identification', () => {
  it('starts the message with a visible "Error:" after an icon', () => {
    const { container } = render(<Field invalid />);
    const message = container.querySelector('.form-error');
    expect(message).toHaveTextContent('Error: A pile needs a name.');
    expect(message?.querySelector('svg.form-error__icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('reads the field as invalid with its message, without the icons', () => {
    render(<Field invalid />);
    const field = screen.getByRole('textbox', { name: 'Name' });
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('Error: A pile needs a name.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows an icon inside the field only while it is invalid', () => {
    const { container, rerender } = render(<Field invalid />);
    expect(container.querySelector('.form-control > svg.form-control__icon')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Field invalid={false} />);
    expect(container.querySelector('.form-control__icon')).not.toBeInTheDocument();
    expect(container.querySelector('.form-error')).not.toBeInTheDocument();
  });
});
