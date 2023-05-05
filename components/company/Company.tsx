import Tag from "@components/tag";
import styles from "./Company.module.scss";
import { CompanyItem } from "@interfaces/index";
import ui from "@store/ui";
interface Props {
  company: CompanyItem;
  index: number;
}

const Company = ({ company, index }: Props) => {

  const onHover = (mode: boolean) => {
    ui.setCursorHoverMode(mode);
  };
  
  return (
    <div className={styles.company}>
      <div className={styles.year}>{company.year}</div>
      <a
        href={company.link}
        className={styles.name}
        target="_blank"
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        {company.name}
      </a>
      <div className={styles.description}>{company.description}</div>
      <div
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: company.fullDesc || "" }}
      ></div>
      <div className={styles.tech}>
        {company.tags?.map((tag) => {
          return <Tag tag={tag} key={tag + index} noHover />;
        })}
      </div>
    </div>
  );
};

export default Company;
