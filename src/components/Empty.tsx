import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Empty component
export function Empty() {
  const handleClick = () => toast('Coming soon');

  return (
    <button
      type="button"
      className={cn(
        'flex h-full items-center justify-center bg-transparent border-none text-inherit cursor-pointer',
      )}
      onClick={handleClick}
    >
      Empty
    </button>
  );
}
