import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Swords, 
  Store, 
  Trophy, 
  ShieldAlert, 
  Database,
  Crosshair,
  Castle,
  Gavel,
  ChevronDown,
  ChevronRight,
  Globe,
  Zap,
  BarChart3,
  Settings2,
  Wand2,
  CalendarDays,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavCategory {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "World",
    icon: Globe,
    items: [
      { href: "/players", label: "Players", icon: Users },
      { href: "/characters", label: "Characters", icon: Swords },
      { href: "/guilds", label: "Guilds", icon: Castle },
    ],
  },
  {
    label: "Combat",
    icon: Zap,
    items: [
      { href: "/battles", label: "Battles", icon: Crosshair },
      { href: "/bosses", label: "Bosses", icon: ShieldAlert },
      { href: "/tournaments", label: "Tournaments", icon: Trophy },
    ],
  },
  {
    label: "Events & Quests",
    icon: CalendarDays,
    items: [
      { href: "/events", label: "Events", icon: CalendarDays },
    ],
  },
  {
    label: "Economy",
    icon: Store,
    items: [
      { href: "/market", label: "Market", icon: Store },
    ],
  },
  {
    label: "Stats",
    icon: BarChart3,
    items: [
      { href: "/leaderboard", label: "Leaderboard", icon: Database },
    ],
  },
  {
    label: "Admin",
    icon: Settings2,
    items: [
      { href: "/admin", label: "Admin Console", icon: Gavel },
      { href: "/update-maker", label: "Update Maker", icon: Wand2 },
    ],
  },
];

function isCategoryActive(category: NavCategory, location: string) {
  return category.items.some(
    (item) => location === item.href || location.startsWith(`${item.href}/`)
  );
}

function NavCategorySection({
  category,
  location,
}: {
  category: NavCategory;
  location: string;
}) {
  const active = isCategoryActive(category, location);
  const [open, setOpen] = useState(active);
  const CategoryIcon = category.icon;

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors",
          active
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
      >
        <span className="flex items-center gap-2">
          <CategoryIcon className="w-3.5 h-3.5" />
          {category.label}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        )}
      </button>

      {open && (
        <div className="ml-3 border-l border-border pl-2 space-y-0.5">
          {category.items.map((item) => {
            const isActive =
              location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      <aside className="w-60 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Swords className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight text-lg uppercase">
              AMA Admin
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navCategories.map((category) => (
              <NavCategorySection
                key={category.label}
                category={category}
                location={location}
              />
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
