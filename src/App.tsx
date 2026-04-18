import { useEffect, useState } from "react";
import OverlayView from "./components/OverlayView";
import SettingsView from "./components/SettingsView";
import SetupView from "./components/SetupView";
import { useGlobalAppearance } from "./hooks/useGlobalAppearance";
import { getApi } from "./lib/ipc";

export default function App() {
  const [route, setRoute] = useState<"overlay" | "settings" | "setup">("overlay");

  // Apply global appearance settings on app startup
  useGlobalAppearance();

  useEffect(() => {
    const api = getApi();
    if (api?.platform) {
      document.documentElement.setAttribute("data-platform", api.platform);
    }
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "/settings") setRoute("settings");
    else if (hash === "/setup") setRoute("setup");
    else setRoute("overlay");
  }, []);

  if (route === "settings") return <SettingsView />;
  if (route === "setup") return <SetupView />;
  return <OverlayView />;
}
