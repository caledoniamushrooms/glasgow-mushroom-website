import { DayPicker } from 'react-day-picker'
import { cn } from '../../lib/cn'

type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center text-sm font-medium',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        button_previous: 'absolute left-1 top-0 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors hover:bg-accent hover:text-foreground h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        button_next: 'absolute right-1 top-0 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors hover:bg-accent hover:text-foreground h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center rounded-md',
        day_button: 'h-9 w-9 p-0 font-normal cursor-pointer rounded-md transition-colors hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground',
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground',
        today: '[&>button]:border [&>button]:border-primary [&>button]:font-semibold [&>button]:text-primary',
        outside: 'text-muted-foreground/50 [&>button]:cursor-default',
        disabled: 'text-muted-foreground opacity-50 [&>button]:cursor-not-allowed',
        hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  )
}

export { Calendar }
export type { CalendarProps }
