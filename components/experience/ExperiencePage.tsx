import { useEffect } from "react";
import styles from "./Experience.module.scss";
import uiStore from "@store/ui";
import Company from "@components/company";
import { companies } from "@content/index";

const ExperiencePage = () => {
  useEffect(() => {
    uiStore.setActivePage("experience");
    return () => {
      uiStore.setActivePage("");
    };
  }, []);
  return (
    <div className={styles.experience}>
      <div className={styles.companies}>
        {companies.map((item, idx) => (
          <Company company={item} key={item.name} index={idx + 1} />
        ))}
      </div>
    </div>
  );
};

export default ExperiencePage;
