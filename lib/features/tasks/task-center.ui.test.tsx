import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TaskListSkeleton } from './task-center.ui';

describe('TaskListSkeleton', () => {
  it('announces loading while reserving dense task cards', () => {
    render(<TaskListSkeleton count={2} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando tareas...');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
