import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Settings — ZapBot",
    description: "Configure your ZapBot account, bots, and integrations.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
