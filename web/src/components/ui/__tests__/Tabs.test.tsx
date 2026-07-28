/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tabs } from '../Tabs';

const tabs = [
  { id: 'insights', label: 'Session Insights', content: <div>insights body</div> },
  { id: 'patterns', label: 'Session Patterns', content: <div>patterns body</div> },
];

describe('Tabs', () => {
  it('renders all tab labels and the first tab content by default', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Session Insights' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Session Patterns' })).toBeInTheDocument();
    expect(screen.getByText('insights body')).toBeInTheDocument();
    expect(screen.queryByText('patterns body')).not.toBeInTheDocument();
  });

  it('switches content on tab click', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Session Patterns' }));
    expect(screen.getByText('patterns body')).toBeInTheDocument();
    expect(screen.queryByText('insights body')).not.toBeInTheDocument();
  });

  it('marks the active tab with aria-selected', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Session Insights' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Session Patterns' }));
    expect(screen.getByRole('tab', { name: 'Session Patterns' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Session Insights' })).toHaveAttribute('aria-selected', 'false');
  });
});
