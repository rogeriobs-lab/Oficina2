import { theme } from '@/src/lib/theme';
import { AlertCircle, Loader2, Inbox } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
      <Loader2 className="w-10 h-10 animate-spin" style={{ color: theme.primary }} />
      <p className="mt-4 text-sm" style={{ color: theme.textSecondary }}>
        Carregando...
      </p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
      <AlertCircle className="w-12 h-12 mb-3" style={{ color: theme.error }} />
      <p className="text-sm font-medium" style={{ color: theme.error }}>
        {message}
      </p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[250px] p-6 text-center bg-white rounded-xl border border-gray-100">
      <Inbox className="w-10 h-10 mb-3" style={{ color: theme.textMuted }} />
      <p className="text-sm" style={{ color: theme.textSecondary }}>
        {message}
      </p>
    </div>
  );
}
