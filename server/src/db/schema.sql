-- Endless SRS reading flashcards: MySQL 8 schema
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username         VARCHAR(50)  NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  -- Scheduling is card-count based, not time based.
  -- cards_seen increments by 1 for every review this user completes.
  cards_seen       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  -- cards_seen value at the moment the last new word was introduced.
  last_intro_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  -- Progression. xp is LIFETIME total; level is a cached value derived from it
  -- (see server/lib/xp.js). Storing the total means the curve can be retuned later
  -- by recomputing level from xp.
  xp               BIGINT UNSIGNED   NOT NULL DEFAULT 0,
  level            SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Vocabulary. Binary collation on the Japanese columns so hiragana,
-- katakana and kanji are compared exactly (no accent/kana folding).
CREATE TABLE IF NOT EXISTS words (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  written  VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  reading  VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  glosses  JSON NOT NULL,
  jlpt     TINYINT UNSIGNED NULL,   -- kanjiAPI's old 1-4 scale, derived per word
  PRIMARY KEY (id),
  UNIQUE KEY uq_words_written_reading (written, reading),
  KEY idx_words_jlpt (jlpt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Example sentences: imported from Tatoeba, or entered by hand (source = 'manual').
CREATE TABLE IF NOT EXISTS sentences (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tatoeba_id  INT UNSIGNED NULL,  -- NULL for sentences entered by hand (UNIQUE allows many NULLs)
  source      ENUM('tatoeba','manual') NOT NULL DEFAULT 'tatoeba',
  ja          TEXT NOT NULL,
  en          TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sentences_tatoeba (tatoeba_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Where a word appears in a sentence. The sentence usually contains an
-- inflected form (食べた), so we store the surface text AND its reading;
-- that reading is what the user's typed answer is checked against.
CREATE TABLE IF NOT EXISTS sentence_words (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sentence_id      INT UNSIGNED NOT NULL,
  word_id          INT UNSIGNED NOT NULL,
  start_idx        SMALLINT UNSIGNED NOT NULL,  -- JS string offsets into sentences.ja
  end_idx          SMALLINT UNSIGNED NOT NULL,  -- exclusive
  surface          VARCHAR(64) NOT NULL,        -- e.g. 食べた
  surface_reading  VARCHAR(128) NOT NULL,       -- hiragana, e.g. たべた
  PRIMARY KEY (id),
  UNIQUE KEY uq_sw_sentence_start (sentence_id, start_idx),
  KEY idx_sw_word (word_id),
  CONSTRAINT fk_sw_sentence FOREIGN KEY (sentence_id) REFERENCES sentences (id) ON DELETE CASCADE,
  CONSTRAINT fk_sw_word     FOREIGN KEY (word_id)     REFERENCES words (id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Extra accepted readings for a match, beyond sentence_words.surface_reading
-- (which stays the canonical answer shown to the user). Store hiragana.
CREATE TABLE IF NOT EXISTS sentence_word_alt_readings (
  sentence_word_id  INT UNSIGNED NOT NULL,
  reading           VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (sentence_word_id, reading),
  CONSTRAINT fk_swar_sw FOREIGN KEY (sentence_word_id) REFERENCES sentence_words (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Sets of words. System sets have owner_id NULL; custom sets belong to a user.
CREATE TABLE IF NOT EXISTS sets (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  kind        ENUM('system','custom') NOT NULL DEFAULT 'system',
  owner_id    INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sets_owner (owner_id),
  CONSTRAINT fk_sets_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS set_words (
  set_id   INT UNSIGNED NOT NULL,
  word_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (set_id, word_id),
  KEY idx_set_words_word (word_id),
  CONSTRAINT fk_setwords_set  FOREIGN KEY (set_id)  REFERENCES sets (id)  ON DELETE CASCADE,
  CONSTRAINT fk_setwords_word FOREIGN KEY (word_id) REFERENCES words (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The only user-facing setting: which sets are in rotation.
CREATE TABLE IF NOT EXISTS user_active_sets (
  user_id  INT UNSIGNED NOT NULL,
  set_id   INT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, set_id),
  KEY idx_uas_set (set_id),
  CONSTRAINT fk_uas_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_uas_set  FOREIGN KEY (set_id)  REFERENCES sets (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-user knowledge of a word. A row exists once the word has been
-- introduced to that user; no row = never seen (shown as dark red).
CREATE TABLE IF NOT EXISTS user_word_progress (
  user_id            INT UNSIGNED NOT NULL,
  word_id            INT UNSIGNED NOT NULL,
  level              TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- 0..4 = dark red .. dark green
  due_at_count       BIGINT UNSIGNED NOT NULL,             -- due once users.cards_seen >= this
  last_seen_count    BIGINT UNSIGNED NULL,
  times_seen         INT UNSIGNED NOT NULL DEFAULT 0,
  times_correct      INT UNSIGNED NOT NULL DEFAULT 0,
  last_sentence_id   INT UNSIGNED NULL,
  introduced_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, word_id),
  KEY idx_uwp_due (user_id, due_at_count),
  KEY idx_uwp_word (word_id),
  CONSTRAINT fk_uwp_user     FOREIGN KEY (user_id)          REFERENCES users (id)     ON DELETE CASCADE,
  CONSTRAINT fk_uwp_word     FOREIGN KEY (word_id)          REFERENCES words (id)     ON DELETE CASCADE,
  CONSTRAINT fk_uwp_sentence FOREIGN KEY (last_sentence_id) REFERENCES sentences (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Append-only review history (lets you change the scheduler later and replay).
CREATE TABLE IF NOT EXISTS reviews (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  word_id        INT UNSIGNED NOT NULL,
  sentence_id    INT UNSIGNED NULL,
  card_number    BIGINT UNSIGNED NOT NULL,   -- users.cards_seen after this review
  guess          VARCHAR(128) NOT NULL,      -- hiragana the user typed
  correct        TINYINT(1) NOT NULL,
  level_before   TINYINT UNSIGNED NOT NULL,
  level_after    TINYINT UNSIGNED NOT NULL,
  xp_awarded     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  reviewed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reviews_user_card (user_id, card_number),
  KEY idx_reviews_word (word_id),
  KEY idx_reviews_user_word (user_id, word_id),
  CONSTRAINT fk_reviews_user     FOREIGN KEY (user_id)     REFERENCES users (id)     ON DELETE CASCADE,
  CONSTRAINT fk_reviews_word     FOREIGN KEY (word_id)     REFERENCES words (id)     ON DELETE CASCADE,
  CONSTRAINT fk_reviews_sentence FOREIGN KEY (sentence_id) REFERENCES sentences (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;