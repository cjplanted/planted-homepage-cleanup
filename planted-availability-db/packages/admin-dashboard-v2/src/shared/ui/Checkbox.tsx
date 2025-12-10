import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, onCheckedChange, onChange, ...props }, ref) => {
    const checkboxId = React.useId();
    const id = props.id || checkboxId;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <div className="flex items-center space-x-2">
        <div className="relative inline-flex">
          <input
            type="checkbox"
            id={id}
            ref={ref}
            onChange={handleChange}
            className={cn(
              'peer h-4 w-4 shrink-0 rounded border border-input bg-background',
              'checked:bg-primary checked:border-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'cursor-pointer',
              className
            )}
            {...props}
          />
          <Check
            className={cn(
              'pointer-events-none absolute left-0.5 top-0.5 h-3 w-3 text-primary-foreground opacity-0',
              'peer-checked:opacity-100'
            )}
          />
        </div>
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
