'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  LayoutDashboard,
  Receipt,
  LogOut,
  Menu,
  User,
  Building2,
  Users,
  ClipboardList,
  CalendarDays,
  Wrench,
  Megaphone,
  Home,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { UserRole } from '@/lib/types';
import { labelInternalRole, labelWorkspaceArea } from '@/lib/presentation/labels';

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
  { label: 'Panel', href: '/admin/dashboard', icon: LayoutDashboard, roles: ['MANAGER', 'BUILDING_ADMIN'] },
  { label: 'Recibos', href: '/admin/receipts', icon: Receipt, roles: ['MANAGER', 'BUILDING_ADMIN'] },
  { label: 'Personal', href: '/admin/staff', icon: Users, roles: ['MANAGER', 'BUILDING_ADMIN'] },
  { label: 'Tareas', href: '/admin/tasks', icon: ClipboardList, roles: ['MANAGER', 'BUILDING_ADMIN'] },
  { label: 'Incidencias', href: '/admin/tickets', icon: Wrench, roles: ['MANAGER', 'BUILDING_ADMIN'] },
  { label: 'Áreas comunes', href: '/admin/common-areas', icon: Home, roles: ['MANAGER', 'BUILDING_ADMIN'] },
  { label: 'Reservas', href: '/admin/reservations', icon: CalendarDays, roles: ['MANAGER', 'BUILDING_ADMIN'] },
  { label: 'Avisos', href: '/admin/notices', icon: Megaphone, roles: ['MANAGER', 'BUILDING_ADMIN'] },
  { label: 'Edificios', href: '/admin/buildings', icon: Building2, roles: ['MANAGER'] },
  { label: 'Usuarios', href: '/admin/users', icon: User, roles: ['MANAGER'] },
  { label: 'Mis tareas', href: '/staff/tasks', icon: ClipboardList, roles: ['STAFF'] },
  { label: 'Incidencias', href: '/staff/tickets', icon: Wrench, roles: ['STAFF'] },
  { label: 'Mis recibos', href: '/resident/receipts', icon: Receipt, roles: ['OWNER', 'TENANT'] },
  { label: 'Reservas', href: '/resident/reservations', icon: Home, roles: ['OWNER', 'TENANT'] },
  { label: 'Incidencias', href: '/resident/tickets', icon: Wrench, roles: ['OWNER', 'TENANT'] },
  { label: 'Avisos', href: '/resident/notices', icon: Megaphone, roles: ['OWNER', 'TENANT'] },
  { label: 'Mis unidades', href: '/resident/units', icon: Building2, roles: ['OWNER'] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const filteredNav = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));
  const workspaceArea = user ? labelWorkspaceArea(user) : null;
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-300 lg:relative lg:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 p-6">
            <h1 className="text-2xl font-bold text-primary">PropSys</h1>
            {workspaceArea && (
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{workspaceArea}</p>
            )}
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {filteredNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  pathname === item.href ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3">
              <div className="flex items-center">
                <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight text-slate-900">{user?.name}</p>
                </div>
              </div>

              {user && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    {labelInternalRole(user.internalRole)}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                await logout();
                router.replace('/');
                router.refresh();
              }}
              className="flex w-full items-center rounded-md px-4 py-2 font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="mr-3 h-5 w-5" />
              <span className="text-sm">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100">
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-primary">PropSys</h1>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
