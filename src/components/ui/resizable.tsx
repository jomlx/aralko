import * as ResizablePrimitive from "react-resizable-panels"
import { cn } from "../../lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel {...props} />
}

function ResizableHandle({
  className,
  ...props
}: ResizablePrimitive.SeparatorProps) {
  return (
    <ResizablePrimitive.Separator
      className={cn(
        "relative flex items-center justify-center transition-all duration-150",
        "w-px bg-[var(--border)]",
        "hover:bg-accent data-[separator=hover]:bg-accent",
        "active:bg-accent active:w-[3px] data-[separator=active]:bg-accent data-[separator=active]:w-[3px]",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-5 after:-translate-x-1/2",
        "cursor-col-resize",
        className
      )}
      {...props}
    />
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
