import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Analytics — ZapBot",
    description: "View meeting activity, bot performance, and AI processing stats.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
