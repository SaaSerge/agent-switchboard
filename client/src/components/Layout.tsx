import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  ShieldAlert, 
  History, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/requests", label: "Requests", icon: ShieldAlert },
    { href: "/agents", label: "Agents", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/audit", label: "Audit Logs", icon: History },
  ];

  const NavLink = ({ item, mobile = false }: { item: typeof navItems[0], mobile?: boolean }) => {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    return (
      <Link 
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group font-medium",
          isActive 
            ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-5px_hsl(var(--primary))]" 
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
          mobile && "text-base py-4"
        )}
        onClick={() => mobile && setIsMobileMenuOpen(false)}
      >
        <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0 p-4">
        <div className="mb-8 px-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">AgentSw</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-10 font-mono">Control Plane v1.0</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-border">
          <div className="px-3 mb-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-mono text-xs">
              {user?.username?.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">AgentSw</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-background z-40 p-4 animate-in fade-in slide-in-from-top-10">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} mobile />
            ))}
            <button 
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3 py-4 text-base text-destructive hover:bg-destructive/10 rounded-lg transition-colors mt-8 border-t border-border"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background/50 relative">
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 min-h-full">
          {children}
        </div>
        
        {/* Decorative Grid Background */}
        <div className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.02]" 
          style={{ 
            backgroundImage: `linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} 
        />
      </main>
    </div>
  );
}
