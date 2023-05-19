import type { ReactElement, ReactNode } from "react";
import { useEffect } from "react";
import "../styles/globals.scss";
import type { AppProps } from "next/app";
import "@fontsource/inter/200.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/500.css";
import Cursor from "../components/cursor";
import Layout from "@components/main-layout/layout";
import { AnimatePresence } from "framer-motion";
import Head from "next/head";
import favicon32 from "@images/favicon-32x32.png";
import favicon16 from "@images/favicon-16x16.png";
import appleTouch from "@images/apple-touch-icon.png";
import safariPinned from "@images/safari-pinned-tab.svg";
import me from '@images/me.jpg';

const MyApp = ({ Component, pageProps }: AppProps) => {
  // const { global } = pageProps;

  return (
    <>
      <Head>
        <title>Andrey Solin | Frontend Developer</title>
        <meta name="description" content="Frontend developer based in Tbilisi" key="desc" />
        <link rel="apple-touch-icon" sizes="180x180" href={appleTouch.src} />
        <link rel="icon" type="image/png" sizes="32x32" href={favicon32.src} />
        <link rel="icon" type="image/png" sizes="16x16" href={favicon16.src} />
        <link rel="mask-icon" href={safariPinned.src} color="#5bbad5" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-DFC1N99FRG"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-DFC1N99FRG')
        `,
          }}
        ></script>
         <meta
          property="og:image"
          content={me.src}
        />
      </Head>
      <AnimatePresence mode="wait" initial={false} onExitComplete={() => {}}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </AnimatePresence>
      <Cursor />
    </>
  );
};

// getInitialProps disables automatic static optimization for pages that don't
// have getStaticProps. So article, category and home pages still get SSG.
// Hopefully we can replace this with getStaticProps once this issue is fixed:
// https://github.com/vercel/next.js/discussions/10949
MyApp.getInitialProps = async (ctx: any) => {
  // // Calls page's `getInitialProps` and fills `appProps.pageProps`
  // const appProps = await App.getInitialProps(ctx);
  // // Fetch global site settings from Strapi

  // Pass the data to our page via props
  // return { ...appProps, pageProps: { global: globalRes.data } };
  return {};
};

export default MyApp;
