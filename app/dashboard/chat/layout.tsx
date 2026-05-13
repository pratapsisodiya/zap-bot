import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "AI Chat — ZapBot",
    description: "Ask questions about your meetings using ZapBot AI.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
