import type { PostListQuery } from '@kvkk/shared';

interface FilterBarProps {
  filters: Partial<PostListQuery>;
  onChange: (filters: Partial<PostListQuery>) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      search: e.target.value || undefined,
    });
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      dateFrom: e.target.value ? new Date(e.target.value) : undefined,
    });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      dateTo: e.target.value ? new Date(e.target.value) : undefined,
    });
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      company: e.target.value || undefined,
    });
  };

  const handleUnreadOnlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      unreadOnly: e.target.checked || undefined,
    });
  };

  const formatDate = (date?: Date): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0] ?? '';
  };

  return (
    <div className="flex gap-2 p-4 bg-white rounded-lg shadow">
      <input
        type="text"
        placeholder="Search..."
        value={filters.search || ''}
        onChange={handleSearchChange}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="date"
        value={formatDate(filters.dateFrom)}
        onChange={handleFromChange}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="date"
        value={formatDate(filters.dateTo)}
        onChange={handleToChange}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="text"
        placeholder="Company..."
        value={filters.company || ''}
        onChange={handleCompanyChange}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <label className="flex items-center gap-2 px-3 py-2">
        <input
          type="checkbox"
          checked={filters.unreadOnly || false}
          onChange={handleUnreadOnlyChange}
          className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Unread Only</span>
      </label>
    </div>
  );
}
