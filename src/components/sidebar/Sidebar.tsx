

type SidebarProps = {
  width: number;
  children: React.ReactNode;
  onResizeStart: () => void;
};

export function Sidebar({ width, children, onResizeStart }: SidebarProps) {
  return (
    <aside
      style={{ width }}
      className="relative flex-shrink-0 h-full border-r border-token bg-app p-4 flex flex-col gap-4 overflow-hidden"
    >
      {children}
      <div
        className="absolute top-0 right-0 w-2 h-full cursor-col-resize group flex justify-end"
        onMouseDown={onResizeStart}
      >
        <div className="w-[1px] h-full bg-transparent group-hover:bg-accent transition-colors duration-200" />
      </div>
    </aside>
  );
}
