import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground selection:bg-neon-magenta/30 selection:text-white dark:bg-black/30 border-border dark:border-white/10 flex min-h-[60px] w-full rounded-2xl border bg-transparent px-4 py-3 text-base shadow-xs transition-all duration-300 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-neon-cyan focus-visible:ring-neon-cyan/20 focus-visible:ring-[3px] focus-visible:shadow-[0_0_12px_rgba(0,229,255,0.25)]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
