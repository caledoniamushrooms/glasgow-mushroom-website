import * as React from "react"

import { cn } from "@/lib/utils"
import { badgeVariants } from "@/lib/badge-variants"

function Badge({ className, variant, ...props }) {
  return (
    <div 
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)} 
      {...props} 
    />
  )
}

export { Badge }