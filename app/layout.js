import "./globals.css";

export const metadata = {
  title: "PerpCopilot",
  description: "AI trading copilot for Pacifica perpetual futures traders",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
