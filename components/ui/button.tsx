import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium gap-2 select-none",
    "transition-[transform,box-shadow,background-color,color,border-color] duration-180 ease-spring",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
    "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform"
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-foreground text-background",
          "shadow-[inset_0_1px_0_0_hsl(var(--background)/0.12),0_1px_2px_0_hsl(var(--foreground)/0.2)]",
          "hover:shadow-[inset_0_1px_0_0_hsl(var(--background)/0.18),0_4px_14px_-2px_hsl(var(--foreground)/0.25)]",
          "dark:bg-foreground dark:text-background dark:shadow-[inset_0_1px_0_0_hsl(var(--background)/0.5),0_1px_3px_0_rgb(0_0_0/0.4)]",
          "dark:hover:shadow-[inset_0_1px_0_0_hsl(var(--background)/0.5),0_6px_18px_-2px_rgb(0_0_0/0.5)]"
        ].join(" "),
        accent: [
          "text-white bg-gradient-to-b from-[hsl(243_85%_64%)] to-[hsl(243_75%_56%)]",
          "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18),0_1px_2px_0_hsl(243_75%_45%/0.4),0_0_0_1px_hsl(243_70%_45%/0.2)]",
          "hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.22),0_6px_20px_-2px_hsl(243_75%_50%/0.55),0_0_0_1px_hsl(243_70%_45%/0.3)]"
        ].join(" "),
        destructive: [
          "text-white bg-gradient-to-b from-[hsl(0_75%_58%)] to-[hsl(0_72%_50%)]",
          "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18),0_1px_2px_0_hsl(0_72%_40%/0.4)]",
          "hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.22),0_6px_18px_-2px_hsl(0_72%_45%/0.5)]"
        ].join(" "),
        outline: [
          "border border-border bg-surface text-foreground",
          "shadow-[0_1px_2px_0_hsl(var(--foreground)/0.04)]",
          "hover:border-border-strong hover:bg-muted/40",
          "dark:bg-surface-raised dark:hover:bg-surface-overlay"
        ].join(" "),
        secondary: [
          "bg-muted text-foreground border border-border-subtle",
          "hover:bg-secondary hover:border-border"
        ].join(" "),
        ghost: "text-foreground/80 hover:bg-muted hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        xl: "h-12 rounded-lg px-7 text-md",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-md"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
