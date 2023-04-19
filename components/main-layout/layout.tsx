import styles from './Layout.module.scss';

import Navigation from '../navigation/Navigation';

export default function Layout({ children }: any) {
  return (
    <div className={styles.mainLayout}>
      <main className={styles.leftSide}>{children}</main>
      <div className={styles.rightSide}>
        <div className={styles.rightTop}>
          <Navigation />
        </div>
        <div className={styles.rightBottom}></div>
      </div>
    </div>
    
  );
}
