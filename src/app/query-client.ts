import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient global (composition root). Default `staleTime` di sini adalah
 * floor untuk semua query - hook per fitur boleh override (mis. `useCursorList`
 * memakai 30_000). `refetchOnWindowFocus: false` karena admin konsol tidak
 * butuh auto-refresh saat tab kembali fokus; ganti ke `true` kalau nanti
 * butuh data selalu segar di multi-tab.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});