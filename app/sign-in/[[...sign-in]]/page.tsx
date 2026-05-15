"use client";

import { motion } from "framer-motion";
import { SignIn } from "@clerk/nextjs";
import { Zap, Sparkles, ShieldCheck, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Figtree:wght@300;400;500;600;700;800;900&display=swap');

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }

:root {
  --bg:        #FFFFFF;
  --bg-soft:   #F8F8F7;
  --bg-card:   #FFFFFF;
  --text:      #111111;
  --text-2:    #4B5563;
  --text-3:    #9CA3AF;
  --border:    rgba(0,0,0,0.07);
  --border-2:  rgba(0,0,0,0.13);
  --accent:    #2563EB;
  --accent-2:  #1D4ED8;
  --accent-bg: #EEF4FF;
  --success:   #059669;
  --r:         16px;
  --sh:        0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05);
  --sh-lg:     0 8px 32px rgba(0,0,0,0.09);
}

html,body { height:100%; }
body {
  font-family:'Figtree',sans-serif;
  background:var(--bg); color:var(--text);
  -webkit-font-smoothing:antialiased;
}

.serif-i { font-family:'Instrument Serif',serif; font-style:italic; }
.g-blue {
  background:linear-gradient(120deg,#2563EB,#7C3AED);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}

.pill-badge {
  display:inline-flex; align-items:center; gap:6px;
  background:var(--accent-bg); border:1px solid rgba(37,99,235,0.2);
  border-radius:999px; padding:5px 14px;
  font-size:11px; font-weight:700; color:var(--accent-2);
  letter-spacing:.04em; text-transform:uppercase;
}

.auth-card {
  background:#fff;
  border:1px solid var(--border-2);
  border-radius:24px;
  box-shadow:0 4px 6px rgba(0,0,0,0.02), 0 20px 60px rgba(0,0,0,0.07);
  padding:40px 40px 36px;
  width:100%; max-width:440px;
}

.trust-badge {
  display:inline-flex; align-items:center; gap:6px;
  font-size:11px; font-weight:700; color:var(--text-3);
  letter-spacing:.06em; text-transform:uppercase;
}

/* Clerk overrides — strip default card chrome */
.cl-rootBox { width:100% !important; }
.cl-card {
  box-shadow:none !important;
  border:none !important;
  padding:0 !important;
  background:transparent !important;
  border-radius:0 !important;
}
.cl-headerTitle, .cl-headerSubtitle { display:none !important; }
.cl-socialButtonsBlockButton {
  border-radius:12px !important;
  border:1px solid var(--border-2) !important;
  font-weight:600 !important;
  font-family:'Figtree',sans-serif !important;
  transition:all .15s !important;
}
.cl-socialButtonsBlockButton:hover { background:var(--bg-soft) !important; }
.cl-formButtonPrimary {
  background:var(--text) !important;
  border-radius:10px !important;
  font-family:'Figtree',sans-serif !important;
  font-weight:700 !important;
  box-shadow:0 2px 8px rgba(0,0,0,0.18) !important;
  transition:opacity .15s !important;
}
.cl-formButtonPrimary:hover { opacity:.88 !important; }
.cl-formFieldInput {
  border-radius:10px !important;
  border:1px solid var(--border-2) !important;
  font-family:'Figtree',sans-serif !important;
  transition:border-color .15s, box-shadow .15s !important;
}
.cl-formFieldInput:focus {
  border-color:var(--accent) !important;
  box-shadow:0 0 0 3px rgba(37,99,235,0.12) !important;
}
.cl-footerActionLink { color:var(--accent) !important; font-weight:700 !important; }
.cl-dividerText {
  color:var(--text-3) !important;
  font-weight:700 !important;
  letter-spacing:.1em !important;
  text-transform:uppercase !important;
  font-size:10px !important;
}
.cl-formFieldLabel {
  color:var(--text) !important;
  font-weight:600 !important;
  font-size:13px !important;
  font-family:'Figtree',sans-serif !important;
}
`;

export default function SignInPage() {
  return (
    <>
      <style>{CSS}</style>
      <div style={{
        minHeight:"100vh", background:"var(--bg)",
        display:"flex", flexDirection:"column",
        position:"relative", overflow:"hidden"
      }}>

        {/* Dot grid */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          backgroundImage:"radial-gradient(circle,rgba(0,0,0,0.07) 1px,transparent 1px)",
          backgroundSize:"22px 22px", opacity:.5
        }} />
        {/* Blue radial glow */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 60% 50% at 50% 0%, rgba(37,99,235,0.07) 0%, transparent 70%)"
        }} />

        {/* Navbar */}
        <nav style={{
          position:"relative", zIndex:10,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"20px 32px", borderBottom:"1px solid var(--border)",
          background:"rgba(255,255,255,0.8)", backdropFilter:"blur(12px)"
        }}>
          <Link href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
            <div style={{
              width:32, height:32, borderRadius:10,
              background:"var(--text)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 2px 10px rgba(0,0,0,0.2)"
            }}>
              <Zap size={16} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontSize:18, fontWeight:800, letterSpacing:"-.02em", color:"var(--text)" }}>ZapBot</span>
          </Link>
          <Link href="/" style={{
            display:"inline-flex", alignItems:"center", gap:7,
            fontSize:13, fontWeight:600, color:"var(--text-2)",
            textDecoration:"none",
            border:"1px solid var(--border-2)", borderRadius:999,
            padding:"7px 16px", background:"var(--bg-card)",
            boxShadow:"var(--sh)", transition:"all .15s"
          }}>
            <ArrowLeft size={13} /> Back to site
          </Link>
        </nav>

        {/* Main content */}
        <main style={{
          flex:1, display:"flex", alignItems:"center", justifyContent:"center",
          padding:"48px 24px 64px", position:"relative", zIndex:1
        }}>
          <motion.div
            initial={{ opacity:0, y:24 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:.6, ease:[.16,1,.3,1] }}
            style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:28 }}
          >
            {/* Heading above card */}
            <div style={{ textAlign:"center" }}>
              <motion.div
                initial={{ opacity:0, scale:.9 }}
                animate={{ opacity:1, scale:1 }}
                transition={{ delay:.05 }}
                style={{ display:"flex", justifyContent:"center", marginBottom:18 }}
              >
                <span className="pill-badge"><Sparkles size={11} /> Welcome back</span>
              </motion.div>
              <h1 style={{
                fontSize:40, fontWeight:400, letterSpacing:"-.04em",
                lineHeight:1.1, fontFamily:"'Instrument Serif',serif",
                color:"var(--text)", marginBottom:10
              }}>
                Sign in to{" "}
                <span className="serif-i g-blue">ZapBot</span>
              </h1>
              <p style={{ fontSize:16, color:"var(--text-2)", fontWeight:400 }}>
                Your AI meeting assistant is waiting.
              </p>
            </div>

            {/* Auth card */}
            <motion.div
              className="auth-card"
              initial={{ opacity:0, y:16 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay:.12, duration:.5, ease:[.16,1,.3,1] }}
            >
              <SignIn
                appearance={{
                  elements: {
                    rootBox: "cl-rootBox",
                    card: "cl-card",
                    headerTitle: "cl-headerTitle",
                    headerSubtitle: "cl-headerSubtitle",
                    socialButtonsBlockButton: "cl-socialButtonsBlockButton",
                    formButtonPrimary: "cl-formButtonPrimary",
                    formFieldInput: "cl-formFieldInput",
                    footerActionLink: "cl-footerActionLink",
                    dividerText: "cl-dividerText",
                    formFieldLabel: "cl-formFieldLabel",
                  }
                }}
              />
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              transition={{ delay:.35 }}
              style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap", justifyContent:"center" }}
            >
              <span className="trust-badge">
                <ShieldCheck size={13} color="#059669" /> SOC2 Certified
              </span>
              <span style={{ width:1, height:12, background:"var(--border-2)" }} />
              <span className="trust-badge">
                <Lock size={13} color="var(--accent)" /> End-to-End Encrypted
              </span>
              <span style={{ width:1, height:12, background:"var(--border-2)" }} />
              <span className="trust-badge">
                <Zap size={13} color="#D97706" /> 50K+ Teams
              </span>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </>
  );
}
