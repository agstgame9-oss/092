import { useParams, useLocation } from "wouter";
import { useGetGuild, getGetGuildQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Castle, Users, Coins, Trophy, Crown } from "lucide-react";
import { Link } from "wouter";

export default function GuildDetail() {
  const { id } = useParams();

  const { data, isLoading } = useGetGuild(Number(id), {
    query: {
      enabled: !!id,
      queryKey: getGetGuildQueryKey(Number(id))
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6 text-center py-12">
        <h2 className="text-2xl font-bold">Guild not found</h2>
        <Link href="/guilds">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Guilds
          </Button>
        </Link>
      </div>
    );
  }

  const { guild, members } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/guilds">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{guild.name}</h1>
            <span className="font-mono text-muted-foreground text-lg">[{guild.tag}]</span>
            {guild.isOpen ? (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">Open</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/20">Invite Only</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">Founded {new Date(guild.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Guild Level</CardTitle>
            <Castle className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{guild.level}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {guild.memberCount} <span className="text-muted-foreground text-lg font-normal">/ {guild.maxMembers}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Treasury</CardTitle>
            <Coins className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guild.treasury.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">War Wins</CardTitle>
            <Trophy className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guild.totalWins}</div>
            <p className="text-xs text-muted-foreground mt-1">Boss Kills: {guild.totalBossKills}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.discordId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.role === 'Leader' && <Crown className="w-4 h-4 text-yellow-500" />}
                        {member.username}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'Leader' ? 'default' : member.role === 'Officer' ? 'secondary' : 'outline'}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{member.contribution.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/players/${member.discordId}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
