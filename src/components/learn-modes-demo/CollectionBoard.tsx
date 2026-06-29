'use client';

import React, { useState } from 'react';
import styles from './CollectionBoard.module.css';

interface CollectionBoardProps {
  pieces: Record<string, number>;
  unlockedCards: string[];
  roleModel: string;
  selectRoleModel: (id: string) => void;
  addPieces: (cardId: string, amount: number) => void;
}

const PLAYERS_POOL = [
  {
    id: 'sonny',
    name: '손흥민 (Son Heung-min)',
    club: '토트넘 홋스퍼',
    position: 'FW',
    backNumber: '7',
    colorTheme: 'linear-gradient(135deg, #132257, #1e3a8a)', // Dark Navy
    accentColor: '#fbbf24',
    bgImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop',
    signaturePhrase: "We keep pushing forward.",
  },
  {
    id: 'haaland',
    name: '엘링 홀란드 (Erling Haaland)',
    club: '맨체스터 시티',
    position: 'FW',
    backNumber: '9',
    colorTheme: 'linear-gradient(135deg, #6cabdd, #0072ff)', // Sky Blue
    accentColor: '#fff',
    bgImage: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=300&auto=format&fit=crop',
    signaturePhrase: "Feed me the ball!",
  },
  {
    id: 'pep',
    name: '펩 과르디올라 (Pep Guardiola)',
    club: '맨체스터 시티',
    position: 'Coach',
    backNumber: '4',
    colorTheme: 'linear-gradient(135deg, #1e293b, #0f172a)', // Tactical Slate Grey
    accentColor: '#10b981',
    bgImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=300&auto=format&fit=crop',
    signaturePhrase: "Keep the intensity high!",
  }
];

export default function CollectionBoard({ pieces, unlockedCards, roleModel, selectRoleModel, addPieces }: CollectionBoardProps) {
  const [showRoleModelModal, setShowRoleModelModal] = useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.topInfo}>
        <h3>🛡️ 내 영어 스쿼드 컬렉션</h3>
        <p>조각 30개를 다 모으면 롤 모델 선수의 한정판 카드가 완성됩니다!</p>
        
        <div className={styles.currentFocusBox}>
          <div>
            <span className={styles.focusLabel}>🎯 현재 집중 타겟 롤 모델:</span>
            <strong className={styles.focusName}>
              {PLAYERS_POOL.find(p => p.id === roleModel)?.name.split(' ')[0]}
            </strong>
          </div>
          <button className={styles.changeTargetBtn} onClick={() => setShowRoleModelModal(true)}>
            타겟 변경 🔄
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {PLAYERS_POOL.map((player) => {
          const pieceCount = pieces[player.id] || 0;
          const isUnlocked = unlockedCards.includes(player.id) || pieceCount >= 30;
          const isCurrentFocus = player.id === roleModel;

          return (
            <div 
              key={player.id} 
              className={`${styles.cardOuter} ${isUnlocked ? styles.unlocked : styles.locked} ${isCurrentFocus ? styles.focusCard : ''}`}
            >
              {/* Soccer player card front */}
              <div 
                className={styles.soccerCard}
                style={{ background: player.colorTheme }}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardPos} style={{ color: player.accentColor }}>{player.position}</span>
                  <span className={styles.cardNumber} style={{ color: player.accentColor }}>{player.backNumber}</span>
                </div>
                
                {/* Silhouette / Actual Image */}
                <div className={styles.imageArea}>
                  {isUnlocked ? (
                    <div 
                      className={styles.playerImage}
                      style={{ backgroundImage: `url('${player.bgImage}')` }}
                    />
                  ) : (
                    <div className={styles.silhouetteImage} />
                  )}
                </div>

                <div className={styles.playerDetails}>
                  <h4 className={styles.playerName}>{player.name}</h4>
                  <p className={styles.playerClub}>{player.club}</p>
                  
                  {isUnlocked ? (
                    <div className={styles.sigPhraseBox}>
                      <span className={styles.phraseLabel}>대표 표현:</span>
                      <p className={styles.phraseText}>"{player.signaturePhrase}"</p>
                    </div>
                  ) : (
                    <div className={styles.lockBox}>
                      <span>🔒 잠겨있음</span>
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>TAL CLASSICS</div>
              </div>

              {/* Progress and Cheats panel */}
              <div className={styles.cardActionArea}>
                <div className={styles.progressLabel}>
                  <span>카드 조각 수집:</span>
                  <strong>{pieceCount}/30</strong>
                </div>
                <div className={styles.progressTrack}>
                  <div 
                    className={styles.progressBar}
                    style={{ width: `${Math.min(100, (pieceCount / 30) * 100)}%` }}
                  />
                </div>
                
                {/* Cheat button for demo ease-of-use */}
                {!isUnlocked && (
                  <button 
                    className={styles.cheatBtn}
                    onClick={() => addPieces(player.id, 5)}
                  >
                    ⚡ 조각 5개 충전 (치트)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Target Change Modal */}
      {showRoleModelModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>롤 모델 선수 타겟 선택</h3>
            <p className={styles.modalSub}>하루 끝내기 완료 시 해당 선수의 조각이 충전됩니다.</p>
            
            <div className={styles.modalList}>
              {PLAYERS_POOL.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.modalItem} ${p.id === roleModel ? styles.modalItemActive : ''}`}
                  onClick={() => {
                    selectRoleModel(p.id);
                    setShowRoleModelModal(false);
                  }}
                >
                  <span className={styles.modalNumber}>{p.backNumber}</span>
                  <div className={styles.modalMeta}>
                    <strong>{p.name}</strong>
                    <span>{p.club} | {p.position}</span>
                  </div>
                </button>
              ))}
            </div>
            
            <button className={styles.modalCloseBtn} onClick={() => setShowRoleModelModal(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
