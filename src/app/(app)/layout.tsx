import BottomNav from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main style={{ paddingBottom: '70px' }}>
        {children}
      </main>
      <BottomNav />
    </>
  );
}
