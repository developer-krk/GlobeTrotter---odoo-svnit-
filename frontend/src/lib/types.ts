export type Category =
  | 'sightseeing' | 'food' | 'adventure' | 'culture'
  | 'nature' | 'nightlife' | 'shopping' | 'relaxation';

export type TripStatus = 'ongoing' | 'upcoming' | 'completed';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  photo_url: string | null;
  language: string;
  home_currency: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface City {
  id: number;
  name: string;
  country: string;
  region: string;
  cost_index: string | number;
  popularity: number;
  currency: string;
  image_url: string | null;
  description: string | null;
  activity_count?: number;
}

export interface Activity {
  id: number;
  city_id: number;
  name: string;
  category: Category;
  cost: string | number;
  duration_minutes: number;
  description: string | null;
  popularity: number;
  city_name?: string;
  country?: string;
}

export interface TripActivity {
  id: number;
  trip_id: number;
  stop_id: number;
  activity_id: number | null;
  title: string;
  category: Category;
  cost: string | number;
  scheduled_date: string;
  start_time: string | null;
  duration_minutes: number;
  position: number;
  notes: string | null;
}

export interface Stop {
  id: number;
  trip_id: number;
  city_id: number;
  city_name: string;
  country: string;
  region: string;
  cost_index: string | number;
  start_date: string;
  end_date: string;
  position: number;
  nights: number;
  notes: string | null;
  activities: TripActivity[];
}

export interface CostLine {
  id: number;
  trip_id: number;
  stop_id: number | null;
  category: 'transport' | 'stay' | 'meals' | 'other';
  label: string;
  amount: string | number;
}

export interface Budget {
  total: number;
  days: number;
  travellers: number;
  averagePerDay: number;
  dailyAverage: number;
  byStop: { stopId: number; days: number; meals: number }[];
  perTraveller: number;
  breakdown: { category: string; amount: number; estimated: boolean }[];
  daily: { date: string; amount: number }[];
  threshold: number;
  heavyDays: { date: string; amount: number }[];
}

export interface Trip {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  cover_url: string | null;
  travellers: number;
  is_public: 0 | 1;
  share_slug: string | null;
  status: TripStatus;
  days: number;
  owner_name?: string;
  stop_count?: number;
  activity_count?: number;
  route?: { id: number; city: string; country: string }[];
  stops: Stop[];
  costs: CostLine[];
  budget: Budget;
}

export interface Post {
  id: number;
  title: string;
  body: string;
  created_at: string;
  author_name: string;
  author_photo: string | null;
  city_name: string | null;
  country: string | null;
  trip_name: string | null;
  share_slug: string | null;
  like_count: number;
  liked_by_me: number | null;
}
