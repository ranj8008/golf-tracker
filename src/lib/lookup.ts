// What the course lookup (src/app/api/courses/search) returns.
export type LookupTee = {
  name: string;
  gender: "men" | "women";
  courseRating: number | null;
  slope: number | null;
  par: number[];
  yards: number[];
  strokeIndex: number[];
};

export type LookupCourse = {
  id: number;
  name: string;
  location: string | null;
  tees: LookupTee[];
};
