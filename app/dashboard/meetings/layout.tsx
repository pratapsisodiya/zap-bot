import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Meeting History — ZapBot",
    description: "Browse, manage, and review all your recorded meetings.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
