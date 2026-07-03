import "./globals.css";

export const metadata = {
  title: "Moon Explorer",
  description: "Interactive moon GLB viewer with latitude and pole guides."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
