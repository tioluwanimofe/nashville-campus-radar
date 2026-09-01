import { Route, Switch } from "wouter";
import Index from "./pages/index";
import Feed from "./pages/feed";
import Admin from "./pages/admin";
import Manual from "./pages/manual";
import Submit from "./pages/submit";
import { Provider } from "./components/provider";
import { AgentFeedback } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/feed" component={Feed} />
        <Route path="/admin" component={Admin} />
        <Route path="/submit" component={Submit} />
        <Route path="/manual" component={Manual} />
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
    </Provider>
  );
}

export default App;
