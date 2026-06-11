'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-12', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 -translate-y-1/2 right-1.5 size-7 p-0 flex items-center justify-center hover:bg-transparent"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="size-4 text-zinc-400" />
        ) : (
          <Eye className="size-4 text-zinc-400" />
        )}
      </Button>
    </div>
  );
}

export { PasswordInput };
