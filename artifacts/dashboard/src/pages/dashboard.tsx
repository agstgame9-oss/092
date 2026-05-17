import { 
  useGetDashboardStats, 
  useGetDashboardActivity, 
  useGetDashboardCharts 
} from "@workspace/api-client-react";
import { 
  Users, 
  Swords, 
  Castle, 
  Store, 
  Coins, 
  ShieldBan, 
  Trophy,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  isLoading 
}: { 
  title: string; 
  value?: number | string; 
  icon: React.ElementType;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value?.toLocaleString() || 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: charts, isLoading: chartsLoading } = useGetDashboardCharts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
        <p className="text-muted-foreground mt-1">Real-time overview of the Multiverse Arena.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Players" 
          value={stats?.totalPlayers} 
          icon={Users} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Active Battles" 
          value={stats?.activeBattles} 
          icon={Swords} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Total Guilds" 
          value={stats?.totalGuilds} 
          icon={Castle} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Total Characters" 
          value={stats?.totalCharacters} 
          icon={Users} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Battles Today" 
          value={stats?.totalBattlesToday} 
          icon={Activity} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Market Listings" 
          value={stats?.marketListingsActive} 
          icon={Store} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Active Tourneys" 
          value={stats?.activeTournaments} 
          icon={Trophy} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Gold in Economy" 
          value={stats?.totalGoldInCirculation} 
          icon={Coins} 
          isLoading={statsLoading} 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartsLoading ? (
              <Skeleton className="w-full h-full" />
            ) : charts?.battlesPerDay ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.battlesPerDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="date" className="text-xs" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    name="Battles"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : activity?.map((item) => (
                <div key={item.id} className="flex items-center gap-4 text-sm">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-foreground">
                      <span className="font-medium">{item.playerUsername}</span> {item.description}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Battle Types</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartsLoading ? (
              <Skeleton className="w-full h-full" />
            ) : charts?.battleTypeDistribution ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.battleTypeDistribution} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
                  <XAxis type="number" className="text-xs" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis dataKey="type" type="category" className="text-xs" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--secondary))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  />
                  <Bar dataKey="count" name="Count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Character Rarity</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartsLoading ? (
              <Skeleton className="w-full h-full" />
            ) : charts?.topRarityDistribution ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.topRarityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="rarity"
                  >
                    {charts.topRarityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
