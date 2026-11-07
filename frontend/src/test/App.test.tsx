import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('FileMate Frontend', () => {
  it('renders login page branding and inputs by default when unauthenticated', () => {
    render(<App />);
    expect(screen.getAllByText(/FileMate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Your Expense Assistant/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/name@brightpath.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
  });
});
