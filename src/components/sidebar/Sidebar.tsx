
type SidebarProps = {
  children: React.ReactNode;
};

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside
      className="h-full bg-app pl-[var(--gutter)] py-4 pr-4 flex flex-col gap-4 overflow-y-auto overflow-x-hidden min-w-[280px]"
    >
      {children}
    </aside>
  );
}
