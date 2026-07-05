import "./globals.css";

export const metadata = {
  title: "Moon Explorer",
  description: "Interactive moon GLB viewer with latitude and pole guides."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/moon.glb"
          as="fetch"
          crossOrigin="anonymous"
          type="model/gltf-binary"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
