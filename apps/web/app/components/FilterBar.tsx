import type { PostListQuery } from '@kvkk/shared';

interface FilterBarProps {
  filters: Partial<PostListQuery>;
  onChange: (filters: Partial<PostListQuery>) => void;
}

// CONTRACT:
// Renders search input, company filter input, date range pickers, and unread-only toggle.
// Input: filters (Partial<PostListQuery>), onChange callback
// Output: JSX form with controlled inputs that call onChange on change
// Logic:
//   1. Controlled text input for 'search' field (debounced 300ms)
//   2. Controlled text input for 'company' field (debounced 300ms)
//   3. Date inputs for 'dateFrom' and 'dateTo'
//   4. Checkbox for 'unreadOnly'
//   5. Each input change merges with current filters and calls onChange

export function FilterBar({ filters, onChange }: FilterBarProps) {
  throw new Error('not implemented');
}
