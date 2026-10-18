import type { Metadata } from "next";
import Script from "next/script";
import StyleLoader from "./components/StyleLoader";
import ScriptInitializer from "./components/ScriptInitializer";
import ThemeProvider from "./components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loopora",
  description: "Loopora makes shopping across merchants simple, personalized, and intelligent.",
  icons: {
    icon: "/images/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var allowed=['daylight','ocean','meadow','lavender','midnight'];var t=localStorage.getItem('app-theme')||'daylight';if(!allowed.includes(t)){t='daylight';localStorage.setItem('app-theme',t);}var dark=(t==='midnight');document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-bs-theme',dark?'dark':'light');}catch(e){}})();`}
        </Script>

        <link rel="stylesheet" href="/vendor/magnific-popup/magnific-popup.min.css" />
        <link rel="stylesheet" href="/vendor/bootstrap-select/dist/css/bootstrap-select.min.css" />
        <link rel="stylesheet" href="/vendor/swiper/swiper-bundle.min.css" />
        <link rel="stylesheet" href="/vendor/animate/animate.css" />
        <link rel="stylesheet" href="/vendor/lightgallery/dist/css/lightgallery.css" />
        <link rel="stylesheet" href="/vendor/lightgallery/dist/css/lg-thumbnail.css" />
        <link rel="stylesheet" href="/vendor/lightgallery/dist/css/lg-zoom.css" />
        <link rel="stylesheet" href="/vendor/nouislider/nouislider.min.css" />
        <link rel="stylesheet" href="/css/style.css" />
        <link rel="stylesheet" href="/css/skin/skin-1.css" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Roboto:wght@100;300;400;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <StyleLoader />
        <ScriptInitializer />
        <ThemeProvider />
        {children}

        <Script src="/js/jquery.min.js" strategy="beforeInteractive" />
        <Script src="/vendor/bootstrap/dist/js/bootstrap.bundle.min.js" strategy="beforeInteractive" />
        <Script src="/vendor/bootstrap-select/dist/js/bootstrap-select.min.js" strategy="beforeInteractive" />
        <Script src="/vendor/wow/wow.min.js" strategy="lazyOnload" />
        <Script src="/vendor/bootstrap-touchspin/bootstrap-touchspin.js" strategy="lazyOnload" />
        <Script src="/vendor/swiper/swiper-bundle.min.js" strategy="lazyOnload" />
        <Script src="/vendor/magnific-popup/magnific-popup.js" strategy="lazyOnload" />
        <Script src="/vendor/imagesloaded/imagesloaded.js" strategy="lazyOnload" />
        <Script src="/vendor/masonry/masonry-4.2.2.js" strategy="lazyOnload" />
        <Script src="/vendor/masonry/isotope.pkgd.min.js" strategy="lazyOnload" />
        <Script src="/vendor/countdown/jquery.countdown.js" strategy="lazyOnload" />
        <Script src="/vendor/wnumb/wNumb.js" strategy="lazyOnload" />
        <Script src="/vendor/nouislider/nouislider.min.js" strategy="lazyOnload" />
        <Script src="/js/dz.carousel.js" strategy="lazyOnload" />
        <Script src="/vendor/lightgallery/dist/lightgallery.min.js" strategy="lazyOnload" />
        <Script src="/vendor/group-slide/group-loop.js" strategy="lazyOnload" />
        <Script src="/vendor/lightgallery/dist/plugins/thumbnail/lg-thumbnail.min.js" strategy="lazyOnload" />
        <Script src="/vendor/lightgallery/dist/plugins/zoom/lg-zoom.min.js" strategy="lazyOnload" />
        <Script src="/js/dz.ajax.js" strategy="lazyOnload" />
        <Script src="/js/custom.min.js" strategy="lazyOnload" />

        <Script id="remove-template-promos" strategy="lazyOnload">
          {`
            const removeTemplatePromos = () => {
              document.querySelectorAll('.DZ-bt-support-now, .DZ-bt-buy-now').forEach((el) => el.remove());
            };
            removeTemplatePromos();
            setTimeout(removeTemplatePromos, 500);
            setTimeout(removeTemplatePromos, 1500);
          `}
        </Script>
      </body>
    </html>
  );
}
