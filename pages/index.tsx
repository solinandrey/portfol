import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import Layout from '../components/main-layout/layout';
import MainPage from '../components/main/MainPage';
import type { NextPageWithLayout } from './_app'

export default function Home() {
  return (
    <Layout>
        <MainPage />
    </Layout>
  )
}
