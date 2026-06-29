import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

import Dashboard from "@/pages/dashboard";
import Players from "@/pages/players";
import PlayerDetail from "@/pages/players/detail";
import Characters from "@/pages/characters";
import Guilds from "@/pages/guilds";
import GuildDetail from "@/pages/guilds/detail";
import Battles from "@/pages/battles";
import Market from "@/pages/market";
import Tournaments from "@/pages/tournaments";
import Bosses from "@/pages/bosses";
import Leaderboard from "@/pages/leaderboard";
import Admin from "@/pages/admin";
import UpdateMaker from "@/pages/update-maker";
import Events from "@/pages/events";
import BugFixer from "@/pages/bug-fixer";
import AIEngineer from "@/pages/ai-engineer";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/players" component={Players} />
        <Route path="/players/:discordId" component={PlayerDetail} />
        <Route path="/characters" component={Characters} />
        <Route path="/guilds" component={Guilds} />
        <Route path="/guilds/:id" component={GuildDetail} />
        <Route path="/battles" component={Battles} />
        <Route path="/market" component={Market} />
        <Route path="/tournaments" component={Tournaments} />
        <Route path="/bosses" component={Bosses} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/admin" component={Admin} />
        <Route path="/events" component={Events} />
        <Route path="/update-maker" component={UpdateMaker} />
        <Route path="/bug-fixer" component={BugFixer} />
        <Route path="/ai-engineer" component={AIEngineer} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="anime-rpg-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
