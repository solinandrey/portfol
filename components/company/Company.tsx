import Tag from "@components/tag";
import styles from "./Company.module.scss";
import { CompanyItem } from "@interfaces/index";
import { useState } from "react";
import AnimateHeight from "react-animate-height";

interface Props {
  company: CompanyItem;
  index: number;
}

const Company = ({ company, index }: Props) => {
  return (
    <div className={styles.company}>
      <div className={styles.year}>{company.year}</div>
      <div className={styles.name}>{company.name}</div>
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
