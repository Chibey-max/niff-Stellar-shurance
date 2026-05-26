/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PolicyCard, type PolicyCardProps } from '../PolicyCard';

const defaultProps: PolicyCardProps = {
  policyId: 12345,
  type: 'Auto',
  coverageAmount: '500000000000', // 50,000 XLM
  asset: 'XLM',
  status: 'active',
  expiryLedger: 1000000,
  currentLedger: 481280, // ~30 days remaining
  avgLedgerCloseSeconds: 5,
};

describe('PolicyCard', () => {
  describe('Rendering', () => {
    it('renders policy ID and type', () => {
      render(<PolicyCard {...defaultProps} />);
      expect(screen.getByText('#12345')).toBeInTheDocument();
      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('renders coverage amount with correct formatting', () => {
      const { container } = render(<PolicyCard {...defaultProps} />);
      // Check that the coverage section contains the formatted amount
      expect(container.textContent).toContain('50,000.00');
      expect(container.textContent).toContain('XLM');
    });

    it('renders expiry time estimate', () => {
      render(<PolicyCard {...defaultProps} />);
      // Should show approximate time remaining
      expect(screen.getByText(/~\d+d \d+h/)).toBeInTheDocument();
    });

    it('renders loading state when currentLedger is undefined', () => {
      render(<PolicyCard {...defaultProps} currentLedger={undefined} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('renders active status with green badge', () => {
      render(<PolicyCard {...defaultProps} status="active" />);
      const badge = screen.getByLabelText('Status: Active');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-500');
    });

    it('renders expiring status with yellow badge', () => {
      render(<PolicyCard {...defaultProps} status="expiring" />);
      const badge = screen.getByLabelText('Status: Expiring Soon');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-yellow-500');
    });

    it('renders expired status with outline badge', () => {
      render(<PolicyCard {...defaultProps} status="expired" />);
      const badge = screen.getByLabelText('Status: Expired');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('border');
    });
  });

  describe('Time Estimation', () => {
    it('displays days and hours for long durations', () => {
      render(
        <PolicyCard
          {...defaultProps}
          currentLedger={481280} // ~30 days
        />,
      );
      expect(screen.getByText(/~\d+d \d+h/)).toBeInTheDocument();
    });

    it('displays hours and minutes for medium durations', () => {
      render(
        <PolicyCard
          {...defaultProps}
          currentLedger={999280} // ~1 hour
        />,
      );
      expect(screen.getByText(/~\d+h \d+m/)).toBeInTheDocument();
    });

    it('displays minutes only for short durations', () => {
      render(
        <PolicyCard
          {...defaultProps}
          currentLedger={999940} // ~5 minutes
        />,
      );
      expect(screen.getByText(/~\d+m/)).toBeInTheDocument();
    });

    it('displays "Expired" when past expiry ledger', () => {
      render(
        <PolicyCard
          {...defaultProps}
          status="expired"
          currentLedger={1000001}
        />,
      );
      // "Expired" appears in both badge and time estimate, use getAllByText
      const expiredElements = screen.getAllByText('Expired');
      expect(expiredElements.length).toBeGreaterThan(0);
    });

    it('uses custom avgLedgerCloseSeconds for calculation', () => {
      const { rerender } = render(
        <PolicyCard
          {...defaultProps}
          currentLedger={999880} // 120 ledgers remaining
          avgLedgerCloseSeconds={5} // 600 seconds = 10 minutes
        />,
      );
      expect(screen.getByText(/~10m/)).toBeInTheDocument();

      rerender(
        <PolicyCard
          {...defaultProps}
          currentLedger={999880}
          avgLedgerCloseSeconds={10} // 1200 seconds = 20 minutes
        />,
      );
      expect(screen.getByText(/~20m/)).toBeInTheDocument();
    });
  });

  describe('Policy Types', () => {
    it('renders Auto policy type', () => {
      render(<PolicyCard {...defaultProps} type="Auto" />);
      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('renders Health policy type', () => {
      render(<PolicyCard {...defaultProps} type="Health" />);
      expect(screen.getByText('Health')).toBeInTheDocument();
    });

    it('renders Property policy type', () => {
      render(<PolicyCard {...defaultProps} type="Property" />);
      expect(screen.getByText('Property')).toBeInTheDocument();
    });
  });

  describe('Interactivity', () => {
    it('calls onClick when card is clicked', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(<PolicyCard {...defaultProps} onClick={handleClick} />);

      const card = screen.getByRole('button');
      await user.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Enter key is pressed', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(<PolicyCard {...defaultProps} onClick={handleClick} />);

      const card = screen.getByRole('button');
      card.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Space key is pressed', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(<PolicyCard {...defaultProps} onClick={handleClick} />);

      const card = screen.getByRole('button');
      card.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders as article when onClick is not provided', () => {
      render(<PolicyCard {...defaultProps} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('is keyboard focusable when clickable', () => {
      render(<PolicyCard {...defaultProps} onClick={() => {}} />);
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA label for the card', () => {
      render(<PolicyCard {...defaultProps} />);
      expect(
        screen.getByLabelText('Policy 12345 - Auto - active'),
      ).toBeInTheDocument();
    });

    it('has proper ARIA label for status badge', () => {
      render(<PolicyCard {...defaultProps} status="active" />);
      expect(screen.getByLabelText('Status: Active')).toBeInTheDocument();
    });

    it('includes title attribute with ledger details', () => {
      render(<PolicyCard {...defaultProps} />);
      const approxText = screen.getByText('(approx)');
      expect(approxText).toHaveAttribute('title');
      expect(approxText.getAttribute('title')).toContain('Ledger 1000000');
    });

    it('uses semantic HTML with dl/dt/dd for data', () => {
      const { container } = render(<PolicyCard {...defaultProps} />);
      expect(container.querySelector('dl')).toBeInTheDocument();
      expect(container.querySelectorAll('dt')).toHaveLength(2);
      expect(container.querySelectorAll('dd')).toHaveLength(2);
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      render(
        <PolicyCard {...defaultProps} className="custom-class" />,
      );
      const card = screen.getByRole('article');
      expect(card).toHaveClass('custom-class');
    });

    it('applies cursor-pointer when clickable', () => {
      render(
        <PolicyCard {...defaultProps} onClick={() => {}} />,
      );
      const card = screen.getByRole('button');
      expect(card).toHaveClass('cursor-pointer');
    });

    it('does not apply cursor-pointer when not clickable', () => {
      render(<PolicyCard {...defaultProps} />);
      const card = screen.getByRole('article');
      expect(card).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Edge Cases', () => {
    it('handles zero ledgers remaining', () => {
      render(
        <PolicyCard
          {...defaultProps}
          status="expired"
          currentLedger={1000000}
        />,
      );
      // "Expired" appears in both badge and time estimate
      const expiredElements = screen.getAllByText('Expired');
      expect(expiredElements.length).toBeGreaterThan(0);
    });

    it('handles very large coverage amounts', () => {
      const { container } = render(
        <PolicyCard
          {...defaultProps}
          coverageAmount="99999999999999" // ~10 million XLM
        />,
      );
      // Check that the coverage section contains the formatted amount
      expect(container.textContent).toContain('10,000,000.00');
      expect(container.textContent).toContain('XLM');
    });

    it('handles very small coverage amounts', () => {
      const { container } = render(
        <PolicyCard
          {...defaultProps}
          coverageAmount="10000000" // 1 XLM
        />,
      );
      // Check that the coverage section contains the formatted amount
      expect(container.textContent).toContain('1.00');
      expect(container.textContent).toContain('XLM');
    });

    it('handles negative ledgers remaining gracefully', () => {
      render(
        <PolicyCard
          {...defaultProps}
          status="expired"
          currentLedger={1000100} // 100 ledgers past expiry
        />,
      );
      // "Expired" appears in both badge and time estimate
      const expiredElements = screen.getAllByText('Expired');
      expect(expiredElements.length).toBeGreaterThan(0);
    });
  });
});
