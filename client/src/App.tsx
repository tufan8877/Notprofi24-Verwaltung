import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import PropertyManagers from "@/pages/PropertyManagers";
import PrivateCustomers from "@/pages/PrivateCustomers";
import Companies from "@/pages/Companies";
import Invoices from "@/pages/Invoices";
import Settings from "@/pages/Settings";
import { SidebarLayout } from "@/components/SidebarLayout";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarLayout>
      <Component />
    </SidebarLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes */}
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/jobs">
        {() => <ProtectedRoute component={Jobs} />}
      </Route>
      <Route path="/property-managers">
        {() => <ProtectedRoute component={PropertyManagers} />}
      </Route>
      <Route path="/private-customers">
         {() => <ProtectedRoute component={PrivateCustomers} />}
      </Route>
      <Route path="/companies">
         {() => <ProtectedRoute component={Companies} />}
      </Route>
      <Route path="/invoices">
         {() => <ProtectedRoute component={Invoices} />}
      </Route>
      <Route path="/settings">
         {() => <ProtectedRoute component={Settings} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
