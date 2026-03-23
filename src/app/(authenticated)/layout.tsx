import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationProvider } from "@/components/notification-provider";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4 lg:p-6 lg:pb-6">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </NotificationProvider>
  );
}
