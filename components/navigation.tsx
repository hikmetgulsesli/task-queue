export function Navigation() {
  return (
    <nav className="p-4">
      <ul className="space-y-2">
        <li><a href="/" className="block p-2 rounded hover:bg-gray-800">Dashboard</a></li>
        <li><a href="/tasks" className="block p-2 rounded hover:bg-gray-800">Tasks</a></li>
        <li><a href="/board" className="block p-2 rounded hover:bg-gray-800">Board</a></li>
        <li><a href="/stats" className="block p-2 rounded hover:bg-gray-800">Statistics</a></li>
      </ul>
    </nav>
  );
}
