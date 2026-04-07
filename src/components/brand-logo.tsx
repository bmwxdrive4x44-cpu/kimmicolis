import { Package } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type BrandLogoVariant = 'default' | 'dark' | 'branded';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  href?: string;
}

const wordmarkVariants: Record<BrandLogoVariant, { swift: string; colis: string }> = {
  default:  { swift: 'bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent', colis: 'text-gray-800 dark:text-white' },
  dark:     { swift: 'bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent', colis: 'text-white' },
  branded:  { swift: 'bg-gradient-to-r from-emerald-100 to-teal-100 bg-clip-text text-transparent', colis: 'text-white' },
};

export function BrandLogo({ variant = 'default', className, href = '/' }: BrandLogoProps) {
  const { swift, colis } = wordmarkVariants[variant];

  return (
    <Link
      href={href as '/'}
      className={cn('flex items-center gap-2.5 group', className)}
    >
      <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20 transition-shadow group-hover:shadow-emerald-500/40">
        <Package className="h-5 w-5 text-white" strokeWidth={2.2} />
      </div>
      <span className={cn('text-[1.1rem] font-extrabold tracking-tight', swift)}>
        Swift<span className={colis}>Colis</span>
      </span>
    </Link>
  );
}
