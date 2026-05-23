import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ForbiddenPage } from './Forbidden';

describe('ForbiddenPage', () => {
  it('shows 403 forbidden copy and workspace action', () => {
    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByText(/无权限访问当前页面/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回工作台' })).toBeInTheDocument();
  });
});
