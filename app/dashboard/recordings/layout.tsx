import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Recordings — ZapBot",
    description: "Access all your meeting recordings in one place.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
