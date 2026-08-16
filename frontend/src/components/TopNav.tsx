interface TopNavProps {
  onSearch?: (query: string) => void;
}

export default function TopNav({ onSearch }: TopNavProps) {
  return (
    <header className="fixed top-0 right-0 left-0 md:left-[240px] z-50 border-b border-outline-variant bg-surface/80 backdrop-blur-xl flex justify-between items-center px-lg h-16 w-full md:w-[calc(100%-240px)]">
      <div className="md:hidden font-display text-h2 font-bold text-primary">AgentPay</div>

      <div className="hidden md:flex items-center bg-surface-container/50 border border-outline-variant rounded-full px-md py-sm w-72 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-sm">search</span>
        <input
          onChange={(e) => onSearch?.(e.target.value)}
          className="bg-transparent border-none focus:ring-0 text-body-md font-body-md text-on-surface w-full p-0 placeholder:text-on-surface-variant/50 focus:outline-none text-sm"
          placeholder="Search addresses, txn hash..."
          type="text"
        />
      </div>

      <div className="flex items-center gap-md">
        <span className="text-on-surface-variant px-md py-sm border border-outline-variant rounded-lg font-data-mono text-sm hidden sm:flex items-center gap-1.5 bg-[#121217]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Monad Testnet
        </span>

        <a
          href="https://testnet.monadscan.com/address/0xe56F41956b9A255edF1FDeB11c8867638C92c86d"
          target="_blank"
          rel="noreferrer"
          className="bg-primary-container text-on-primary-container px-md py-sm rounded-lg font-body-md font-medium hover:bg-primary transition-colors active:opacity-80 flex items-center gap-1.5 shadow-[0_0_15px_rgba(131,82,255,0.25)] text-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
          Connect Wallet
        </a>

        <button className="text-on-surface-variant hover:text-primary transition-colors active:opacity-80 cursor-pointer">
          <span className="material-symbols-outlined">notifications</span>
        </button>

        <button className="text-on-surface-variant hover:text-primary transition-colors active:opacity-80 cursor-pointer">
          <span className="material-symbols-outlined">account_circle</span>
        </button>
      </div>
    </header>
  );
}
