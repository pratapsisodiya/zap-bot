import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Calendar — ZapBot",
    description: "View and manage your upcoming meetings and schedule.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
