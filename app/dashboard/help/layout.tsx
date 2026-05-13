import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Help & Support — ZapBot",
    description: "Get help, read docs, and contact ZapBot support.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
