export interface DelayOptions {
  delay?: number;
}

export interface MealItem {
  meal: string;
  code: string | null;
}

export interface DateMeal {
  date: string;
  existence: boolean;
  rest: boolean;
  meals: MealItem[];
}

export interface MealImageInput {
  date: string;
  meals: string[];
}

export interface RestImageItem {
  date: string;
  content: string | null;
}

export interface RestImageInput {
  date: string;
  items: RestImageItem[];
}
