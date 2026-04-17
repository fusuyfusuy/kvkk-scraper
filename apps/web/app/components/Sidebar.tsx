import { Link } from '@tanstack/react-router';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/posts', label: 'Posts' },
  { to: '/settings/scrape', label: 'Scrape Config' },
  { to: '/settings/mail', label: 'Mail Config' },
];

export function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-white border-r border-gray-200 shadow-sm flex flex-col z-10">
      <div className="px-6 py-5 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">KVKK Takip</h1>
      </div>
      <nav className="flex-1 py-4">
        <ul className="flex flex-col">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === '/' }}
                className="block px-6 py-2.5 text-sm border-l-4 border-transparent text-gray-700 hover:bg-gray-50"
                activeProps={{
                  className:
                    'block px-6 py-2.5 text-sm border-l-4 bg-blue-50 text-blue-700 border-blue-600 font-medium',
                }}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
