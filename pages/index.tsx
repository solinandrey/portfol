import { useEffect } from "react";
import MainPage from "../components/main/MainPage";
import uiStore from '@store/ui'

export default function Home() {
  useEffect(() => {
    uiStore.setActivePage('home');
    return () => {
      uiStore.setActivePage('');
    }
  }, [])
  return <MainPage />;
}
