import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'dashboard' },
    { name: 'Marketplace', path: '/marketplace', icon: 'storefront' },
    { name: 'Wallet', path: '/wallet', icon: 'account_balance_wallet' },
    { name: 'Agent Passport', path: '/agent-passport', icon: 'badge' },
  ];

  return (
    <nav className="w-[240px] h-screen fixed left-0 top-0 border-r border-outline-variant bg-surface hidden md:flex flex-col py-lg px-md z-40">
      {/* Brand */}
      <div className="mb-xl">
        <h1 className="font-display text-h2 font-bold text-primary">AgentPay</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">AI Infrastructure</p>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 flex flex-col gap-sm">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-md px-md py-sm rounded-xl font-body-md transition-colors active:scale-95 duration-100 ${
                isActive
                  ? 'text-on-primary-container bg-primary-container hover:bg-surface-variant hover:text-on-surface font-medium shadow-[0_0_15px_rgba(131,82,255,0.25)]'
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer Nav & Actions */}
      <div className="mt-auto flex flex-col gap-sm pt-lg border-t border-outline-variant/30">
        <a
          className="flex items-center gap-md px-md py-sm rounded-xl text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors active:scale-95 duration-100"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span>Settings</span>
        </a>
        <a
          className="flex items-center gap-md px-md py-sm rounded-xl text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors active:scale-95 duration-100"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
          <span>Support</span>
        </a>
        <button
          onClick={() => {
            const name = prompt('Enter new Agent Name (e.g. ArbTrader v2):');
            if (name) {
              window.location.href = '/agent-passport';
            }
          }}
          className="mt-md w-full py-sm bg-primary-container text-on-primary-container rounded-xl font-body-md font-medium hover:bg-primary transition-colors active:scale-95 duration-100 cursor-pointer shadow-[0_0_15px_rgba(131,82,255,0.3)]"
        >
          Create Agent
        </button>
      </div>
    </nav>
  );
}
