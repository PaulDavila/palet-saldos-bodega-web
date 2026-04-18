import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventario — saldos bodega",
  description: "Consulta por referencia y actualización de inventario",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
