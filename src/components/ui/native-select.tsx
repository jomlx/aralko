import * as React from "react"
import { cn } from "../../lib/utils"

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        <select
          className={cn(
            "appearance-none items-center gap-2 px-3 py-1.5 pr-8 rounded-lg bg-surface border border-token text-sm font-medium hover:bg-white/[0.04] transition-colors focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-70"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>
    )
  }
)
NativeSelect.displayName = "NativeSelect"

const NativeSelectOption = React.forwardRef<HTMLOptionElement, React.OptionHTMLAttributes<HTMLOptionElement>>(
  ({ className, ...props }, ref) => {
    return (
      <option
        className={cn("bg-surface text-foreground", className)}
        ref={ref}
        {...props}
      />
    )
  }
)
NativeSelectOption.displayName = "NativeSelectOption"

export { NativeSelect, NativeSelectOption }
