import type { Metadata, Viewport } from "next";
import { Noto_Sans_Mono } from "next/font/google";
import { PwaRegistration } from "@/components/PwaRegistration";
import "katex/dist/katex.min.css";
import "./globals.css";

const notoSansMono = Noto_Sans_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-noto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nova Lab",
  description: "Nova Lab workspace",
  applicationName: "Nova Lab",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/nova-lab.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/nova-lab.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nova Lab",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" translate="no" className={`${notoSansMono.variable} notranslate`} suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pi-theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`,
          }}
        />
        {process.env.NODE_ENV !== "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){if(!("serviceWorker" in navigator))return;var k="nova-dev-sw-cleanup";Promise.all([navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}),("caches" in window)?caches.keys().then(function(ks){return Promise.all(ks.filter(function(x){return x.indexOf("nova-lab-")===0||x.indexOf("pi-web-")===0}).map(function(x){return caches.delete(x)}))}):Promise.resolve()]).then(function(){if(navigator.serviceWorker.controller&&sessionStorage.getItem(k)!=="1"){sessionStorage.setItem(k,"1");location.reload()}else{sessionStorage.removeItem(k)}})})();`,
            }}
          />
        )}
      </head>
      <body translate="no" className="notranslate">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
