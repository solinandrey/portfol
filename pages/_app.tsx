import type { ReactElement, ReactNode } from "react";

import "../styles/globals.scss";
import type { AppProps } from "next/app";
import "@fontsource/inter/200.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/500.css";
import Cursor from "../components/cursor";
import Layout from "@components/main-layout/layout";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";

const MyApp = ({ Component, pageProps }: AppProps) => {
  // const { global } = pageProps;
  
  return (
    <>
      <AnimatePresence
        mode="wait"
        initial={false}
        onExitComplete={() => {
          // if (typeof window !== "undefined") {
          //   window.scrollTo({ top: 0 });
          // }
        }}
      >
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
