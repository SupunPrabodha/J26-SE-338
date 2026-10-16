export type TestLanguage = "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed";

export interface SampleReflection {
  id: string;
  label: string;
  language: TestLanguage;
  text: string;
}

export const SAMPLE_REFLECTIONS: SampleReflection[] = [
  {
    id: "sample-english",
    label: "English reflection",
    language: "English",
    text: "I have two major coursework deadlines this Friday and an upcoming mid-semester exam. I am finding it difficult to balance revision and sleep.",
  },
  {
    id: "sample-sinhala",
    label: "Sinhala reflection",
    language: "Sinhala",
    text: "මේ සතියේ ප්‍රධාන පැවරුම් දෙකක් භාර දීමට නියමිතව ඇති අතර ඉදිරි විභාගය සඳහා සූදානම් වීමට කාලය කළමනාකරණය කරගැනීම අපහසු වී ඇත.",
  },
  {
    id: "sample-romanized",
    label: "Romanized Sinhala reflection",
    language: "Romanized Sinhala",
    text: "Me sathiyedi assignment dekak submit karanna thiyenawa saha exam ekath lagai. Revision ekath ekka padam wada balance karaganna hena amarui.",
  },
  {
    id: "sample-code-mixed",
    label: "Code-mixed reflection",
    language: "Code-mixed",
    text: "Coursework project eke final report eka submit karanna thiyenne me Friday. Revision schedule ekath ekka stress wadi wela thiyenne.",
  },
];
