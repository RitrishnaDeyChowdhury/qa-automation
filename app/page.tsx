import { QaDashboard } from "@/components/qa-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <>
      <div className="fixed right-5 top-5 z-40">
        <ThemeToggle />
      </div>
      <QaDashboard />
    </>
  );
}
