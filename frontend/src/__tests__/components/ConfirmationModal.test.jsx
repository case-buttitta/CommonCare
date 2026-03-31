import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmModal from '../../components/ConfirmationModal';

describe('ConfirmModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConfirmModal isOpen={false} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders title and message when open', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Item"
        message="Are you sure you want to delete?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete?')).toBeInTheDocument();
  });

  it('uses default title and message when not provided', () => {
    render(<ConfirmModal isOpen={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onConfirm when Yes, Delete is clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal isOpen={true} onConfirm={onConfirm} onCancel={vi.fn()} />
    );
    await userEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal isOpen={true} onConfirm={vi.fn()} onCancel={onCancel} />
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders both Cancel and Yes Delete buttons', () => {
    render(<ConfirmModal isOpen={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument();
  });
});
