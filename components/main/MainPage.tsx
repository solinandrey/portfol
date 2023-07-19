import styles from "./MainPage.module.scss";
import LinkItem from "@components/link";
import { links } from "@content/index";
import Switcher from "@components/switcher";
import { useRef } from "react";

const MainPage = () => {

  const pageRef = useRef(null);
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
      {/* <Switcher label='go to projects' link='/projects' ref={pageRef}/> */}
    </div>
  );
};

export default MainPage;
