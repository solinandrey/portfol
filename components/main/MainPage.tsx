import styles from "./MainPage.module.scss";
import ProjectsBlock from "@components/projects-block";

const MainPage = () => {
  return (
    <div className={styles.main}>
      <div className={styles.greeting}>
        Hi, I’m Andrey
        <br />
        Frontend Developer
        <br />
        based in tbilisi
      </div>
    </div>
  );
};

export default MainPage;
