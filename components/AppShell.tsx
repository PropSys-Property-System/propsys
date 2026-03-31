'use client';

import React from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { UserRole } from '@/lib/types';
import { 
  LayoutDashboard, 
  Receipt, 
  LogOut, 
  Menu, 
  User,
  Building2,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STAFF'] },
  { label: 'Recibos', href: '/admin/receipts', icon: Receipt, roles: ['ADMIN', 'STAFF'] },
  { label: 'Mis Recibos', href: '/resident/receipts', icon: Receipt, roles: ['RESIDENT', 'OWNER'] },
  { label: 'Edificios', href: '/admin/buildings', icon: Building2, roles: ['ADMIN'] },
  { label: 'Usuarios', href: '/admin/users', icon: Users, roles: ['ADMIN'] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const filteredNav = NAV_ITEMS.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-100">
            <h1 className="text-2xl font-bold text-primary">PropSys</h1>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  pathname === item.href 
                    ? "bg-primary text-white" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center px-4 py-3 mb-4 rounded-lg bg-slate-50">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:hidden">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-md"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-primary">PropSys</h1>
          <div className="w-10" /> {/* Placeholder for symmetry */}
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
