import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        secondary: "border-border-subtle bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground bg-transparent",
        accent: "border-transparent bg-accent/10 text-[hsl(243_70%_45%)] dark:text-[hsl(243_90%_80%)]",
        destructive:
          "border-transparent bg-[hsl(0_75%_55%/0.10)] text-[hsl(0_72%_42%)] dark:text-[hsl(0_85%_75%)] dark:bg-[hsl(0_75%_55%/0.15)]",
        success:
          "border-transparent bg-[hsl(152_70%_38%/0.10)] text-[hsl(152_65%_28%)] dark:text-[hsl(152_65%_62%)] dark:bg-[hsl(152_65%_42%/0.15)]",
        warning:
          "border-transparent bg-[hsl(35_95%_50%/0.12)] text-[hsl(28_85%_35%)] dark:text-[hsl(38_92%_68%)] dark:bg-[hsl(38_92%_55%/0.15)]",
        info:
          "border-transparent bg-[hsl(217_91%_60%/0.10)] text-[hsl(217_85%_42%)] dark:text-[hsl(217_91%_72%)] dark:bg-[hsl(217_91%_60%/0.15)]"
      },
      dot: {
        true: "pl-2 before:content-[''] before:size-1.5 before:rounded-full before:bg-current before:opacity-80"
      }
    },
    defaultVariants: { variant: "default", dot: false }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, dot, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, dot }), className)} {...props} />;
}

export { Badge, badgeVariants };
