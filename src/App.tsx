import { useEffect, useState } from "react";
import OverlayView from "./components/OverlayView";
import SettingsView from "./components/SettingsView";
import { useGlobalAppearance } from "./hooks/useGlobalAppearance";

type Route = "overlay" | "settings";

function readRoute(): Route {
  const hash = window.location.hash.replace("#", "");
  if (hash === "/settings") return "settings";
  return "overlay";
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);

  useGlobalAppearance();

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route === "settings") return <SettingsView />;
  return <OverlayView />;
}
