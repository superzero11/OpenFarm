"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva(
    "inline-flex items-center text-muted-foreground",
    {
        variants: {
            variant: {
                default: "h-10 justify-center rounded-md bg-muted p-1",
                underline: "h-auto w-full justify-start gap-6 border-b bg-transparent p-0",
            },
        },
        defaultVariants: { variant: "default" },
    }
);

const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
        VariantProps<typeof tabsListVariants>
>(({ className, variant, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
    />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const tabsTriggerVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "rounded-sm px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                underline:
                    "gap-2 rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:text-foreground",
            },
        },
        defaultVariants: { variant: "default" },
    }
);

const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
        VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(tabsTriggerVariants({ variant }), className)}
        {...props}
    />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
        )}
        {...props}
    />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
