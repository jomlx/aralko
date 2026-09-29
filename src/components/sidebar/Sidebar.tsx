

type SidebarProps = {
  children: React.ReactNode;
};

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside
      className="relative flex-shrink-0 h-full min-w-[275px] bg-app pl-[var(--gutter)] py-4 pr-4 flex flex-col gap-4 overflow-hidden"
    >
      {children}
    </aside>
  );
}
