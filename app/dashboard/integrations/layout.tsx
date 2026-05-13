import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Integrations — ZapBot",
    description: "Connect Slack, Google Calendar, and other tools to ZapBot.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
