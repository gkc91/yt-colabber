import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Web/PWA (E2): telefondan "ana ekrana ekle" ile açılabilsin, sekmede adı görünsün. */}
        <title>Clickable</title>
        <meta
          name="description"
          content="Test your thumbnail, title and first 60 seconds with real people in your niche before you publish."
        />
        <meta name="theme-color" content="#FAF9F7" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Kâğıt zemin ilk boyada da doğru olsun: uygulama yüklenirken beyaz parlamasın
// (DESIGN.md §3 paper/surface).
const responsiveBackground = `
body {
  background-color: #FAF9F7;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #0F1115;
  }
}`;
