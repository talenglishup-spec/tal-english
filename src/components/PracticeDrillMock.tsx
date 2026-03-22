import React from 'react';
import styles from './PracticeDrillMock.module.css';

const PracticeDrillMock: React.FC = () => {
  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.closeButton}>✕</div>
        <div className={styles.progressBar}>
          <div className={`${styles.progressSegment} ${styles.active}`}></div>
          <div className={`${styles.progressSegment} ${styles.active}`}></div>
          <div className={`${styles.progressSegment} ${styles.active}`}></div>
          <div className={`${styles.progressSegment} ${styles.active}`}></div>
          <div className={`${styles.progressSegment} ${styles.active}`}></div>
        </div>
        <div className={styles.practiceLabel}>연습</div>
      </div>

      {/* Main Content Card */}
      <div className={styles.card}>
        <div className={styles.stepPill}>STEP 3 / 3</div>
        
        <h1 className={styles.mainSentence}>
          When you keep a clean sheet, you have a good chance of winning.
        </h1>

        <button className={styles.viewQuestionButton}>
          <span>+ 질문 보기</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button className={styles.listenButton}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          <span>질문 듣기</span>
        </button>

        <div className={styles.micButtonArea}>
          <div className={styles.micCircle}>
            <svg className={styles.micIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </div>
          <span className={styles.micLabel}>눌러서 말하기</span>
        </div>
      </div>
    </div>
  );
};

export default PracticeDrillMock;
