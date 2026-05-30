import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('keeps multiple actions visible inside a wrapping action group', () => {
    render(
      <PageHeader
        title="Recibos"
        actions={
          <>
            <button type="button">Exportar</button>
            <button type="button">Emitir recibo</button>
          </>
        }
      />
    );

    const exportButton = screen.getByRole('button', { name: 'Exportar' });
    const actionGroup = exportButton.parentElement;

    expect(exportButton).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emitir recibo' })).toBeInTheDocument();
    expect(actionGroup).toHaveClass('flex-wrap', 'gap-3');
  });
});
