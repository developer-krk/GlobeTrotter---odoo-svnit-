-- GlobeTrotter relational schema
-- Loaded by: scripts/db-reset

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS post_likes;
DROP TABLE IF EXISTS community_posts;
DROP TABLE IF EXISTS saved_cities;
DROP TABLE IF EXISTS trip_costs;
DROP TABLE IF EXISTS trip_activities;
DROP TABLE IF EXISTS trip_stops;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS cities;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------- people

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(80)  NOT NULL,
  last_name     VARCHAR(80)  NOT NULL DEFAULT '',
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(40)      NULL,
  city          VARCHAR(120)     NULL,
  country       VARCHAR(120)     NULL,
  bio           TEXT             NULL,
  photo_url     VARCHAR(500)     NULL,
  language      VARCHAR(20)  NOT NULL DEFAULT 'en',
  home_currency CHAR(3)      NOT NULL DEFAULT 'USD',
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- catalogue

CREATE TABLE cities (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  country     VARCHAR(120) NOT NULL,
  region      VARCHAR(80)  NOT NULL,
  -- Daily cost for one traveller in USD: meals, local transport, incidentals.
  cost_index  DECIMAL(8,2) NOT NULL DEFAULT 0,
  popularity  INT          NOT NULL DEFAULT 0,
  currency    CHAR(3)      NOT NULL DEFAULT 'USD',
  image_url   VARCHAR(500)     NULL,
  description TEXT             NULL,
  UNIQUE KEY uq_city_country (name, country),
  KEY ix_cities_region (region),
  KEY ix_cities_popularity (popularity)
) ENGINE=InnoDB;

CREATE TABLE activities (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  city_id          INT NOT NULL,
  name             VARCHAR(160) NOT NULL,
  category         ENUM('sightseeing','food','adventure','culture','nature','nightlife','shopping','relaxation') NOT NULL,
  cost             DECIMAL(8,2) NOT NULL DEFAULT 0,
  duration_minutes INT          NOT NULL DEFAULT 60,
  description      TEXT             NULL,
  image_url        VARCHAR(500)     NULL,
  popularity       INT          NOT NULL DEFAULT 0,
  CONSTRAINT fk_activity_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
  KEY ix_activities_city (city_id),
  KEY ix_activities_category (category)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- trips

CREATE TABLE trips (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(160) NOT NULL,
  description TEXT             NULL,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  cover_url   VARCHAR(500)     NULL,
  travellers  INT          NOT NULL DEFAULT 1,
  is_public   TINYINT(1)   NOT NULL DEFAULT 0,
  share_slug  CHAR(12)         NULL,
  copied_from INT              NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trip_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_source FOREIGN KEY (copied_from) REFERENCES trips(id) ON DELETE SET NULL,
  UNIQUE KEY uq_trip_slug (share_slug),
  KEY ix_trips_user (user_id),
  KEY ix_trips_dates (start_date, end_date)
) ENGINE=InnoDB;

-- One city visited on a trip. `position` is the order of travel.
CREATE TABLE trip_stops (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  trip_id    INT NOT NULL,
  city_id    INT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  position   INT  NOT NULL DEFAULT 0,
  notes      TEXT     NULL,
  CONSTRAINT fk_stop_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_stop_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT,
  KEY ix_stops_trip (trip_id, position)
) ENGINE=InnoDB;

-- An activity placed on a day of a stop. activity_id is NULL for custom entries.
CREATE TABLE trip_activities (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  trip_id          INT NOT NULL,
  stop_id          INT NOT NULL,
  activity_id      INT     NULL,
  title            VARCHAR(160) NOT NULL,
  category         ENUM('sightseeing','food','adventure','culture','nature','nightlife','shopping','relaxation') NOT NULL DEFAULT 'sightseeing',
  cost             DECIMAL(8,2) NOT NULL DEFAULT 0,
  scheduled_date   DATE         NOT NULL,
  start_time       TIME             NULL,
  duration_minutes INT          NOT NULL DEFAULT 60,
  position         INT          NOT NULL DEFAULT 0,
  notes            TEXT             NULL,
  CONSTRAINT fk_ta_trip     FOREIGN KEY (trip_id)     REFERENCES trips(id)      ON DELETE CASCADE,
  CONSTRAINT fk_ta_stop     FOREIGN KEY (stop_id)     REFERENCES trip_stops(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL,
  KEY ix_ta_stop (stop_id, scheduled_date, position),
  KEY ix_ta_trip_date (trip_id, scheduled_date)
) ENGINE=InnoDB;

-- Everything that costs money but is not an activity.
CREATE TABLE trip_costs (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  trip_id  INT NOT NULL,
  stop_id  INT     NULL,
  category ENUM('transport','stay','meals','other') NOT NULL,
  label    VARCHAR(160) NOT NULL,
  amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_cost_trip FOREIGN KEY (trip_id) REFERENCES trips(id)      ON DELETE CASCADE,
  CONSTRAINT fk_cost_stop FOREIGN KEY (stop_id) REFERENCES trip_stops(id) ON DELETE CASCADE,
  KEY ix_costs_trip (trip_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- community

CREATE TABLE saved_cities (
  user_id  INT NOT NULL,
  city_id  INT NOT NULL,
  saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, city_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_saved_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE community_posts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  trip_id    INT     NULL,
  city_id    INT     NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_user FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_post_trip FOREIGN KEY (trip_id) REFERENCES trips(id)  ON DELETE SET NULL,
  CONSTRAINT fk_post_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
  KEY ix_posts_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE post_likes (
  post_id  INT NOT NULL,
  user_id  INT NOT NULL,
  liked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_like_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES users(id)           ON DELETE CASCADE
) ENGINE=InnoDB;
