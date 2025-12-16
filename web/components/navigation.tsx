"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/create", label: "Create", icon: "✨" },
    { href: "/library", label: "Library", icon: "📚" },
    { href: "/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-purple-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform duration-200">🎬</span>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                AI Video Studio
              </span>
            </Link>
            <div className="hidden md:flex gap-2">
              {links.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={pathname === link.href ? "default" : "ghost"}
                    className={
                      pathname === link.href
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/25"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }
                  >
                    <span className="mr-1.5">{link.icon}</span>
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={
                    pathname === link.href
                      ? "bg-purple-600/50 text-white"
                      : "text-white/60"
                  }
                >
                  <span className="text-lg">{link.icon}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
