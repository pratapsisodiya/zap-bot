import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Action Items — ZapBot",
    description: "Track and manage action items extracted from your meetings.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
