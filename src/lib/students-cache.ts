import type { CoachAthlete, TrainingSession } from "@/types/user";

type StudentsRoster = {
  athletes: CoachAthlete[];
  page: number;
  pages: number;
  search: string;
  newIds: string[];
  newIdsLoaded: boolean;
  loaded: boolean;
};

function emptyRoster(): StudentsRoster {
  return {
    athletes: [],
    page: 1,
    pages: 0,
    search: "",
    newIds: [],
    newIdsLoaded: false,
    loaded: false,
  };
}

let roster = emptyRoster();

export function getStudentsRoster() {
  return roster;
}

export function readStudentsRoster(search: string) {
  if (roster.loaded && roster.search === search) return roster;
  return null;
}

export function writeStudentsRoster(next: Partial<StudentsRoster>) {
  roster = { ...roster, ...next };
}

export function writeStudentsRosterNewIds(ids: Iterable<string>) {
  roster = { ...roster, newIds: [...ids], newIdsLoaded: true };
}

export function patchStudentProgram(athleteId: string, sessions: TrainingSession[]) {
  if (!roster.loaded) return;
  roster = {
    ...roster,
    athletes: roster.athletes.map((row) =>
      row.id === athleteId ? { ...row, coachTrainingProgram: sessions } : row,
    ),
  };
}

export function clearStudentsRoster() {
  roster = emptyRoster();
}
