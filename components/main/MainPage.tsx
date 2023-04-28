import styles from "./MainPage.module.scss";
import LinkItem from "@components/link";
import { links } from "@content/index";
import ui from "@store/ui";

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
      <div className={styles.links}>
        {links.map((item, idx) => {
          return (
            <LinkItem
              image={item.image}
              link={item.link}
              key={idx + "soclink"}
            />
          );
        })}
        
      </div>
    </div>
  );
};

export default MainPage;
