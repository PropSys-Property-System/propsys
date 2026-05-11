import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReceiptRow } from './Receipts';
import React from 'react';

// Mocking Lucide icons
vi.mock('lucide-react', () => ({
  FileText: () => <div data-testid="file-text-icon" />,
}));

describe('ReceiptRow', () => {
  const mockOnView = vi.fn();
  const mockProps = {
    number: 'REC-001',
    date: '2024-03-30T12:00:00Z', // Use ISO with time to avoid TZ issues
    amount: 150000,
    currency: 'PEN',
    status: 'PENDING' as const,
    description: 'Gastos Comunes Marzo',
    onView: mockOnView,
  };

  beforeEach(() => {
    mockOnView.mockClear();
  });

  it('renders correctly with given props', () => {
    render(<ReceiptRow {...mockProps} />);
    
    expect(screen.getByText('REC-001')).toBeInTheDocument();
    expect(screen.getByText('Gastos Comunes Marzo')).toBeInTheDocument();
    expect(screen.getByText(/s\/\s*150,000/i)).toBeInTheDocument();
    // The exact date might still vary by local TZ, but let's check for year and month
    expect(screen.getByText(/mar.*2024/i)).toBeInTheDocument();
  });

  it('calls onView when clicked', () => {
    render(<ReceiptRow {...mockProps} />);
    const row = screen.getByRole('button');
    fireEvent.click(row);
    expect(mockOnView).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard accessibility (Enter key)', () => {
    render(<ReceiptRow {...mockProps} />);
    const row = screen.getByRole('button');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(mockOnView).toHaveBeenCalledTimes(1);
  });

  it('handles invalid date gracefully', () => {
    render(<ReceiptRow {...mockProps} date="invalid-date" />);
    expect(screen.getByText('Fecha invalida')).toBeInTheDocument();
  });

  it('handles non-numeric amount gracefully', () => {
    // @ts-expect-error - purposefully passing wrong type for testing robustness
    render(<ReceiptRow {...mockProps} amount="not-a-number" />);
    expect(screen.getByText('---')).toBeInTheDocument();
  });
});

